import React, { useState, useEffect } from 'react';
import {
  Search,
  UserPlus,
  UserCheck,
  Check,
  Copy,
  X,
  Sparkles,
  MapPin,
  MessageCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Language, SearchUserResult } from '../types';

interface FriendSearchViewProps {
  lang: Language;
  onBack: () => void;
  onNavigateToChats?: (friendName?: string) => void;
  initialQuery?: string;
}

export const FriendSearchView: React.FC<FriendSearchViewProps> = ({
  lang,
  onBack,
  onNavigateToChats,
  initialQuery = '',
}) => {
  const isAr = lang === 'ar';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  // Sent friend requests (persisted in localStorage)
  const [sentRequests, setSentRequests] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('soulx_sent_friend_requests');
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return [];
  });

  // Current friends (persisted in localStorage or database)
  const [friendIds, setFriendIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('soulx_friends_list');
        if (saved) return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return [];
  });

  // Real users pool from database
  const [allUsers, setAllUsers] = useState<SearchUserResult[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    setUsersError(null);
    try {
      const res = await fetch('/api/users/search?q=');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setAllUsers(data.users);
      } else {
        throw new Error(data.message || 'Failed to load users');
      }
    } catch (err: any) {
      setUsersError(
        isAr
          ? 'تعذر الاتصال بقاعدة البيانات لجلب قائمة المستخدمين. يرجى التحقق من الاتصال.'
          : 'Failed to connect to database to fetch users.'
      );
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();

    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem('soulx_friends_list');
        if (saved) setFriendIds(JSON.parse(saved));
        else setFriendIds([]);
      } catch {}
    };
    window.addEventListener('soulx_friends_updated', handleUpdate);
    return () => window.removeEventListener('soulx_friends_updated', handleUpdate);
  }, []);

  const saveSentRequests = (list: string[]) => {
    setSentRequests(list);
    if (typeof window !== 'undefined') {
      localStorage.setItem('soulx_sent_friend_requests', JSON.stringify(list));
      window.dispatchEvent(new Event('soulx_friend_requests_updated'));
    }
  };

  const handleCopyId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleSendRequest = async (user: SearchUserResult) => {
    setIsSubmitting(user.id);

    let senderId = 'guest-user';
    let senderName = 'مستخدم Soul-X';
    let senderAvatar: string | undefined = undefined;
    let senderBio: string | undefined = undefined;
    let senderDisplayId: string | undefined = undefined;

    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('soulx_auth_user') || '{}');
        if (u?.id || u?.displayId) {
          senderId = u.id || u.displayId;
          senderName = u.name || senderName;
          senderAvatar = u.photoUrl;
          senderBio = u.bio;
          senderDisplayId = u.displayId || u.id;
        }
      } catch {}
    }

    try {
      await fetch('/api/friends/send-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId,
          senderName,
          senderAvatar,
          senderBio,
          senderDisplayId,
          targetUserId: (user as any).originalId || user.id,
          targetUserName: user.name,
          targetUserAvatar: user.avatar,
          targetUserBio: user.bio,
          targetUserDisplayId: user.id,
          timestamp: new Date().toISOString(),
        }),
      });

      const updated = Array.from(new Set([...sentRequests, user.id]));
      saveSentRequests(updated);

      try {
        const existingSent = JSON.parse(localStorage.getItem('soulx_sent_requests_details') || '[]');
        const newReq = {
          id: `sent-${user.id}-${Date.now()}`,
          userId: user.id,
          name: user.name,
          avatar: user.avatar,
          bio: user.bio,
          time: isAr ? 'الآن' : 'Just now',
          status: 'pending',
        };
        localStorage.setItem(
          'soulx_sent_requests_details',
          JSON.stringify([newReq, ...existingSent.filter((r: any) => r.userId !== user.id)])
        );
      } catch {
        // ignore
      }

      showToast(
        isAr
          ? `تم إرسال طلب الصداقة إلى ${user.name} بنجاح! ✨`
          : `Friend request sent to ${user.name} successfully! ✨`
      );
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleCancelRequest = (userId: string, userName: string) => {
    const updated = sentRequests.filter((id) => id !== userId);
    saveSentRequests(updated);

    try {
      const existingSent = JSON.parse(localStorage.getItem('soulx_sent_requests_details') || '[]');
      localStorage.setItem(
        'soulx_sent_requests_details',
        JSON.stringify(existingSent.filter((r: any) => r.userId !== userId))
      );
    } catch {
      // ignore
    }

    showToast(
      isAr
        ? `تم إلغاء طلب الصداقة المرسل إلى ${userName}`
        : `Cancelled friend request to ${userName}`
    );
  };

  const handleStartChat = (user: SearchUserResult) => {
    if (onNavigateToChats) {
      onNavigateToChats(user.name);
    }
  };

  // Filtered users matching query
  const queryTrimmed = searchQuery.trim().toLowerCase();
  const searchResults = queryTrimmed
    ? allUsers.filter((u) => {
        const idMatch = u.id.toLowerCase().includes(queryTrimmed);
        const nameMatch = u.name.toLowerCase().includes(queryTrimmed);
        const nameEnMatch = u.nameEn?.toLowerCase().includes(queryTrimmed);
        const usernameMatch = u.username?.toLowerCase().includes(queryTrimmed.replace('@', ''));
        return idMatch || nameMatch || nameEnMatch || usernameMatch;
      })
    : [];

  return (
    <div className="w-full flex-1 flex flex-col bg-neutral-50 dark:bg-neutral-950 animate-in fade-in duration-200">
      {/* Top sticky navigation bar */}
      <div className="sticky top-16 z-30 w-full bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer group"
          >
            {isAr ? (
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            ) : (
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            )}
            <span>{isAr ? 'العودة للمطابقة' : 'Back to Matching'}</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400">
            <Search className="w-3.5 h-3.5" />
            <span>{isAr ? 'البحث بالمعرّف الرقمي (ID)' : 'Search by ID'}</span>
          </div>
        </div>
      </div>

      {/* Floating toast message */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-cyan-500 text-neutral-950 font-bold text-xs sm:text-sm shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Page Content */}
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 flex-1">
        {/* Search header card */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white flex items-center gap-2.5">
              <Search className="w-6 h-6 text-cyan-500" />
              <span>{isAr ? 'البحث عن صديق بالمعرّف الرقمي (ID)' : 'Search Friend by ID'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {isAr
                ? 'أدخل المعرف الرقمي الخاص بالصديق للوصول المباشر إلى ملفه وإرسال طلب صداقة.'
                : 'Enter friend’s unique numerical ID to view profile and send a friend request.'}
            </p>
          </div>

          {/* Search input field */}
          <div className="relative">
            <Search className="w-5 h-5 text-neutral-400 absolute right-4 top-1/2 -translate-y-1/2 rtl:right-4 rtl:left-auto ltr:left-4 ltr:right-auto pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAr
                  ? 'اكتب المعرف الرقمي (مثال: 98234105 أو S-0101V77-X711)...'
                  : 'Enter user ID (e.g. 98234105)...'
              }
              className="w-full h-12 pr-11 pl-11 rtl:pr-11 rtl:pl-11 ltr:pl-11 ltr:pr-11 text-sm rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none transition-all font-mono tracking-wide"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 rtl:left-3.5 rtl:right-auto ltr:right-3.5 ltr:left-auto p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results List */}
        <div className="space-y-4">
          {isLoadingUsers ? (
            <div className="py-14 text-center space-y-3 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
              <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                {isAr ? 'جاري الاتصال بقاعدة البيانات...' : 'Connecting to database...'}
              </h3>
            </div>
          ) : usersError ? (
            <div className="py-10 text-center space-y-3 rounded-3xl bg-rose-500/10 border border-rose-500/30 p-6">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400">{usersError}</h3>
              <button
                type="button"
                onClick={loadUsers}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs cursor-pointer shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isAr ? 'إعادة المحاولة' : 'Retry'}</span>
              </button>
            </div>
          ) : !queryTrimmed ? (
            <div className="py-14 text-center space-y-3 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mx-auto">
                <Search className="w-7 h-7 stroke-[2]" />
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                {isAr ? 'ابحث بالمعرف الرقمي الخاص' : 'Search by unique numerical ID'}
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                {isAr
                  ? 'أدخل المعرف الرقمي في خانة البحث أعلاه للعثور على أي مستخدم وإرسال طلب صداقة والتواصل المباشر.'
                  : 'Type a user’s unique numerical ID above to find them and send a friend request.'}
              </p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-14 text-center space-y-2 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6">
              <div className="w-14 h-14 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">
                <X className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-neutral-900 dark:text-white">
                {isAr ? 'لم يتم العثور على مستخدم بهذا المعرف في قاعدة البيانات' : 'No user found with this ID in database'}
              </h4>
              <p className="text-xs text-neutral-500">
                {isAr
                  ? 'تأكد من صحة المعرف الرقمي، أو اطلب من صديقك مشاركة معرفه المسجل.'
                  : 'Double-check the numerical ID or ask your friend to share their registered ID.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {searchResults.map((user) => {
                const isFriend = friendIds.includes(user.id);
                const hasSentRequest = sentRequests.includes(user.id);
                const isSending = isSubmitting === user.id;

                return (
                  <div
                    key={user.id}
                    className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/40 transition-all shadow-sm space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className="relative shrink-0">
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-neutral-200 dark:border-neutral-700 shadow-xs"
                          />
                          {user.status === 'online' && (
                            <span
                              className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute -bottom-1 -right-1"
                              title={isAr ? 'متصل الآن' : 'Online'}
                            />
                          )}
                        </div>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                              {user.name}
                            </h3>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono font-bold flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>{user.matchScore}% {isAr ? 'توافق' : 'match'}</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                              <span className="text-[10px] text-neutral-400">ID:</span>
                              <span>{user.id}</span>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyId(user.id, e)}
                              className="p-1 rounded text-neutral-400 hover:text-cyan-500 transition-colors cursor-pointer"
                              title={isAr ? 'نسخ المعرف' : 'Copy ID'}
                            >
                              {copiedId === user.id ? (
                                <Check className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {(user.location || user.age) && (
                        <div className="text-xs text-neutral-500 font-medium flex items-center gap-1 shrink-0 pt-1">
                          {user.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-neutral-400" />
                              <span>{user.location}</span>
                            </span>
                          )}
                          {user.age && <span>• {user.age} {isAr ? 'سنة' : 'yrs'}</span>}
                        </div>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-neutral-950/60 p-3 rounded-2xl border border-neutral-100 dark:border-neutral-800/80">
                      {user.bio}
                    </p>

                    <div className="pt-1">
                      {isFriend ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5">
                            <UserCheck className="w-4 h-4" />
                            <span>{isAr ? 'أنتما صديقان بالفعل' : 'You are friends'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartChat(user)}
                            className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>{isAr ? 'محادثة' : 'Chat'}</span>
                          </button>
                        </div>
                      ) : hasSentRequest ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 py-2.5 px-3.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5">
                            <Clock className="w-4 h-4 animate-pulse text-amber-500" />
                            <span>{isAr ? 'تم إرسال طلب الصداقة ✓' : 'Friend Request Sent ✓'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCancelRequest(user.id, user.name)}
                            className="py-2.5 px-4 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition-colors cursor-pointer shrink-0"
                          >
                            {isAr ? 'إلغاء الطلب' : 'Cancel'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isSending}
                          onClick={() => handleSendRequest(user)}
                          className="w-full py-3 px-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-md active:scale-98 flex items-center justify-center gap-2"
                        >
                          {isSending ? (
                            <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <UserPlus className="w-4 h-4 stroke-[2.2]" />
                          )}
                          <span>
                            {isSending
                              ? isAr
                                ? 'جاري إرسال الطلب...'
                                : 'Sending...'
                              : isAr
                              ? 'إرسال طلب صداقة'
                              : 'Send Friend Request'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
