import { AuthUser, Gender } from '../types';

export interface SavedAccount {
  id: string;
  displayId: string;
  name: string;
  email: string;
  photoUrl?: string | null;
  gender?: Gender | null;
  birthDate?: string | null;
  lastLogin: string;
  refreshToken?: string;
  token?: string;
  refreshExpiresAt?: string;
  autoLoginEnabled?: boolean;
}

const STORAGE_KEYS = {
  AUTH_TOKEN: 'soulx_auth_token',
  REFRESH_TOKEN: 'soulx_refresh_token',
  TOKEN_EXPIRES_AT: 'soulx_token_expires_at',
  REFRESH_EXPIRES_AT: 'soulx_refresh_expires_at',
  AUTH_USER: 'soulx_auth_user',
  SAVED_ACCOUNTS: 'soulx_saved_accounts',
  REMEMBER_ACCOUNT: 'soulx_remember_account',
  LAST_ACTIVE_EMAIL: 'soulx_active_account_email',
  BIRTH_DATE: 'soulx_birth_date',
  GENDER: 'soulx_gender',
  ONBOARDING_COMPLETED: 'soulx_onboarding_completed',
  ADMIN_TOKEN: 'soulx_admin_token',
};

/**
 * Retrieve the current access token
 */
export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
}

/**
 * Retrieve the 30-day refresh token
 */
export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
}

/**
 * Store session tokens (Access token & 30-day Refresh token)
 */
export function storeAuthTokens(
  token: string,
  refreshToken?: string,
  expiresAt?: string,
  refreshExpiresAt?: string
) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  }
  if (refreshToken) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }
  if (expiresAt) {
    localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRES_AT, expiresAt);
  }
  if (refreshExpiresAt) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_EXPIRES_AT, refreshExpiresAt);
  } else {
    // Default 30 days expiration if not specified
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    localStorage.setItem(STORAGE_KEYS.REFRESH_EXPIRES_AT, in30Days);
  }
}

/**
 * Retrieve expiration dates of stored tokens
 */
export function getTokenExpirations(): {
  tokenExpiresAt: string | null;
  refreshExpiresAt: string | null;
  daysRemaining: number;
} {
  if (typeof window === 'undefined') {
    return { tokenExpiresAt: null, refreshExpiresAt: null, daysRemaining: 30 };
  }
  const tokenExpiresAt = localStorage.getItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
  const refreshExpiresAt = localStorage.getItem(STORAGE_KEYS.REFRESH_EXPIRES_AT);

  let daysRemaining = 30;
  if (refreshExpiresAt) {
    const diff = new Date(refreshExpiresAt).getTime() - Date.now();
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return { tokenExpiresAt, refreshExpiresAt, daysRemaining };
}

/**
 * Retrieve list of all saved accounts stored on this device
 */
export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SAVED_ACCOUNTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort(
        (a, b) => new Date(b.lastLogin).getTime() - new Date(a.lastLogin).getTime()
      );
    }
  } catch (err) {
    console.error('Failed to parse saved accounts from storage:', err);
  }
  return [];
}

/**
 * Save or update an account record for easy 1-click login and persistence
 */
export function saveAccountToStorage(
  user: AuthUser,
  options?: {
    refreshToken?: string;
    token?: string;
    refreshExpiresAt?: string;
    autoLoginEnabled?: boolean;
  }
): SavedAccount {
  const currentList = getSavedAccounts();
  const emailNorm = user.email.toLowerCase().trim();
  const existingIdx = currentList.findIndex(
    (acc) => acc.email.toLowerCase().trim() === emailNorm || acc.id === user.id
  );

  const existing = existingIdx >= 0 ? currentList[existingIdx] : null;

  const refreshExp =
    options?.refreshExpiresAt ||
    existing?.refreshExpiresAt ||
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const savedRecord: SavedAccount = {
    id: user.id,
    displayId: user.displayId || existing?.displayId || 'S-0101V77-X711',
    name: user.name,
    email: emailNorm,
    photoUrl: user.photoUrl || existing?.photoUrl || null,
    gender: user.gender || existing?.gender || null,
    birthDate: user.birthDate || existing?.birthDate || null,
    lastLogin: new Date().toISOString(),
    refreshToken: options?.refreshToken || existing?.refreshToken || getStoredRefreshToken() || undefined,
    token: options?.token || existing?.token || getStoredAuthToken() || undefined,
    refreshExpiresAt: refreshExp,
    autoLoginEnabled: options?.autoLoginEnabled ?? existing?.autoLoginEnabled ?? true,
  };

  if (existingIdx >= 0) {
    currentList[existingIdx] = savedRecord;
  } else {
    currentList.unshift(savedRecord);
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.SAVED_ACCOUNTS, JSON.stringify(currentList));
    localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_EMAIL, emailNorm);
  }

  return savedRecord;
}

/**
 * Remove a saved account from the device
 */
export function removeSavedAccountFromStorage(identifier: string): SavedAccount[] {
  if (typeof window === 'undefined') return [];
  const currentList = getSavedAccounts();
  const norm = identifier.toLowerCase().trim();

  const filtered = currentList.filter(
    (acc) => acc.email.toLowerCase().trim() !== norm && acc.id !== identifier && acc.displayId !== identifier
  );

  localStorage.setItem(STORAGE_KEYS.SAVED_ACCOUNTS, JSON.stringify(filtered));

  const activeEmail = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE_EMAIL);
  if (activeEmail && activeEmail.toLowerCase().trim() === norm) {
    localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE_EMAIL);
  }

  return filtered;
}

/**
 * Clear current active session (tokens) but keep saved accounts list intact
 */
export function clearCurrentSession(keepSavedAccounts = true) {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRES_AT);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_EXPIRES_AT);
  localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
  localStorage.removeItem(STORAGE_KEYS.BIRTH_DATE);
  localStorage.removeItem(STORAGE_KEYS.GENDER);
  sessionStorage.removeItem(STORAGE_KEYS.ADMIN_TOKEN);

  if (!keepSavedAccounts) {
    localStorage.removeItem(STORAGE_KEYS.SAVED_ACCOUNTS);
    localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE_EMAIL);
  }
}

/**
 * Execute silent token refresh via backend /api/auth/refresh (Valid 30 days)
 */
export async function performTokenRefresh(explicitRefreshToken?: string): Promise<{
  success: boolean;
  token?: string;
  refreshToken?: string;
  user?: AuthUser;
  isAdmin?: boolean;
  message?: string;
}> {
  const rfToken = explicitRefreshToken || getStoredRefreshToken();
  if (!rfToken) {
    return { success: false, message: 'لا يوجد رمز تجديد (Refresh Token) مسجل' };
  }

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Refresh-Token': rfToken,
      },
      body: JSON.stringify({ refreshToken: rfToken }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.token) {
      storeAuthTokens(data.token, data.refreshToken || rfToken, data.expiresAt, data.refreshExpiresAt);

      if (data.user) {
        saveAccountToStorage(data.user, {
          token: data.token,
          refreshToken: data.refreshToken || rfToken,
          refreshExpiresAt: data.refreshExpiresAt,
        });
        localStorage.setItem(STORAGE_KEYS.AUTH_USER, JSON.stringify(data.user));
      }

      if (data.isAdmin) {
        sessionStorage.setItem(STORAGE_KEYS.ADMIN_TOKEN, data.token);
      }

      return {
        success: true,
        token: data.token,
        refreshToken: data.refreshToken || rfToken,
        user: data.user,
        isAdmin: data.isAdmin,
      };
    }

    return { success: false, message: data.message || 'فشل تجديد الجلسة' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'خطأ في الاتصال بالخادم أثناء تجديد التوكن' };
  }
}
