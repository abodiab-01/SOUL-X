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
  ShieldCheck,
  HeartHandshake,
} from 'lucide-react';
import { Language, SearchUserResult } from '../types';
import { SAMPLE_SEARCH_USERS } from '../data/searchUsers';

interface FriendSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onNavigateToChats?: (friendName?: string) => void;
}

export const FriendSearchModal: React.FC<FriendSearchModalProps> = ({
  isOpen,
  onClose,
  lang,
  onNavigateToChats,
}) => {
  const isAr = lang === 'ar';
  const [searchQuery, setSearchQuery] = useState('');
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

  // Keep localStorage updated
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

  // Send friend request handler
  const handleSendRequest = async (user: SearchUserResult) => {
    setIsSubmitting(user.id);
    try {
      // Send to server if online
      fetch('/api/friends/send-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: user.id,
          targetUserName: user.name,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});

      // Add to local state
      const updated = Array.from(new Set([...sentRequests, user.id]));
      saveSentRequests(updated);

      // Also record pending request in localStorage for chats view
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

  // Cancel friend request handler
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

  // Direct chat with friend
  const handleStartChat = (user: SearchUserResult) => {
    onClose();
    if (onNavigateToChats) {
      onNavigateToChats(user.name);
    }
  };

  // Real users pool from database
  const [allUsers, setAllUsers] = useState<SearchUserResult[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Fetch real registered users from backend database
    fetch('/api/users/search?q=')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.users)) {
          setAllUsers(data.users);
        }
      })
      .catch(() => {});
  }, []);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="absolute top-3 left-4 right-4 z-30 animate-in slide-in-from-top duration-300">
            <div className="px-4 py-3 rounded-2xl bg-cyan-500 text-neutral-950 font-semibold text-xs sm:text-sm shadow-xl flex items-center justify-between gap-2 border border-cyan-400">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{toastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="p-1 rounded-full hover:bg-cyan-600/20 text-neutral-950"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Search className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white leading-tight">
                {isAr ? 'البحث عن صديق بالمعرّف الرقمي (ID)' : 'Search Friend by ID'}
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {isAr
                  ? 'ابحث بالمعرف الرقمي الخاص أو الاسم وأرسل طلب صداقة فورياً'
                  : 'Search by unique numerical ID or name & send a friend request'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Input Box */}
        <div className="p-4 sm:p-5 space-y-3 border-b border-neutral-100 dark:border-neutral-800/80 bg-white dark:bg-neutral-900">
          <div className="relative">
            <Search className="w-5 h-5 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 rtl:right-3.5 rtl:left-auto ltr:left-3.5 ltr:right-auto pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAr
                  ? 'أدخل المعرف الرقمي (مثال: 98234105)...'
                  : 'Enter user ID (e.g. 98234105)...'
              }
              className="w-full py-3 px-10 text-sm rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none transition-all font-mono tracking-wide"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 rtl:left-3 rtl:right-auto ltr:right-3 ltr:left-auto p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick clickable test IDs for instant testing */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-neutral-500 font-medium">
              <span>{isAr ? 'معرّفات مقترحة للتجربة السريعة:' : 'Sample IDs to test with:'}</span>
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400">
                {isAr ? 'اضغط لتعبئة المعرف' : 'Click to autofill'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: '98234105', name: isAr ? 'ريما' : 'Rima' },
                { id: '47190283', name: isAr ? 'فيصل' : 'Faisal' },
                { id: '11029384', name: isAr ? 'نورة' : 'Noura' },
                { id: '73829104', name: isAr ? 'ليندا' : 'Linda' },
                { id: '549182301', name: isAr ? 'سلطان' : 'Sultan' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSearchQuery(item.id)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-colors border cursor-pointer flex items-center gap-1.5 ${
                    searchQuery === item.id
                      ? 'bg-cyan-500/20 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold'
                      : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800/80 dark:hover:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <span className="font-semibold text-[11px]">{item.name}</span>
                  <span className="text-neutral-400 text-[10px]">({item.id})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results List Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
          {!queryTrimmed ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6 stroke-[2]" />
              </div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                {isAr ? 'ابحث عن أصدقاء جدد' : 'Find new friends'}
              </h3>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
                {isAr
                  ? 'اكتب المعرف الرقمي الخاص بالصديق (مثلاً: 98234105) في خانة البحث أعلاه لإرسال طلب صداقة والتواصل مباشرة.'
                  : 'Type a friend’s unique numerical ID above to send them a friend request.'}
              </p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">
                <X className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                {isAr ? 'لم يتم العثور على مستخدم بهذا المعرف' : 'No user found with this ID'}
              </h4>
              <p className="text-xs text-neutral-500">
                {isAr
                  ? 'تأكد من كتابة المعرف الرقمي بشكل صحيح، أو جرب أحد المعرفات المقترحة أعلاه.'
                  : 'Double-check the ID or try one of the suggested sample IDs above.'}
              </p>
            </div>
          ) : (
            searchResults.map((user) => {
              const isFriend = friendIds.includes(user.id);
              const hasSentRequest = sentRequests.includes(user.id);
              const isSending = isSubmitting === user.id;

              return (
                <div
                  key={user.id}
                  className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/40 transition-all duration-200 shadow-xs space-y-3.5 group"
                >
                  {/* User Profile Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Avatar with Status badge */}
                      <div className="relative shrink-0">
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-white dark:border-neutral-800 shadow-xs"
                        />
                        {user.status === 'online' && (
                          <span
                            className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute bottom-0 right-0"
                            title={isAr ? 'متصل الآن' : 'Online'}
                          />
                        )}
                      </div>

                      {/* Name & ID */}
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white truncate">
                            {user.name}
                          </h3>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono font-bold flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>{user.matchScore}% {isAr ? 'توافق' : 'match'}</span>
                          </span>
                        </div>

                        {/* Unique numerical ID badge with copy button */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <span className="text-xs font-mono font-semibold text-neutral-600 dark:text-neutral-400 bg-neutral-200/60 dark:bg-neutral-800/80 px-2 py-0.5 rounded-md tabular-nums flex items-center gap-1">
                            <span className="text-[10px] text-neutral-400 font-sans">ID:</span>
                            <span>{user.id}</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyId(user.id, e)}
                            className="p-1 rounded text-neutral-400 hover:text-cyan-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                            title={isAr ? 'نسخ المعرف' : 'Copy ID'}
                          >
                            {copiedId === user.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Location & Age Tag */}
                    {(user.location || user.age) && (
                      <div className="text-[11px] text-neutral-500 font-medium flex items-center gap-1 shrink-0 pt-1">
                        {user.location && (
                          <span className="flex items-center gap-0.5">
                            <MapPin className="w-3 h-3 text-neutral-400" />
                            <span>{user.location}</span>
                          </span>
                        )}
                        {user.age && <span>• {user.age} {isAr ? 'سنة' : 'yrs'}</span>}
                      </div>
                    )}
                  </div>

                  {/* Bio Description */}
                  <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-white dark:bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-800/80">
                    {user.bio}
                  </p>

                  {/* Action Buttons: Friend Request / Accepted / Cancel */}
                  <div className="pt-1 flex items-center justify-between gap-2">
                    {isFriend ? (
                      /* حالة: أصدقاء بالفعل */
                      <div className="w-full flex items-center gap-2">
                        <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5">
                          <UserCheck className="w-4 h-4" />
                          <span>{isAr ? 'أنتما صديقان بالفعل' : 'You are friends'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleStartChat(user)}
                          className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>{isAr ? 'محادثة' : 'Chat'}</span>
                        </button>
                      </div>
                    ) : hasSentRequest ? (
                      /* حالة: تم إرسال الطلب (مع إمكانية الإلغاء) */
                      <div className="w-full flex items-center gap-2">
                        <div className="flex-1 py-2 px-3.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center justify-center gap-1.5">
                          <Clock className="w-4 h-4 animate-pulse text-amber-500" />
                          <span>{isAr ? 'تم إرسال طلب الصداقة ✓' : 'Friend Request Sent ✓'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCancelRequest(user.id, user.name)}
                          className="py-2 px-3 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-medium transition-colors cursor-pointer shrink-0"
                          title={isAr ? 'إلغاء الطلب' : 'Cancel Request'}
                        >
                          {isAr ? 'إلغاء الطلب' : 'Cancel'}
                        </button>
                      </div>
                    ) : (
                      /* حالة: زر إرسال طلب الصداقة */
                      <button
                        type="button"
                        disabled={isSending}
                        onClick={() => handleSendRequest(user)}
                        className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer shadow-md hover:shadow-cyan-500/20 active:scale-98 flex items-center justify-center gap-2 group"
                      >
                        {isSending ? (
                          <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4 stroke-[2.2] transition-transform group-hover:scale-110" />
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
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:px-5 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center gap-1.5">
            <HeartHandshake className="w-4 h-4 text-rose-500" />
            <span>
              {isAr
                ? 'تواصل راقي وبداية صداقات صادقة في Soul-X'
                : 'Soulful connections & genuine friends in Soul-X'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold transition-colors cursor-pointer"
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
