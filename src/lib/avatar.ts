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

/**
 * Modern High-Fidelity Default Avatars:
 * - Male Avatar: Vibrant Blue Palette (#1e40af, #0284c7, #38bdf8)
 * - Female Avatar: Vibrant Pink Palette (#831843, #db2777, #ec4899, #fb7185)
 */
const MALE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="m-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1e40af"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
    <linearGradient id="m-glow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="m-skin" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffedd5"/>
      <stop offset="100%" stop-color="#fed7aa"/>
    </linearGradient>
    <linearGradient id="m-cloth" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="m-hair" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <circle cx="80" cy="80" r="80" fill="url(#m-bg)"/>
  <circle cx="80" cy="80" r="76" fill="none" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.4"/>
  <circle cx="80" cy="50" r="46" fill="url(#m-glow)"/>
  <path d="M28 156 C30 122 52 110 80 110 C108 110 130 122 132 156 Z" fill="url(#m-cloth)"/>
  <path d="M68 110 L80 124 L92 110 Z" fill="#1e3a8a"/>
  <path d="M72 110 L80 120 L88 110 Z" fill="#93c5fd"/>
  <path d="M70 88 H90 V110 H70 Z" fill="url(#m-skin)"/>
  <path d="M70 96 C74 102 86 102 90 96 V110 H70 Z" fill="#fdba74" opacity="0.4"/>
  <ellipse cx="54" cy="72" rx="4" ry="7" fill="#fed7aa"/>
  <ellipse cx="106" cy="72" rx="4" ry="7" fill="#fed7aa"/>
  <ellipse cx="80" cy="70" rx="26" ry="30" fill="url(#m-skin)"/>
  <path d="M52 66 C50 46 62 34 80 34 C98 34 110 46 108 66 C104 60 98 56 88 56 C76 56 68 50 60 56 C55 60 53 62 52 66 Z" fill="url(#m-hair)"/>
  <path d="M56 52 C60 38 74 32 88 34 C100 36 106 44 106 54 C100 48 92 46 82 46 C70 46 64 50 56 52 Z" fill="#334155"/>
  <path d="M64 62 Q72 60 76 63" stroke="#0f172a" stroke-width="2" stroke-linecap="round" fill="none"/>
  <path d="M84 63 Q88 60 96 62" stroke="#0f172a" stroke-width="2" stroke-linecap="round" fill="none"/>
  <circle cx="70" cy="70" r="2.8" fill="#0f172a"/>
  <circle cx="71" cy="69" r="1" fill="#ffffff"/>
  <circle cx="90" cy="70" r="2.8" fill="#0f172a"/>
  <circle cx="91" cy="69" r="1" fill="#ffffff"/>
  <path d="M80 71 V76 L83 77" stroke="#fb923c" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M73 83 Q80 88 87 83" stroke="#ea580c" stroke-width="2" stroke-linecap="round" fill="none"/>
  <g transform="translate(122, 16)">
    <circle cx="10" cy="10" r="10" fill="#0284c7" stroke="#ffffff" stroke-width="2"/>
    <circle cx="9" cy="11" r="3.5" fill="none" stroke="#ffffff" stroke-width="1.6"/>
    <line x1="12" y1="8" x2="15.5" y2="4.5" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
    <polyline points="12.5,4.5 15.5,4.5 15.5,7.5" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const FEMALE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
  <defs>
    <linearGradient id="f-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4a044e"/>
      <stop offset="50%" stop-color="#db2777"/>
      <stop offset="100%" stop-color="#fb7185"/>
    </linearGradient>
    <linearGradient id="f-glow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fbcfe8" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#e11d48" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="f-skin" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff1f2"/>
      <stop offset="100%" stop-color="#fed7aa"/>
    </linearGradient>
    <linearGradient id="f-cloth" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#be185d"/>
    </linearGradient>
    <linearGradient id="f-hair" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b0764"/>
      <stop offset="100%" stop-color="#831843"/>
    </linearGradient>
  </defs>
  <circle cx="80" cy="80" r="80" fill="url(#f-bg)"/>
  <circle cx="80" cy="80" r="76" fill="none" stroke="#fbcfe8" stroke-width="2" stroke-opacity="0.4"/>
  <circle cx="80" cy="50" r="46" fill="url(#f-glow)"/>
  <path d="M46 72 C42 96 46 125 54 138 C58 142 64 142 68 134 C72 122 72 92 72 80 Z" fill="url(#f-hair)"/>
  <path d="M114 72 C118 96 114 125 106 138 C102 142 96 142 92 134 C88 122 88 92 88 80 Z" fill="url(#f-hair)"/>
  <path d="M28 156 C30 122 52 110 80 110 C108 110 130 122 132 156 Z" fill="url(#f-cloth)"/>
  <path d="M66 110 Q80 126 94 110 Z" fill="#fff1f2" opacity="0.9"/>
  <path d="M72 88 H88 V112 H72 Z" fill="url(#f-skin)"/>
  <path d="M72 98 C76 104 84 104 88 98 V112 H72 Z" fill="#f43f5e" opacity="0.25"/>
  <ellipse cx="55" cy="72" rx="3.5" ry="6" fill="#fed7aa"/>
  <ellipse cx="105" cy="72" rx="3.5" ry="6" fill="#fed7aa"/>
  <circle cx="55" cy="77" r="2" fill="#fbbf24"/>
  <circle cx="105" cy="77" r="2" fill="#fbbf24"/>
  <ellipse cx="80" cy="70" rx="24" ry="28" fill="url(#f-skin)"/>
  <path d="M52 68 C48 46 62 34 80 34 C98 34 112 46 108 68 C102 54 88 46 80 46 C70 46 58 54 52 68 Z" fill="url(#f-hair)"/>
  <path d="M52 64 C50 78 52 94 58 106 C60 102 62 84 60 70 Z" fill="#4a044e"/>
  <path d="M108 64 C110 78 108 94 102 106 C100 102 98 84 100 70 Z" fill="#4a044e"/>
  <path d="M65 63 Q71 61 76 64" stroke="#4a044e" stroke-width="1.8" stroke-linecap="round" fill="none"/>
  <path d="M84 64 Q89 61 95 63" stroke="#4a044e" stroke-width="1.8" stroke-linecap="round" fill="none"/>
  <circle cx="71" cy="70" r="2.6" fill="#4a044e"/>
  <circle cx="72" cy="69" r="0.9" fill="#ffffff"/>
  <path d="M68 67 Q71 65 74 67" stroke="#4a044e" stroke-width="1.4" fill="none"/>
  <circle cx="89" cy="70" r="2.6" fill="#4a044e"/>
  <circle cx="90" cy="69" r="0.9" fill="#ffffff"/>
  <path d="M86 67 Q89 65 92 67" stroke="#4a044e" stroke-width="1.4" fill="none"/>
  <ellipse cx="68" cy="74" rx="4" ry="2" fill="#fb7185" opacity="0.5"/>
  <ellipse cx="92" cy="74" rx="4" ry="2" fill="#fb7185" opacity="0.5"/>
  <path d="M74 81 Q80 86 86 81" stroke="#e11d48" stroke-width="2" stroke-linecap="round" fill="none"/>
  <g transform="translate(122, 16)">
    <circle cx="10" cy="10" r="10" fill="#db2777" stroke="#ffffff" stroke-width="2"/>
    <circle cx="10" cy="7.5" r="3.2" fill="none" stroke="#ffffff" stroke-width="1.6"/>
    <line x1="10" y1="10.8" x2="10" y2="15.5" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
    <line x1="7.5" y1="13" x2="12.5" y2="13" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"/>
  </g>
</svg>`;

export const MALE_DEFAULT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(MALE_SVG)}`;
export const FEMALE_DEFAULT_AVATAR = `data:image/svg+xml;utf8,${encodeURIComponent(FEMALE_SVG)}`;

/**
 * Returns default avatar according to gender:
 * - 'female' -> Pink female avatar
 * - 'male' | other -> Blue male avatar
 */
export function getDefaultAvatar(gender?: string | null): string {
  if (!gender) return MALE_DEFAULT_AVATAR;
  const g = String(gender).toLowerCase().trim();
  if (g === 'female' || g === 'f' || g === 'أنثى' || g === 'انثى') {
    return FEMALE_DEFAULT_AVATAR;
  }
  return MALE_DEFAULT_AVATAR;
}

/**
 * Returns the effective avatar for a user:
 * Uses photoUrl if defined and not a generic non-avatar banner;
 * otherwise defaults to the gender-appropriate default avatar (Blue for Male, Pink for Female).
 */
export function getEffectiveAvatar(photoUrl?: string | null, gender?: string | null): string {
  if (photoUrl && typeof photoUrl === 'string' && photoUrl.trim().length > 0) {
    // If it was the legacy audio spatial background, treat it as empty so user sees the new avatar
    if (!photoUrl.includes('soulx_audio_spatial_1793489090595.jpg')) {
      return photoUrl;
    }
  }
  return getDefaultAvatar(gender);
}

export function isDefaultAvatar(url?: string | null): boolean {
  if (!url) return true;
  return url === MALE_DEFAULT_AVATAR || url === FEMALE_DEFAULT_AVATAR;
}
