/**
 * [UNLINKED / DEPRECATED] Supabase Client Stub
 * Supabase has been unlinked in favor of Neon Database (PostgreSQL).
 * This stub maintains compatibility for any remaining legacy references without loading external Supabase SDK.
 */

export const isSupabaseConfigured = false;
export const supabase = null;
export function getSupabase() {
  return null;
}
export const SOULX_STORAGE_BUCKET = 'soul-x';

export { uploadAvatar as uploadAvatarToSupabase, deleteAvatar as deleteAvatarFromSupabase } from './avatar';

export function subscribeToConversation(_convId: string, _callback: (msg: any) => void) {
  // Real-time chat is now handled by Server-Sent Events (SSE) and Neon database
  return {
    unsubscribe: () => {},
  };
}
