"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase URL + anon key. These are PUBLIC values by design (they ship to every
 * browser; row-level security protects all data), so they're safe to hardcode.
 * Env vars still take precedence if set at build time.
 */
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rhmgkpfvikgsocdaprtm.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJobWdrcGZ2aWtnc29jZGFwcnRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2ODM4NTUsImV4cCI6MjA4NjI1OTg1NX0.N1qHdf3L9LnsFyEiwHSd_z3lvkilt_UWIWzt68x1exM";

let client: SupabaseClient | null | undefined;

/** Browser Supabase client, or null when no URL/key are available. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  client =
    SUPABASE_URL && SUPABASE_ANON_KEY
      ? createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      : null;
  return client;
}

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
