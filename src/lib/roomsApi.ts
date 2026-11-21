import { getStoredAuthToken } from './authStorage';
import type {
  RoomAuditLogRecord,
  RoomBanRecord,
  RoomDetail,
  RoomEventRecord,
  RoomGameState,
  RoomMessageRecord,
  RoomModPermissions,
  RoomModRecord,
  RoomMusicState,
  RoomOccupantInfo,
  RoomQueueItem,
  RoomSeatInfo,
  RoomSummary,
} from '../types';

function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getStoredAuthToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(extra || {}),
  };
}

async function apiJson<T = any>(url: string, options: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = getAuthHeaders(
    isFormData ? undefined : { 'Content-Type': 'application/json' }
  );
  const res = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
  const data = await res.json().catch(() => ({ success: false, message: 'استجابة غير صالحة من الخادم' }));
  if (!res.ok && data && data.success === undefined) {
    data.success = false;
  }
  return { ...data, httpStatus: res.status } as T;
}

export interface RoomsListResponse {
  success: boolean;
  createCostCoins: number;
  rooms: RoomSummary[];
  sections: {
    active: RoomSummary[];
    friendsInside: RoomSummary[];
    featured: RoomSummary[];
    newRooms: RoomSummary[];
    favorites: RoomSummary[];
    owned: RoomSummary[];
  };
  message?: string;
}

export interface RoomDetailResponse {
  success: boolean;
  requiresPin?: boolean;
  hasPinConfigured?: boolean;
  summary?: RoomSummary;
  room?: RoomDetail;
  seats?: RoomSeatInfo[];
  occupants?: RoomOccupantInfo[];
  queue?: RoomQueueItem[];
  messages?: RoomMessageRecord[];
  events?: RoomEventRecord[];
  moderators?: RoomModRecord[];
  music?: RoomMusicState;
  game?: RoomGameState;
  banned?: boolean;
  banType?: 'kick' | 'ban';
  reason?: string;
  expiresAt?: string | null;
  message?: string;
}

export const roomsApi = {
  list(params?: { q?: string; code?: string; sort?: string; category?: string }): Promise<RoomsListResponse> {
    const sp = new URLSearchParams();
    if (params?.q) sp.set('q', params.q);
    if (params?.code) sp.set('code', params.code);
    if (params?.sort) sp.set('sort', params.sort);
    if (params?.category && params.category !== 'all') sp.set('category', params.category);
    const qs = sp.toString();
    return apiJson(`/api/rooms${qs ? `?${qs}` : ''}`);
  },

  createRoom(formData: FormData): Promise<{
    success: boolean;
    room?: RoomDetail;
    coinsBalance?: number;
    insufficientCoins?: boolean;
    message?: string;
  }> {
    return apiJson('/api/rooms', {
      method: 'POST',
      body: formData,
    });
  },

  getRoom(codeOrId: string, invite?: string): Promise<RoomDetailResponse> {
    const qs = invite ? `?invite=${encodeURIComponent(invite)}` : '';
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}${qs}`);
  },

  verifyPin(codeOrId: string, pin: string): Promise<{ success: boolean; entryToken?: string; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/verify-pin`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  },

  getRoomPin(codeOrId: string): Promise<{ success: boolean; hasPin: boolean; pin: string | null; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/pin`);
  },

  setLockAndPin(
    codeOrId: string,
    payload: { isLocked: boolean; pinMode: 'auto' | 'custom' | 'remove' | 'keep'; pin?: string }
  ): Promise<{ success: boolean; isLocked: boolean; hasPin: boolean; pin: string | null; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/lock`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  createInvite(codeOrId: string, targetUserId?: string): Promise<{ success: boolean; inviteToken?: string; roomCode?: string; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/invite`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
  },

  sitOnSeat(codeOrId: string, seatNumber: number): Promise<{ success: boolean; seatNumber?: number; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/seats/sit`, {
      method: 'POST',
      body: JSON.stringify({ seatNumber }),
    });
  },

  leaveSeat(codeOrId: string): Promise<{ success: boolean; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/seats/leave`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  manageSeat(
    codeOrId: string,
    payload: {
      action: 'lock' | 'unlock' | 'evict' | 'move' | 'mute_user' | 'unmute_user' | 'assign_user';
      seatNumber?: number;
      targetUserId?: string;
    }
  ): Promise<{ success: boolean; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/seats/manage`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  toggleRoomMuteAll(codeOrId: string, isRoomMuted: boolean): Promise<{ success: boolean; isRoomMuted?: boolean; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/mute-all`, {
      method: 'POST',
      body: JSON.stringify({ isRoomMuted }),
    });
  },

  manageQueue(
    codeOrId: string,
    action: 'request' | 'cancel' | 'accept' | 'reject',
    targetUserId?: string
  ): Promise<{ success: boolean; queue?: RoomQueueItem[]; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/queue`, {
      method: 'POST',
      body: JSON.stringify({ action, targetUserId }),
    });
  },

  moderateChat(
    codeOrId: string,
    payload: { action: 'delete' | 'pin' | 'unpin' | 'pause' | 'resume'; messageId?: string }
  ): Promise<{ success: boolean; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/chat/moderate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  sendGift(
    codeOrId: string,
    payload: {
      giftId: string;
      quantity: number;
      recipientMode: 'single' | 'selected' | 'all_seated' | 'owner';
      recipientIds: string[];
      idempotencyKey: string;
    }
  ): Promise<{
    success: boolean;
    senderCoins?: number;
    totalCostCoins?: number;
    insufficientCoins?: boolean;
    message?: string;
  }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/gifts/send`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  manageModerator(
    codeOrId: string,
    payload: {
      action: 'upsert' | 'remove';
      targetUserId: string;
      role?: 'head_admin' | 'moderator';
      permissions?: Partial<RoomModPermissions>;
    }
  ): Promise<{ success: boolean; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/moderators`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getBans(codeOrId: string): Promise<{ success: boolean; bans?: RoomBanRecord[]; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/bans`);
  },

  manageBan(
    codeOrId: string,
    payload: {
      action: 'kick' | 'ban' | 'unban' | 'update_duration';
      targetUserId: string;
      durationMinutes?: number;
      isPermanent?: boolean;
      reason?: string;
    }
  ): Promise<{ success: boolean; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/moderation/ban`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateSettings(codeOrId: string, payload: FormData | Record<string, any>): Promise<{ success: boolean; room?: RoomDetail; message?: string }> {
    const isForm = typeof FormData !== 'undefined' && payload instanceof FormData;
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/settings`, {
      method: 'PATCH',
      body: isForm ? payload : JSON.stringify(payload),
    });
  },

  setFeatured(codeOrId: string, isFeatured: boolean): Promise<{ success: boolean; isFeatured?: boolean; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/feature`, {
      method: 'PATCH',
      body: JSON.stringify({ isFeatured }),
    });
  },

  getAuditLogs(codeOrId: string): Promise<{ success: boolean; logs?: RoomAuditLogRecord[]; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/audit-logs`);
  },

  toggleFavorite(codeOrId: string, notificationsEnabled?: boolean): Promise<{ success: boolean; isFavorite?: boolean; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/favorite`, {
      method: 'POST',
      body: JSON.stringify({ notificationsEnabled }),
    });
  },

  manageEvents(
    codeOrId: string,
    payload: { action: 'create' | 'cancel' | 'rsvp'; title?: string; description?: string; startsAt?: string; eventId?: string }
  ): Promise<{ success: boolean; events?: RoomEventRecord[]; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  deleteRoom(codeOrId: string): Promise<{ success: boolean; message?: string }> {
    return apiJson(`/api/rooms/${encodeURIComponent(codeOrId)}`, {
      method: 'DELETE',
    });
  },

  async getRtcConfig(): Promise<RTCIceServer[]> {
    try {
      const res = await apiJson<{ success: boolean; iceServers?: RTCIceServer[] }>('/api/rooms/rtc-config');
      if (res.success && Array.isArray(res.iceServers) && res.iceServers.length > 0) {
        return res.iceServers;
      }
    } catch {}
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  },
};
