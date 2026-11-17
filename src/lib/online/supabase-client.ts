/**
 * Indian Monopoly - Supabase client for the online (GitHub Pages) mode.
 *
 * The URL and publishable key are public by design (they ship in every browser bundle).
 * Database tables are locked with row-level security; the browser can only call the
 * narrow `online_*` functions. NEVER put a Postgres connection string or service key here.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL: string =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || 'https://omelbzqsmqsjazaliqvo.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY: string =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ||
  'sb_publishable_uJUAAY3zqnYOLzzlqGcAnw_oq4fsfCv';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}

/** Realtime channel name for a hosted room. */
export function channelForRoom(roomId: string): string {
  return `mono-${roomId}`;
}

export interface OnlineRoomLookup {
  channel: string;
  room_id: string;
  updated_at: string;
}

export async function lookupOnlineRoom(inviteCode: string): Promise<OnlineRoomLookup | null> {
  const { data, error } = await getSupabase().rpc('online_lookup_room', { p_invite_code: inviteCode.trim().toUpperCase() });
  if (error) throw new Error(error.message);
  const rows = (data || []) as OnlineRoomLookup[];
  return rows[0] || null;
}
