import React, { useState, useEffect } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  UserPlus,
  UserMinus,
  UserCheck,
  Clock,
  Flag,
  ShieldAlert,
  ShieldCheck,
  Ban,
  Snowflake,
  Unlock,
  RefreshCw,
  MessageCircle,
  Copy,
  Check,
  Globe,
  Calendar,
  Sparkles,
  Loader2,
  AlertTriangle,
  User,
  Heart,
} from 'lucide-react';
import { Language, AuthUser, Gender } from '../types';
import { OpenUserProfilePayload } from '../lib/profileModal';
import { getDefaultAvatar, getEffectiveAvatar } from '../lib/avatar';
import { formatCountryUnified } from '../lib/countryUtils';
import { blockUserApi, unblockUserApi, checkBlockStatusApi } from '../lib/blockUtils';
import { ReportUserModal, ReportTargetUser } from './ReportUserModal';

interface OtherUserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser: AuthUser | null;
  user: OpenUserProfilePayload | null;
  onStartChat?: (user: { id: string; name: string; avatar: string; displayId?: string }) => void;
}

export const OtherUserProfileModal: React.FC<OtherUserProfileModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  user,
  onStartChat,
}) => {
  const isAr = lang === 'ar';

  // Dynamic user data state
  const [profileData, setProfileData] = useState<OpenUserProfilePayload | null>(user);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Friendship state
  const [isFriend, setIsFriend] = useState(false);
  const [isPendingSent, setIsPendingSent] = useState(false);
  const [isFriendLoading, setIsFriendLoading] = useState(false);

  // Block state
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockLoading, setIsBlockLoading] = useState(false);

  // Admin Restriction State (صلاحيات الإدارة لتجميد وحظر الحساب)
  const [adminRestriction, setAdminRestriction] = useState<{
    isFrozen: boolean;
    isBanned: boolean;
    freezeExpiresAt?: string | null;
    freezeReason?: string | null;
    banReason?: string | null;
    freezeDurationMinutes?: number | null;
    remainingMs?: number;
  } | null>(null);
  const [showAdminFreezeModal, setShowAdminFreezeModal] = useState(false);
  const [showAdminBanModal, setShowAdminBanModal] = useState(false);
  const [adminFreezeMinutes, setAdminFreezeMinutes] = useState('60');
  const [adminFreezeReason, setAdminFreezeReason] = useState('');
  const [adminBanReason, setAdminBanReason] = useState('');
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);

  // Modals & Confirmations
  const [showUnfriendConfirm, setShowUnfriendConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Synchronize when incoming user changes
  useEffect(() => {
    if (user) {
      setProfileData(user);
      setIsFriend(Boolean(user.isFriend));
      setIsPendingSent(Boolean(user.hasPendingRequest));
      setIsBlockedByMe(Boolean(user.isBlocked));
      setShowUnfriendConfirm(false);
      setShowBlockConfirm(false);
      fetchFullProfile(user);
    }
  }, [user?.id, user?.displayId]);

  // Fetch full details and real-time status from server
  const fetchFullProfile = async (target: OpenUserProfilePayload) => {
    const myId = currentUser?.id || currentUser?.displayId || '';
    const targetId = target.displayId || target.id;
    if (!targetId) return;

    setIsLoadingProfile(true);

    try {
      // 1. Fetch user profile from /api/users/profile
      const params = new URLSearchParams({
        id: targetId,
        callerId: myId,
      });
      if (target.name) params.set('name', target.name);

      const profileRes = await fetch(`/api/users/profile?${params.toString()}`).then((r) => r.json()).catch(() => null);
      if (profileRes?.success && profileRes?.user) {
        const u = profileRes.user;
        setProfileData((prev) => ({
          ...prev,
          ...target,
          name: u.name || target.name,
          avatar: u.avatar || target.avatar,
          displayId: u.displayId || target.displayId || target.id,
          bio: u.bio !== undefined ? u.bio : target.bio,
          country: u.country || target.country,
          age: u.age || target.age,
          gender: u.gender || target.gender,
        }));
      }

      // 2. Check block status
      if (myId) {
        const blockStatus = await checkBlockStatusApi(myId, target.id);
        setIsBlockedByMe(Boolean(blockStatus.isBlockedByMe));
      }

      // 3. Check friends list & pending requests
      if (myId) {
        const friendsRes = await fetch(`/api/friends/list?userId=${encodeURIComponent(myId)}`).then((r) => r.json()).catch(() => null);
        if (friendsRes?.success) {
          const list: any[] = friendsRes.friends || [];
          const sent: any[] = friendsRes.sentRequests || [];

          const targetIds = [target.id, target.displayId].filter(Boolean);
          const foundFriend = list.some((f) => targetIds.includes(f.id) || targetIds.includes(f.originalId) || targetIds.includes(f.displayId));
          const foundSent = sent.some((s) => targetIds.includes(s.receiverId) || targetIds.includes(s.targetUserId));

          setIsFriend(foundFriend);
          setIsPendingSent(foundSent);
        } else {
          // Fallback to local storage check
          try {
            const storedFriends = JSON.parse(localStorage.getItem('soulx_friends') || '[]');
            const storedSent = JSON.parse(localStorage.getItem('soulx_sent_requests') || '[]');
            const targetIds = [target.id, target.displayId].filter(Boolean);
            setIsFriend(storedFriends.some((f: any) => targetIds.includes(f.id) || targetIds.includes(f.displayId)));
            setIsPendingSent(storedSent.some((id: string) => targetIds.includes(id)));
          } catch {}
        }
      }

      // 4. If caller is admin, check admin restriction status for this user
      if (currentUser?.isAdmin) {
        try {
          const res = await fetch(`/api/users/account-status?userId=${encodeURIComponent(target.id)}`);
          const d = await res.json();
          if (d && d.success) {
            setAdminRestriction({
              isFrozen: Boolean(d.isFrozen || d.accountState === 'frozen' || d.status?.isFrozen),
              isBanned: Boolean(d.isBanned || d.accountState === 'banned' || d.status?.isBanned),
              freezeExpiresAt: d.freezeExpiresAt || d.status?.freezeExpiresAt || null,
              freezeReason: d.freezeReason || d.status?.freezeReason || null,
              banReason: d.banReason || d.status?.banReason || null,
              freezeDurationMinutes: d.freezeDurationMinutes ?? d.status?.freezeDurationMinutes ?? null,
              remainingMs: d.remainingMs ?? d.status?.remainingMs ?? 0,
            });
          }
        } catch {}
      }
    } catch (err) {
      console.warn('Failed to fetch full profile:', err);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleAdminFreeze = async () => {
    if (!profileData) return;
    const mins = parseInt(adminFreezeMinutes, 10);
    if (isNaN(mins) || mins <= 0) {
      showToast(isAr ? 'يرجى إدخال مدة صحيحة بالدقائق' : 'Please enter valid minutes');
      return;
    }
    setIsAdminSubmitting(true);
    try {
      const adminToken = typeof window !== 'undefined' ? sessionStorage.getItem('soulx_admin_token') : null;
      const res = await fetch('/api/admin/users/freeze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'X-Admin-Token': adminToken } : {}),
        },
        body: JSON.stringify({
          userId: profileData.id,
          durationMinutes: mins,
          reason: adminFreezeReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isAr ? `تم تجميد الحساب لمدة ${mins} دقيقة بنجاح` : `User frozen for ${mins}m`);
        setShowAdminFreezeModal(false);
        setAdminFreezeReason('');
        fetchFullProfile(profileData);
      } else {
        showToast(data.message || (isAr ? 'فشل تجميد الحساب' : 'Failed to freeze'));
      }
    } catch {
      showToast(isAr ? 'خطأ أثناء تجميد الحساب' : 'Error freezing user');
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  const handleAdminUnfreeze = async () => {
    if (!profileData) return;
    setIsAdminSubmitting(true);
    try {
      const adminToken = typeof window !== 'undefined' ? sessionStorage.getItem('soulx_admin_token') : null;
      const res = await fetch('/api/admin/users/unfreeze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'X-Admin-Token': adminToken } : {}),
        },
        body: JSON.stringify({ userId: profileData.id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isAr ? 'تم فك التجميد عن الحساب بنجاح' : 'Account unfrozen');
        fetchFullProfile(profileData);
      } else {
        showToast(data.message || (isAr ? 'فشل فك التجميد' : 'Failed to unfreeze'));
      }
    } catch {
      showToast(isAr ? 'خطأ أثناء فك التجميد' : 'Error unfreezing');
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  const handleAdminBan = async () => {
    if (!profileData) return;
    setIsAdminSubmitting(true);
    try {
      const adminToken = typeof window !== 'undefined' ? sessionStorage.getItem('soulx_admin_token') : null;
      const res = await fetch('/api/admin/users/ban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'X-Admin-Token': adminToken } : {}),
        },
        body: JSON.stringify({
          userId: profileData.id,
          reason: adminBanReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isAr ? 'تم حظر المستخدم نهائياً بنجاح' : 'User banned permanently');
        setShowAdminBanModal(false);
        setAdminBanReason('');
        fetchFullProfile(profileData);
      } else {
        showToast(data.message || (isAr ? 'فشل حظر المستخدم' : 'Failed to ban'));
      }
    } catch {
      showToast(isAr ? 'خطأ أثناء حظر المستخدم' : 'Error banning user');
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  const handleAdminUnban = async () => {
    if (!profileData) return;
    setIsAdminSubmitting(true);
    try {
      const adminToken = typeof window !== 'undefined' ? sessionStorage.getItem('soulx_admin_token') : null;
      const res = await fetch('/api/admin/users/unban', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { 'X-Admin-Token': adminToken } : {}),
        },
        body: JSON.stringify({ userId: profileData.id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(isAr ? 'تم إلغاء الحظر عن الحساب بنجاح' : 'User unbanned');
        fetchFullProfile(profileData);
      } else {
        showToast(data.message || (isAr ? 'فشل إلغاء الحظر' : 'Failed to unban'));
      }
    } catch {
      showToast(isAr ? 'خطأ أثناء إلغاء الحظر' : 'Error unbanning');
    } finally {
      setIsAdminSubmitting(false);
    }
  };

  if (!isOpen || !profileData) return null;

  const currentEffectiveAvatar =
    profileData.avatar || getDefaultAvatar(profileData.gender);
  const displayAge = profileData.age || 24;
  const displayCountry = formatCountryUnified(profileData.country || (isAr ? 'المملكة العربية السعودية' : 'Saudi Arabia'), lang);
  const displayBio = profileData.bio?.trim();
  const targetId = profileData.displayId || profileData.id;

  // Handle Copy ID
  const handleCopyId = () => {
    if (!targetId) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(targetId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      showToast(isAr ? 'تم نسخ المعرف بنجاح ✨' : 'ID copied to clipboard ✨');
    }
  };

  // Handle Start Direct Chat
  const handleStartDirectChat = () => {
    if (onStartChat) {
      onStartChat({
        id: profileData.id,
        displayId: profileData.displayId,
        name: profileData.name,
        avatar: currentEffectiveAvatar,
      });
      onClose();
      return;
    }

    // Default global handler
    if (typeof window !== 'undefined') {
      const convId = profileData.displayId || profileData.id;
      localStorage.setItem('soulx_open_conversation_id', convId);
      window.dispatchEvent(
        new CustomEvent('soulx:open-conversation', {
          detail: {
            conversationId: convId,
            partnerId: profileData.id,
            partnerName: profileData.name,
            partnerAvatar: currentEffectiveAvatar,
          },
        })
      );
    }
    onClose();
  };

  // Handle Add Friend
  const handleSendFriendRequest = async () => {
    if (!currentUser || isFriendLoading) return;
    setIsFriendLoading(true);

    const senderId = currentUser.displayId || currentUser.id;
    const senderName = currentUser.name || 'مستخدم Soul-X';
    const senderAvatar = getEffectiveAvatar(currentUser.photoUrl, currentUser.gender);

    try {
      const res = await fetch('/api/friends/send-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId,
          senderName,
          senderAvatar,
          senderBio: currentUser.bio,
          senderDisplayId: currentUser.displayId,
          targetUserId: profileData.id,
          targetUserDisplayId: profileData.displayId || profileData.id,
          targetUserName: profileData.name,
          targetUserAvatar: currentEffectiveAvatar,
          targetUserBio: profileData.bio,
          timestamp: new Date().toISOString(),
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setIsPendingSent(true);
        showToast(
          isAr
            ? `تم إرسال طلب الصداقة إلى ${profileData.name} بنجاح ✨`
            : `Friend request sent to ${profileData.name} ✨`
        );

        // Update local sent requests cache
        try {
          const sent = JSON.parse(localStorage.getItem('soulx_sent_requests') || '[]');
          if (!sent.includes(profileData.id)) {
            sent.push(profileData.id);
            if (profileData.displayId) sent.push(profileData.displayId);
            localStorage.setItem('soulx_sent_requests', JSON.stringify(sent));
          }
        } catch {}

        window.dispatchEvent(new CustomEvent('soulx_friend_requests_updated'));
      } else {
        showToast(data?.message || (isAr ? 'تعذر إرسال طلب الصداقة' : 'Failed to send request'));
      }
    } catch {
      showToast(isAr ? 'تعذر إرسال طلب الصداقة، حاول ثانية' : 'Error sending request');
    } finally {
      setIsFriendLoading(false);
    }
  };

  // Handle Cancel Friend Request
  const handleCancelFriendRequest = async () => {
    if (!currentUser || isFriendLoading) return;
    setIsFriendLoading(true);

    const senderId = currentUser.displayId || currentUser.id;

    try {
      const res = await fetch('/api/friends/cancel-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId,
          targetUserId: profileData.id,
          targetUserDisplayId: profileData.displayId,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setIsPendingSent(false);
        showToast(isAr ? 'تم إلغاء طلب الصداقة' : 'Friend request cancelled');

        try {
          const sent = JSON.parse(localStorage.getItem('soulx_sent_requests') || '[]');
          const updated = sent.filter((id: string) => id !== profileData.id && id !== profileData.displayId);
          localStorage.setItem('soulx_sent_requests', JSON.stringify(updated));
        } catch {}

        window.dispatchEvent(new CustomEvent('soulx_friend_requests_updated'));
      } else {
        showToast(data?.message || (isAr ? 'فشل إلغاء الطلب' : 'Failed to cancel request'));
      }
    } catch {
      showToast(isAr ? 'فشل إلغاء الطلب' : 'Failed to cancel request');
    } finally {
      setIsFriendLoading(false);
    }
  };

  // Handle Remove Friend (Unfriend)
  const handleConfirmUnfriend = async () => {
    if (!currentUser || isFriendLoading) return;
    setIsFriendLoading(true);

    const myUid = currentUser.id || currentUser.displayId || '';

    try {
      const res = await fetch('/api/friends/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: myUid,
          friendId: profileData.id,
          displayId: currentUser.displayId,
          email: currentUser.email,
          friendDisplayId: profileData.displayId,
        }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setIsFriend(false);
        setShowUnfriendConfirm(false);
        showToast(
          isAr
            ? `تم إلغاء الصداقة مع ${profileData.name}`
            : `Removed ${profileData.name} from friends`
        );

        // Update local storage
        try {
          const stored = JSON.parse(localStorage.getItem('soulx_friends') || '[]');
          const updated = stored.filter(
            (f: any) => f.id !== profileData.id && f.displayId !== profileData.displayId
          );
          localStorage.setItem('soulx_friends', JSON.stringify(updated));
        } catch {}

        window.dispatchEvent(new CustomEvent('soulx_friends_updated'));
      } else {
        showToast(data?.message || (isAr ? 'فشل إلغاء الصداقة' : 'Failed to unfriend'));
      }
    } catch {
      showToast(isAr ? 'حدث خطأ أثناء إلغاء الصداقة' : 'Error removing friend');
    } finally {
      setIsFriendLoading(false);
    }
  };

  // Handle Block User
  const handleConfirmBlock = async () => {
    if (!currentUser || isBlockLoading) return;
    setIsBlockLoading(true);

    const myUid = currentUser.id || currentUser.displayId || '';

    try {
      const result = await blockUserApi({
        userId: myUid,
        targetUserId: profileData.id,
        targetName: profileData.name,
        targetAvatar: currentEffectiveAvatar,
        targetDisplayId: profileData.displayId || profileData.id,
      });

      if (result.success) {
        setIsBlockedByMe(true);
        setShowBlockConfirm(false);
        showToast(isAr ? `تم حظر ${profileData.name} بنجاح` : `Blocked ${profileData.name}`);
        window.dispatchEvent(
          new CustomEvent('soulx:blocks-updated', {
            detail: { targetUserId: profileData.id, action: 'blocked' },
          })
        );
      } else {
        showToast(result.message || (isAr ? 'فشل حظر المستخدم' : 'Failed to block user'));
      }
    } catch {
      showToast(isAr ? 'حدث خطأ أثناء الحظر' : 'Error blocking user');
    } finally {
      setIsBlockLoading(false);
    }
  };

  // Handle Unblock User
  const handleUnblock = async () => {
    if (!currentUser || isBlockLoading) return;
    setIsBlockLoading(true);

    const myUid = currentUser.id || currentUser.displayId || '';

    try {
      const result = await unblockUserApi({
        userId: myUid,
        targetUserId: profileData.id,
      });

      if (result.success) {
        setIsBlockedByMe(false);
        showToast(isAr ? `تم إلغاء حظر ${profileData.name}` : `Unblocked ${profileData.name}`);
        window.dispatchEvent(
          new CustomEvent('soulx:blocks-updated', {
            detail: { targetUserId: profileData.id, action: 'unblocked' },
          })
        );
      } else {
        showToast(result.message || (isAr ? 'فشل إلغاء الحظر' : 'Failed to unblock user'));
      }
    } catch {
      showToast(isAr ? 'حدث خطأ أثناء إلغاء الحظر' : 'Error unblocking user');
    } finally {
      setIsBlockLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[140] bg-neutral-900/90 dark:bg-black/95 backdrop-blur-2xl flex flex-col overflow-y-auto animate-in fade-in duration-200"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Top App Bar Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3.5 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 cursor-pointer transition-transform active:scale-90"
            title={isAr ? 'رجوع' : 'Back'}
            aria-label={isAr ? 'رجوع' : 'Back'}
          >
            {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div>
            <h2 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white leading-tight">
              {isAr ? 'الملف الشخصي' : 'User Profile'}
            </h2>
            <p className="text-[11px] text-neutral-400">
              Soul-X Network
            </p>
          </div>
        </div>

        {/* Quick Report in Header */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
            title={isAr ? 'إبلاغ عن الحساب' : 'Report User'}
          >
            <Flag className="w-4 h-4" />
            <span className="hidden sm:inline">{isAr ? 'إبلاغ' : 'Report'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer transition-colors"
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 space-y-5 pb-24">
        {/* Hero Profile Banner & Avatar Card */}
        <div className="relative rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-xl overflow-hidden">
          {/* Top Decorative Gradient Banner */}
          <div className="h-28 sm:h-36 w-full bg-gradient-to-r from-cyan-600 via-indigo-600 to-cyan-500 relative">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/20 via-transparent to-black/30" />
            {profileData.isAdmin && (
              <div className="absolute top-3 right-3 rtl:right-3 rtl:left-auto ltr:left-3 ltr:right-auto px-3 py-1 rounded-full bg-amber-500/90 text-neutral-950 font-black text-[11px] shadow-md flex items-center gap-1 backdrop-blur-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isAr ? 'حساب إداري رسمي' : 'Official Admin'}</span>
              </div>
            )}
          </div>

          {/* Avatar and Main Info Section */}
          <div className="px-5 sm:px-8 pb-6 pt-0 relative">
            {/* Large Centered Avatar */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 mb-4">
              <div className="relative inline-block self-center sm:self-auto">
                <img
                  src={currentEffectiveAvatar}
                  alt={profileData.name}
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl object-cover border-4 border-white dark:border-neutral-900 shadow-2xl bg-neutral-200 dark:bg-neutral-800 ring-2 ring-cyan-500/30"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = getDefaultAvatar(profileData.gender);
                  }}
                />
                {/* Online indicator badge */}
                <span
                  className={`absolute -bottom-1.5 -right-1.5 rtl:-right-1.5 ltr:-right-1.5 w-6 h-6 rounded-full border-3 border-white dark:border-neutral-900 flex items-center justify-center shadow-md ${
                    profileData.status === 'offline'
                      ? 'bg-neutral-400'
                      : 'bg-emerald-500 animate-pulse'
                  }`}
                  title={profileData.status === 'offline' ? (isAr ? 'غير متصل' : 'Offline') : (isAr ? 'متصل الآن' : 'Online')}
                />
              </div>

              {/* Status Pill on Large Screen */}
              <div className="flex items-center justify-center sm:justify-end gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                    profileData.status === 'offline'
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      profileData.status === 'offline' ? 'bg-neutral-400' : 'bg-emerald-500'
                    }`}
                  />
                  <span>
                    {profileData.status === 'offline'
                      ? isAr
                        ? 'آخر ظهور مؤخراً'
                        : 'Recently seen'
                      : isAr
                      ? 'متصل الآن في التطبيق'
                      : 'Online now'}
                  </span>
                </span>
              </div>
            </div>

            {/* Name, Badges & ID */}
            <div className="text-center sm:text-start space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                  {profileData.name}
                </h1>
                {profileData.gender && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                    {profileData.gender === 'female' ? (isAr ? 'أنثى' : 'Female') : (isAr ? 'ذكر' : 'Male')}
                  </span>
                )}
                {isBlockedByMe && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                    <Ban className="w-3 h-3" />
                    <span>{isAr ? 'محظور من قبلك' : 'Blocked'}</span>
                  </span>
                )}
                {isFriend && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    <span>{isAr ? 'صديق مضاف' : 'Friend'}</span>
                  </span>
                )}
              </div>

              {/* Numerical ID with Copy */}
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/60 text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
                  <span className="text-neutral-400 font-sans text-[10px] uppercase">ID:</span>
                  <span>{targetId}</span>
                  <button
                    type="button"
                    onClick={handleCopyId}
                    className="p-1 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-cyan-500 transition-colors cursor-pointer"
                    title={isAr ? 'نسخ المعرف' : 'Copy ID'}
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* User Details Grid (Age, Country) */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* العمر / Age */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center shrink-0 border border-cyan-500/20">
              <Calendar className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-neutral-400 block mb-0.5">
                {isAr ? 'العمر' : 'Age'}
              </span>
              <span className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                {displayAge} {isAr ? 'سنة' : 'years'}
              </span>
            </div>
          </div>

          {/* الدولة / Country */}
          <div className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <Globe className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-neutral-400 block mb-0.5">
                {isAr ? 'الدولة' : 'Country'}
              </span>
              <span className="text-sm sm:text-base font-black text-neutral-900 dark:text-white truncate block">
                {displayCountry}
              </span>
            </div>
          </div>
        </div>

        {/* النبذة التعريفية / Bio */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-cyan-500" />
              <span>{isAr ? 'النبذة التعريفية (البايو)' : 'Bio / About'}</span>
            </h3>
          </div>
          {displayBio ? (
            <p className="text-sm sm:text-base text-neutral-800 dark:text-neutral-200 leading-relaxed font-medium whitespace-pre-wrap">
              "{displayBio}"
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-neutral-400 italic">
              {isAr ? 'لم يقم المستخدم بإضافة نبذة تعريفية بعد.' : 'No bio provided yet.'}
            </p>
          )}
        </div>

        {/* PRIMARY ACTION: START PRIVATE CHAT */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleStartDirectChat}
            className="w-full py-4 px-6 rounded-3xl bg-gradient-to-r from-cyan-400 via-cyan-500 to-indigo-500 hover:from-cyan-300 hover:to-indigo-400 text-neutral-950 font-black text-sm sm:text-base shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98"
          >
            <MessageCircle className="w-5 h-5 shrink-0 text-neutral-950" />
            <span>{isAr ? 'بدء محادثة خاصة فوراً' : 'Start Private Chat'}</span>
          </button>
        </div>

        {/* SECONDARY ACTIONS GRID: Friend & Block & Report */}
        <div className="space-y-3 pt-1">
          <div className="text-xs font-bold text-neutral-400 px-1">
            {isAr ? 'إجراءات الحساب والعلاقة:' : 'Account & Relationship Actions:'}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 1. زر الصداقة / Friend action button according to state */}
            {isFriend ? (
              <button
                type="button"
                disabled={isFriendLoading}
                onClick={() => setShowUnfriendConfirm(true)}
                className="p-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                {isFriendLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserMinus className="w-4 h-4" />
                    <span>{isAr ? 'إلغاء الصداقة' : 'Unfriend'}</span>
                  </>
                )}
              </button>
            ) : isPendingSent ? (
              <button
                type="button"
                disabled={isFriendLoading}
                onClick={handleCancelFriendRequest}
                className="p-3.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                {isFriendLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    <span>{isAr ? 'إلغاء طلب الصداقة المعلق' : 'Cancel Friend Request'}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={isFriendLoading}
                onClick={handleSendFriendRequest}
                className="p-3.5 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                {isFriendLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>{isAr ? 'إضافة إلى الأصدقاء' : 'Add to Friends'}</span>
                  </>
                )}
              </button>
            )}

            {/* 2. زر الحظر / Block action button according to state */}
            {isBlockedByMe ? (
              <button
                type="button"
                disabled={isBlockLoading}
                onClick={handleUnblock}
                className="p-3.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                {isBlockLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isAr ? 'فك الحظر عن المستخدم' : 'Unblock User'}</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                disabled={isBlockLoading}
                onClick={() => setShowBlockConfirm(true)}
                className="p-3.5 rounded-2xl bg-neutral-100 hover:bg-rose-500/10 hover:text-rose-600 dark:bg-neutral-800 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <Ban className="w-4 h-4 text-rose-500" />
                <span>{isAr ? 'حظر المستخدم' : 'Block User'}</span>
              </button>
            )}
          </div>

          {/* 3. زر إبلاغ عن المستخدم / Report button */}
          <button
            type="button"
            onClick={() => setIsReportModalOpen(true)}
            className="w-full p-3.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
          >
            <Flag className="w-4 h-4 text-rose-500" />
            <span>{isAr ? 'إبلاغ إدارة المنصة عن هذا المستخدم' : 'Report User to Support'}</span>
          </button>

          {/* 4. صلاحيات الإدارة: تجميد وحظر الحساب (Admin Actions) */}
          {currentUser?.isAdmin && (
            <div className="p-4 rounded-3xl bg-gradient-to-r from-cyan-500/10 via-neutral-100 dark:via-neutral-900 to-rose-500/10 border-2 border-cyan-500/30 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-black text-neutral-900 dark:text-white">
                    {isAr ? 'صلاحيات الإدارة (تجميد وحظر الحساب)' : 'Admin Actions (Freeze & Ban)'}
                  </span>
                </div>
                {adminRestriction?.isFrozen ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                    {isAr ? 'مجمّد حالياً' : 'Frozen'}
                  </span>
                ) : adminRestriction?.isBanned ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                    {isAr ? 'محظور نهائياً' : 'Banned'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                    {isAr ? 'نشط' : 'Active'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {adminRestriction?.isFrozen ? (
                  <button
                    type="button"
                    disabled={isAdminSubmitting}
                    onClick={handleAdminUnfreeze}
                    className="p-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>{isAr ? 'فك التجميد عن الحساب' : 'Unfreeze Account'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAdminFreezeModal(true)}
                    className="p-3 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-800 dark:text-cyan-200 border-2 border-cyan-500/40 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <Snowflake className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                    <span>{isAr ? 'تجميد الحساب (بالدقائق)' : 'Freeze (Minutes)'}</span>
                  </button>
                )}

                {adminRestriction?.isBanned ? (
                  <button
                    type="button"
                    disabled={isAdminSubmitting}
                    onClick={handleAdminUnban}
                    className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-95"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{isAr ? 'فك الحظر عن الحساب' : 'Unban Account'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAdminBanModal(true)}
                    className="p-3 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 dark:text-rose-200 border-2 border-rose-500/40 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <Ban className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>{isAr ? 'حظر الحساب نهائياً' : 'Ban Account'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* CONFIRMATION MODAL: UNFRIEND */}
      {showUnfriendConfirm && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
          dir={isAr ? 'rtl' : 'ltr'}
          onClick={() => setShowUnfriendConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
              <UserMinus className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                {isAr ? 'تأكيد إلغاء الصداقة' : 'Confirm Unfriend'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {isAr
                  ? `هل أنت متأكد من رغبتك في إلغاء الصداقة مع ${profileData.name}؟ سيتم حذف كليكما من قائمة أصدقاء الآخر.`
                  : `Are you sure you want to remove ${profileData.name} from your friends?`}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isFriendLoading}
                onClick={handleConfirmUnfriend}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm cursor-pointer active:scale-95 transition-all"
              >
                {isFriendLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : isAr ? 'نعم، إلغاء الصداقة' : 'Unfriend'}
              </button>
              <button
                type="button"
                onClick={() => setShowUnfriendConfirm(false)}
                className="flex-1 py-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs sm:text-sm cursor-pointer active:scale-95 transition-all"
              >
                {isAr ? 'تراجع' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL: BLOCK */}
      {showBlockConfirm && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
          dir={isAr ? 'rtl' : 'ltr'}
          onClick={() => setShowBlockConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/20">
              <Ban className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                {isAr ? 'تأكيد حظر المستخدم' : 'Confirm Block User'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                {isAr
                  ? `هل أنت متأكد من حظر ${profileData.name}؟ لن يتمكن من مراسلتك أو إرسال طلبات إليك بعد الآن.`
                  : `Are you sure you want to block ${profileData.name}? They will no longer be able to message you.`}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                disabled={isBlockLoading}
                onClick={handleConfirmBlock}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs sm:text-sm cursor-pointer active:scale-95 transition-all"
              >
                {isBlockLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : isAr ? 'نعم، حظر' : 'Block'}
              </button>
              <button
                type="button"
                onClick={() => setShowBlockConfirm(false)}
                className="flex-1 py-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs sm:text-sm cursor-pointer active:scale-95 transition-all"
              >
                {isAr ? 'تراجع' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORT USER MODAL */}
      <ReportUserModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        lang={lang}
        currentUser={currentUser}
        targetUser={{
          id: profileData.id,
          displayId: profileData.displayId || profileData.id,
          name: profileData.name,
          avatar: currentEffectiveAvatar,
        }}
        source="chat"
        onSuccess={() => {
          showToast(isAr ? 'تم استلام بلاغك بنجاح' : 'Report submitted successfully');
        }}
      />

      {/* TOAST POPUP */}
      {toastMessage && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[170] px-6 py-4 rounded-3xl bg-neutral-950/95 dark:bg-neutral-900/95 text-white font-black text-xs sm:text-sm shadow-2xl border-2 border-cyan-400 shadow-cyan-500/30 backdrop-blur-xl flex items-center justify-center gap-2.5 text-center max-w-[90vw] animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
          <Sparkles className="w-5 h-5 shrink-0 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ADMIN FREEZE MODAL */}
      {showAdminFreezeModal && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
          dir={isAr ? 'rtl' : 'ltr'}
          onClick={() => setShowAdminFreezeModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-neutral-900 border-2 border-cyan-500/40 p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto border border-cyan-500/30">
              <Snowflake className="w-7 h-7 animate-pulse" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                {isAr ? 'تجميد الحساب بالدقائق' : 'Freeze Account by Minutes'}
              </h3>
              <p className="text-xs text-neutral-500">
                {profileData.name} ({profileData.displayId || profileData.id})
              </p>
            </div>

            <div className="space-y-3 text-start">
              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  {isAr ? 'مدة التجميد (بالدقائق) *' : 'Freeze Duration (Minutes) *'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={adminFreezeMinutes}
                    onChange={(e) => setAdminFreezeMinutes(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs font-mono font-bold text-neutral-900 dark:text-white"
                  />
                  <span className="text-xs text-neutral-500 font-bold shrink-0">{isAr ? 'دقيقة' : 'mins'}</span>
                </div>

                {/* Preset shortcuts */}
                <div className="flex items-center gap-1.5 flex-wrap pt-2">
                  {[
                    { label: isAr ? '15د' : '15m', mins: '15' },
                    { label: isAr ? '30د' : '30m', mins: '30' },
                    { label: isAr ? 'ساعة' : '1h', mins: '60' },
                    { label: isAr ? '3 ساعات' : '3h', mins: '180' },
                    { label: isAr ? '24 ساعة' : '24h', mins: '1440' },
                    { label: isAr ? 'أسبوع' : '7d', mins: '10080' },
                  ].map((p) => (
                    <button
                      key={p.mins}
                      type="button"
                      onClick={() => setAdminFreezeMinutes(p.mins)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        adminFreezeMinutes === p.mins
                          ? 'bg-cyan-600 text-white border-cyan-600'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  {isAr ? 'سبب التجميد (اختياري)' : 'Freeze Reason (Optional)'}
                </label>
                <input
                  type="text"
                  value={adminFreezeReason}
                  onChange={(e) => setAdminFreezeReason(e.target.value)}
                  placeholder={isAr ? 'اكتب سبب التجميد...' : 'Enter reason...'}
                  className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdminFreezeModal(false)}
                className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isAdminSubmitting}
                onClick={handleAdminFreeze}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 flex items-center gap-1.5"
              >
                {isAdminSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Snowflake className="w-3.5 h-3.5" />}
                <span>{isAr ? 'تأكيد التجميد' : 'Confirm Freeze'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN BAN MODAL */}
      {showAdminBanModal && (
        <div
          className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
          dir={isAr ? 'rtl' : 'ltr'}
          onClick={() => setShowAdminBanModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-neutral-900 border-2 border-rose-500/40 p-6 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/30">
              <Ban className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                {isAr ? 'حظر الحساب نهائياً' : 'Ban Account Permanently'}
              </h3>
              <p className="text-xs text-neutral-500">
                {profileData.name} ({profileData.displayId || profileData.id})
              </p>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-700 dark:text-rose-300 text-start">
              {isAr ? 'سيتم منع المستخدم تماماً من الدخول للموقع نهائياً حتى يتم فك الحظر عنه.' : 'User will be permanently blocked from accessing the site until unbanned.'}
            </div>

            <div className="space-y-1 text-start">
              <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300 block">
                {isAr ? 'سبب الحظر (اختياري)' : 'Ban Reason (Optional)'}
              </label>
              <input
                type="text"
                value={adminBanReason}
                onChange={(e) => setAdminBanReason(e.target.value)}
                placeholder={isAr ? 'اكتب سبب الحظر...' : 'Enter reason...'}
                className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs text-neutral-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAdminBanModal(false)}
                className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                disabled={isAdminSubmitting}
                onClick={handleAdminBan}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 flex items-center gap-1.5"
              >
                {isAdminSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                <span>{isAr ? 'تأكيد الحظر النهائي' : 'Confirm Ban'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
