import { Gender } from '../types';

export interface OpenUserProfilePayload {
  id: string;
  displayId?: string;
  name: string;
  avatar?: string;
  bio?: string;
  country?: string;
  age?: number;
  gender?: Gender | null;
  status?: 'online' | 'offline';
  isFriend?: boolean;
  isBlocked?: boolean;
  hasPendingRequest?: boolean;
  isAdmin?: boolean;
}

/**
 * دالة مساعدة عامة لفتح الملف الشخصي الكامل لأي مستخدم من أي مكان في المنصة
 */
export function openUserProfile(user: OpenUserProfilePayload) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('soulx:open-user-profile', {
        detail: {
          id: user.id,
          displayId: user.displayId || user.id,
          name: user.name,
          avatar: user.avatar,
          bio: user.bio,
          country: user.country,
          age: user.age,
          gender: user.gender,
          status: user.status || 'online',
          isFriend: user.isFriend,
          isBlocked: user.isBlocked,
          hasPendingRequest: user.hasPendingRequest,
          isAdmin: user.isAdmin,
        },
      })
    );
  }
}
