import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

/**
 * Storage bucket designated for profile pictures in Soul-X
 */
export const SOULX_STORAGE_BUCKET = 'soul-x';

/**
 * Helper to convert a File to base64 Data URL
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * Upload profile avatar to Supabase Storage bucket 'soul-x'
 * and link public URL to the profile in Supabase Database.
 */
export async function uploadAvatarToSupabase(
  userId: string,
  file: File
): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
  try {
    // 1. Try direct client-side Supabase Storage upload if configured
    if (supabase) {
      try {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const cleanUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '');
        const filePath = `avatars/${cleanUserId}-${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(SOULX_STORAGE_BUCKET)
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
          });

        if (!uploadError && uploadData) {
          const { data: publicData } = supabase.storage
            .from(SOULX_STORAGE_BUCKET)
            .getPublicUrl(filePath);

          const avatarUrl = publicData?.publicUrl || '';
          if (avatarUrl) {
            // Update profile in Supabase Database
            await supabase
              .from('profiles')
              .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
              .or(`id.eq.${userId},display_id.eq.${userId}`);

            // Also notify server endpoint to ensure backend cache/sync
            const token = typeof window !== 'undefined' ? localStorage.getItem('soulx_auth_token') : null;
            fetch('/api/auth/update-profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ userId, photoUrl: avatarUrl }),
            }).catch(() => {});

            return { success: true, avatarUrl };
          }
        }
      } catch (clientErr) {
        console.warn('Direct client storage upload failed, falling back to server route:', clientErr);
      }
    }

    // 2. Server-side endpoint (which uses Supabase service role / server client)
    const token = typeof window !== 'undefined' ? localStorage.getItem('soulx_auth_token') : null;
    const base64Data = await fileToBase64(file);
    const res = await fetch('/api/profile/upload-avatar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        userId,
        fileName: file.name,
        fileData: base64Data,
        contentType: file.type || 'image/jpeg',
      }),
    });

    const result = await res.json();
    if (result.success && result.avatarUrl) {
      return { success: true, avatarUrl: result.avatarUrl };
    }
    return { success: false, error: result.message || 'فشل في رفع الصورة' };
  } catch (err: any) {
    console.error('Error uploading avatar:', err);
    return { success: false, error: err?.message || 'حدث خطأ أثناء رفع الصورة' };
  }
}

/**
 * Delete profile avatar from Supabase Storage & Database
 */
export async function deleteAvatarFromSupabase(
  userId: string,
  avatarUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (supabase && avatarUrl) {
      const parts = avatarUrl.split(`/${SOULX_STORAGE_BUCKET}/`);
      if (parts.length > 1) {
        const storagePath = decodeURIComponent(parts[1]);
        await supabase.storage.from(SOULX_STORAGE_BUCKET).remove([storagePath]);
      }

      await supabase
        .from('profiles')
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .or(`id.eq.${userId},display_id.eq.${userId}`);
    }

    // Server-side endpoint sync
    const token = typeof window !== 'undefined' ? localStorage.getItem('soulx_auth_token') : null;
    const res = await fetch('/api/profile/delete-avatar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ userId, avatarUrl }),
    });
    const data = await res.json();
    return { success: data.success };
  } catch (err: any) {
    console.error('Error deleting avatar:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Supabase Realtime Message Subscription
 */
export function subscribeToConversation(
  conversationId: string,
  onNewMessage: (message: any) => void
) {
  if (!supabase) return null;

  try {
    const channel = supabase
      .channel(`chat_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onNewMessage(payload.new);
        }
      )
      .subscribe();

    return channel;
  } catch (e) {
    console.warn('Realtime subscription not available:', e);
    return null;
  }
}
