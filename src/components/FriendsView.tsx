import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  Search,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  MessageCircle,
  Clock,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
  UserMinus,
} from 'lucide-react';
import { Language } from '../types';

export interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline';
  bio: string;
  location?: string;
  age?: number;
}

export interface FriendRequest {
  id: string;
  name: string;
  avatar: string;
  time: string;
  bio: string;
  matchScore: number;
  userId?: string;
}

interface FriendsViewProps {
  lang: Language;
  onBack: () => void;
  onStartChat: (friend: { id: string; name: string; avatar: string; status: 'online' | 'offline'; bio?: string }) => void;
  currentUserId?: string;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  lang,
  onBack,
  onStartChat,
  currentUserId,
}) => {
  const isAr = lang === 'ar';

  // Active Main Tab: 'requests' | 'friends'
  const [activeTab, setActiveTab] = useState<'requests' | 'friends'>('requests');

  // Requests sub-tab: 'incoming' | 'sent'
  const [requestsSubTab, setRequestsSubTab] = useState<'incoming' | 'sent'>('incoming');

  // Friends search filter
  const [friendsSearchQuery, setFriendsSearchQuery] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Friends & Requests data
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sent requests persisted in localStorage
  const [sentRequestsList, setSentRequestsList] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('soulx_sent_requests_details');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const getEffectiveUserId = () => {
    if (currentUserId) return currentUserId;
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('soulx_auth_user') || '{}');
        if (u?.id) return u.id;
      } catch {}
    }
    return '549182301';
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Fetch Friends and Incoming Requests from backend
  const loadFriendsAndRequests = async () => {
    setIsLoading(true);
    setError(null);
    const uid = getEffectiveUserId();

    try {
      const res = await fetch(`/api/friends/list?userId=${encodeURIComponent(uid)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        if (Array.isArray(data.friends)) {
          setFriends(data.friends);
          if (typeof window !== 'undefined') {
            const ids = data.friends.map((f: any) => f.id);
            localStorage.setItem('soulx_friends_list', JSON.stringify(ids));
          }
        }
        if (Array.isArray(data.incomingRequests)) {
          setIncomingRequests(
            data.incomingRequests.map((r: any) => ({
              id: r.id,
              userId: r.senderId || r.userId,
              name: r.senderName || r.name,
              avatar:
                r.senderAvatar ||
                r.avatar ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
              time: r.createdAt ? new Date(r.createdAt).toLocaleDateString() : isAr ? 'اليوم' : 'Today',
              bio: r.senderBio || r.bio || (isAr ? 'عضو مسجل في Soul-X' : 'Member in Soul-X'),
              matchScore: r.matchScore || 96,
            }))
          );
        }
      } else {
        throw new Error(data.message || 'Failed to load friends');
      }
    } catch (err: any) {
      setError(
        isAr
          ? 'تعذر تحميل بيانات الأصدقاء والطلبات. يرجى التحقق من الاتصال.'
          : 'Failed to load friends and requests. Please check connection.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFriendsAndRequests();
  }, []);

  // Sync sent requests with window event
  useEffect(() => {
    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem('soulx_sent_requests_details');
        if (saved) setSentRequestsList(JSON.parse(saved));
        else setSentRequestsList([]);
      } catch {}
    };
    window.addEventListener('soulx_friend_requests_updated', handleUpdate);
    return () => window.removeEventListener('soulx_friend_requests_updated', handleUpdate);
  }, []);

  // Accept incoming request
  const handleAcceptRequest = async (request: FriendRequest) => {
    const uid = getEffectiveUserId();

    try {
      await fetch('/api/friends/respond-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          action: 'accept',
          userId: uid,
        }),
      });
    } catch {}

    const newFriend: Friend = {
      id: request.userId || `fr-${Date.now()}`,
      name: request.name,
      avatar: request.avatar,
      status: 'online',
      bio: request.bio,
    };

    setFriends((prev) => [newFriend, ...prev]);
    setIncomingRequests((prev) => prev.filter((r) => r.id !== request.id));
    showToast(isAr ? `تم قبول طلب الصداقة من ${request.name} بنجاح! ✨` : `Accepted friend request from ${request.name}!`);
  };

  // Decline incoming request
  const handleDeclineRequest = async (requestId: string, name: string) => {
    const uid = getEffectiveUserId();
    try {
      await fetch('/api/friends/respond-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action: 'decline',
          userId: uid,
        }),
      });
    } catch {}

    setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId));
    showToast(isAr ? `تم رفض طلب ${name}` : `Declined request from ${name}`);
  };

  // Cancel sent request
  const handleCancelSentRequest = (targetUserId: string, name: string) => {
    const updated = sentRequestsList.filter((r) => r.userId !== targetUserId);
    setSentRequestsList(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('soulx_sent_requests_details', JSON.stringify(updated));
      const savedIds = JSON.parse(localStorage.getItem('soulx_sent_friend_requests') || '[]');
      localStorage.setItem(
        'soulx_sent_friend_requests',
        JSON.stringify(savedIds.filter((id: string) => id !== targetUserId))
      );
      window.dispatchEvent(new Event('soulx_friend_requests_updated'));
    }
    showToast(isAr ? `تم إلغاء الطلب المرسل إلى ${name}` : `Cancelled request sent to ${name}`);
  };

  // Remove friend
  const handleRemoveFriend = (friendId: string, name: string) => {
    setFriends((prev) => prev.filter((f) => f.id !== friendId));
    if (typeof window !== 'undefined') {
      const current = JSON.parse(localStorage.getItem('soulx_friends_list') || '[]');
      localStorage.setItem(
        'soulx_friends_list',
        JSON.stringify(current.filter((id: string) => id !== friendId))
      );
    }
    showToast(isAr ? `تمت إزالة ${name} من قائمة الأصدقاء` : `Removed ${name} from friends`);
  };

  // Filtered friends
  const filteredFriends = friends.filter((f) =>
    f.name.toLowerCase().includes(friendsSearchQuery.toLowerCase()) ||
    f.bio.toLowerCase().includes(friendsSearchQuery.toLowerCase())
  );

  return (
    <div className="w-full flex-1 flex flex-col bg-neutral-50 dark:bg-neutral-950 min-h-screen animate-in fade-in duration-200">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-cyan-500 text-neutral-950 font-bold text-xs sm:text-sm shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================
          STICKY TOP NAVIGATION BAR (WITH BACK BUTTON)
          ======================================================== */}
      <div className="sticky top-16 z-30 w-full bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* زر العودة (Back Button) */}
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-neutral-100 dark:bg-neutral-900 hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 shrink-0 group border border-neutral-200/80 dark:border-neutral-800"
          >
            {isAr ? (
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            ) : (
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            )}
            <span>{isAr ? 'العودة للمحادثات' : 'Back to Chats'}</span>
          </button>

          {/* Page Title & Counters */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <h1 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white truncate">
              {isAr ? 'الأصدقاء وطلبات الصداقة' : 'Friends & Requests'}
            </h1>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadFriendsAndRequests}
            className="p-2 rounded-xl text-neutral-500 hover:text-cyan-500 hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors cursor-pointer shrink-0"
            title={isAr ? 'تحديث البيانات' : 'Refresh data'}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ========================================================
          PAGE MAIN CONTAINER
          ======================================================== */}
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1 pb-24">
        {/* Main Tab Navigation Buttons */}
        <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs">
          {/* Tab 1: طلبات الصداقة */}
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'requests'
                ? 'bg-cyan-400 text-neutral-950 shadow-md font-black'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>{isAr ? 'طلبات الصداقة' : 'Requests'}</span>
            {incomingRequests.length > 0 && (
              <span className={`w-5 h-5 rounded-full font-mono text-[10px] font-black flex items-center justify-center shadow-xs ${
                activeTab === 'requests' ? 'bg-neutral-950 text-white' : 'bg-rose-500 text-white'
              }`}>
                {incomingRequests.length}
              </span>
            )}
          </button>

          {/* Tab 2: قائمة الأصدقاء */}
          <button
            type="button"
            onClick={() => setActiveTab('friends')}
            className={`py-3 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'friends'
                ? 'bg-cyan-400 text-neutral-950 shadow-md font-black'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>{isAr ? 'الأصدقاء' : 'My Friends'}</span>
            <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold ${
              activeTab === 'friends' ? 'bg-neutral-950/20 text-neutral-950' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
            }`}>
              {friends.length}
            </span>
          </button>
        </div>

        {/* Global Loading / Error */}
        {isLoading && (
          <div className="py-16 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
            <p className="text-xs sm:text-sm text-neutral-500">
              {isAr ? 'جاري تحميل قائمة الأصدقاء والطلبات...' : 'Loading friends and requests...'}
            </p>
          </div>
        )}

        {error && !isLoading && (
          <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-xs sm:text-sm text-rose-600 dark:text-rose-400 font-bold">{error}</p>
            <button
              type="button"
              onClick={loadFriendsAndRequests}
              className="px-4 py-2 rounded-xl bg-cyan-400 text-neutral-950 font-bold text-xs cursor-pointer shadow-sm"
            >
              {isAr ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        )}

        {/* ========================================================
            TAB 1: طلبات الصداقة (الواردة والمرسلة)
            ======================================================== */}
        {!isLoading && !error && activeTab === 'requests' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Sub-tabs: الطلبات الواردة vs الطلبات المرسلة */}
            <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 pb-3">
              <button
                type="button"
                onClick={() => setRequestsSubTab('incoming')}
                className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  requestsSubTab === 'incoming'
                    ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <span>{isAr ? 'الطلبات الواردة' : 'Incoming Requests'}</span>
                <span className="font-mono text-xs px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-bold">
                  {incomingRequests.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRequestsSubTab('sent')}
                className={`py-2 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  requestsSubTab === 'sent'
                    ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 shadow-xs'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <span>{isAr ? 'الطلبات المرسلة' : 'Sent Requests'}</span>
                <span className="font-mono text-xs px-1.5 py-0.2 rounded-full bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 font-bold">
                  {sentRequestsList.length}
                </span>
              </button>
            </div>

            {/* Sub-tab 1: الطلبات الواردة */}
            {requestsSubTab === 'incoming' && (
              <div className="space-y-3">
                {incomingRequests.length === 0 ? (
                  <div className="py-16 text-center space-y-3 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8 shadow-xs">
                    <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mx-auto">
                      <UserCheck className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                      {isAr ? 'لا توجد طلبات صداقة واردة حالياً' : 'No incoming friend requests'}
                    </h3>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                      {isAr
                        ? 'عندما يرسل لك أي مستخدم طلب صداقة بواسطة معرّفك الخاص ستظهر هنا فورياً.'
                        : 'When someone sends you a friend request using your ID, it will appear here.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3.5">
                    {incomingRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4 relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3.5">
                            <img
                              src={req.avatar}
                              alt={req.name}
                              className="w-14 h-14 rounded-2xl object-cover border-2 border-cyan-500/30 shrink-0 shadow-sm"
                            />
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-black text-neutral-900 dark:text-white truncate">
                                  {req.name}
                                </h3>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono font-bold flex items-center gap-1 border border-cyan-500/20">
                                  <Sparkles className="w-2.5 h-2.5" />
                                  <span>{req.matchScore}% {isAr ? 'توافق روحي' : 'resonance'}</span>
                                </span>
                              </div>
                              <p className="text-xs text-neutral-500 line-clamp-1">{req.bio}</p>
                            </div>
                          </div>
                          <span className="text-[11px] font-mono text-neutral-400 shrink-0">{req.time}</span>
                        </div>

                        {/* Accept / Decline Action Buttons */}
                        <div className="flex items-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleAcceptRequest(req)}
                            className="flex-1 py-3 px-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-xs sm:text-sm transition-all cursor-pointer shadow-md active:scale-98 flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-4 h-4 stroke-[2.5]" />
                            <span>{isAr ? 'قبول الصداقة' : 'Accept Request'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeclineRequest(req.id, req.name)}
                            className="py-3 px-5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs sm:text-sm transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700 flex items-center justify-center gap-1.5"
                          >
                            <X className="w-4 h-4" />
                            <span>{isAr ? 'رفض' : 'Decline'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: الطلبات المرسلة */}
            {requestsSubTab === 'sent' && (
              <div className="space-y-3">
                {sentRequestsList.length === 0 ? (
                  <div className="py-16 text-center space-y-3 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8 shadow-xs">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                      <Clock className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                      {isAr ? 'لم تقم بإرسال أي طلبات صداقة بعد' : 'No sent friend requests'}
                    </h3>
                    <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                      {isAr
                        ? 'لا توجد طلبات صداقة مرسلة قيد الانتظار حالياً.'
                        : 'No pending sent friend requests currently.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3.5">
                    {sentRequestsList.map((req) => (
                      <div
                        key={req.id || req.userId}
                        className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img
                            src={req.avatar}
                            alt={req.name}
                            className="w-12 h-12 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                          />
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-neutral-900 dark:text-white truncate">
                                {req.name}
                              </h3>
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                <Clock className="w-3 h-3 animate-pulse" />
                                <span>{isAr ? 'قيد الانتظار' : 'Pending'}</span>
                              </span>
                            </div>
                            {req.bio && <p className="text-xs text-neutral-500 truncate">{req.bio}</p>}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCancelSentRequest(req.userId, req.name)}
                          className="py-2 px-3.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-xs transition-colors cursor-pointer shrink-0 border border-neutral-200 dark:border-neutral-700"
                        >
                          {isAr ? 'إلغاء الطلب' : 'Cancel'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            TAB 2: قائمة الأصدقاء (MY FRIENDS)
            ======================================================== */}
        {!isLoading && !error && activeTab === 'friends' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Search within Friends */}
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute right-4 top-1/2 -translate-y-1/2 rtl:right-4 rtl:left-auto ltr:left-4 ltr:right-auto pointer-events-none" />
              <input
                type="text"
                value={friendsSearchQuery}
                onChange={(e) => setFriendsSearchQuery(e.target.value)}
                placeholder={isAr ? 'البحث في قائمة أصدقائي...' : 'Search within my friends...'}
                className="w-full h-12 pr-11 pl-4 rtl:pr-11 rtl:pl-4 ltr:pl-11 ltr:pr-4 text-xs sm:text-sm rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-cyan-500 transition-colors shadow-xs"
              />
            </div>

            {friends.length === 0 ? (
              <div className="py-16 text-center space-y-3 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8 shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mx-auto">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'لم تقم بإضافة أصدقاء بعد' : 'No friends added yet'}
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                  {isAr
                    ? 'يمكنك قبول طلبات الصداقة المعلقة لبدء التواصل مع الأصدقاء.'
                    : 'Accept pending friend requests to start connecting with friends.'}
                </p>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">
                {isAr ? 'لا توجد نتائج مطابقة لبحثك في قائمة الأصدقاء' : 'No friends match your search query'}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="p-4 sm:p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/40 transition-all shadow-xs flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={friend.avatar}
                          alt={friend.name}
                          className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-700 shadow-2xs"
                        />
                        {friend.status === 'online' && (
                          <span className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute -bottom-0.5 -right-0.5" />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white truncate">
                            {friend.name}
                          </h3>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
                            {isAr ? 'صديق' : 'Friend'}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate max-w-sm">
                          {friend.bio || (isAr ? 'صديق في Soul-X' : 'Friend on Soul-X')}
                        </p>
                      </div>
                    </div>

                    {/* Actions: Start Chat & Remove */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onStartChat(friend)}
                        className="py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-xs transition-all cursor-pointer shadow-sm active:scale-95 flex items-center gap-1.5"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{isAr ? 'محادثة' : 'Chat'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveFriend(friend.id, friend.name)}
                        className="p-2.5 rounded-xl text-neutral-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors cursor-pointer border border-transparent hover:border-rose-500/20"
                        title={isAr ? 'إزالة الصديق' : 'Remove Friend'}
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
