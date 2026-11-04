/**
 * Avatar upload & management service for Soul-X
 * Works with Neon PostgreSQL Database and server-side avatar storage
 */

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ success: boolean; avatarUrl?: string; error?: string }> {
  try {
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

export async function deleteAvatar(
  userId: string,
  avatarUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const token = typeof window !== 'undefined' ? localStorage.getItem('soulx_auth_token') : null;
    const res = await fetch('/api/profile/delete-avatar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ userId, avatarUrl }),
    });
    const result = await res.json();
    return { success: result.success, error: result.message };
  } catch (err: any) {
    return { success: false, error: err?.message || 'فشل في حذف الصورة' };
  }
}

// Aliases for backwards compatibility
export const uploadAvatarToSupabase = uploadAvatar;
export const deleteAvatarFromSupabase = deleteAvatar;
