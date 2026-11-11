import { BlockedUserRecord } from '../types';
import { getStoredAuthToken, getStoredRefreshToken } from './authStorage';

export async function fetchBlockedUsers(userId?: string, displayId?: string, email?: string): Promise<BlockedUserRecord[]> {
  const token = getStoredAuthToken();
  const refreshToken = getStoredRefreshToken();

  const params = new URLSearchParams();
  if (userId) params.set('userId', userId);
  if (displayId) params.set('displayId', displayId);
  if (email) params.set('email', email);

  const res = await fetch(`/api/users/blocked?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
      ...(userId ? { 'X-User-Id': userId } : {}),
      ...(email ? { 'X-User-Email': email } : {}),
    },
  });

  const data = await res.json();
  if (res.ok && data.success && Array.isArray(data.blockedUsers)) {
    return data.blockedUsers;
  }
  return [];
}

export async function blockUserApi(params: {
  userId: string;
  targetUserId: string;
  targetName?: string;
  targetAvatar?: string;
  targetDisplayId?: string;
}): Promise<{ success: boolean; message: string }> {
  const token = getStoredAuthToken();
  const refreshToken = getStoredRefreshToken();

  const res = await fetch('/api/users/block', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (res.ok && data.success) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('soulx:blocks-updated', {
          detail: { targetUserId: params.targetUserId, action: 'blocked' },
        })
      );
    }
    return { success: true, message: data.message || 'تم حظر المستخدم بنجاح' };
  }
  return { success: false, message: data.message || 'تعذر حظر المستخدم' };
}

export async function unblockUserApi(params: {
  userId: string;
  targetUserId: string;
}): Promise<{ success: boolean; message: string }> {
  const token = getStoredAuthToken();
  const refreshToken = getStoredRefreshToken();

  const res = await fetch('/api/users/unblock', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (res.ok && data.success) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('soulx:blocks-updated', {
          detail: { targetUserId: params.targetUserId, action: 'unblocked' },
        })
      );
    }
    return { success: true, message: data.message || 'تم إلغاء حظر المستخدم بنجاح' };
  }
  return { success: false, message: data.message || 'تعذر إلغاء الحظر' };
}

export async function checkBlockStatusApi(
  userId: string,
  targetUserId: string
): Promise<{ isBlocked: boolean; isBlockedByMe: boolean; isBlockedByThem: boolean }> {
  try {
    const params = new URLSearchParams({ userId, targetUserId });
    const res = await fetch(`/api/users/block-status?${params.toString()}`);
    const data = await res.json();
    if (res.ok && data.success) {
      return {
        isBlocked: Boolean(data.isBlocked),
        isBlockedByMe: Boolean(data.isBlockedByMe),
        isBlockedByThem: Boolean(data.isBlockedByThem),
      };
    }
  } catch {}
  return { isBlocked: false, isBlockedByMe: false, isBlockedByThem: false };
}
