import React, { useState, useEffect, useRef } from 'react';
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
  Loader2,
  Globe,
  Calendar,
  AlertCircle,
  Info,
  User,
} from 'lucide-react';
import { Language, AuthUser, SearchUserResult } from '../types';

interface HomeViewProps {
  lang: Language;
  currentUser: AuthUser | null;
  onNavigateToTab: (tab: 'home' | 'match' | 'chats' | 'account') => void;
  onGoToChat: (friendName?: string) => void;
  onOpenWallet: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  lang,
  currentUser,
  onNavigateToTab,
  onGoToChat,
  onOpenWallet,
}) => {
  const isAr = lang === 'ar';
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedMyId, setCopiedMyId] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [searchAlert, setSearchAlert] = useState<{
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Sent friend requests (persisted in localStorage)
  const [sentRequests, setSentRequests] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('soulx_sent_friend_requests');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  // Current friends list (persisted in localStorage)
  const [friendIds, setFriendIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('soulx_friends_list');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  // Keep friend lists in sync with custom events
  useEffect(() => {
    const handleUpdate = () => {
      try {
        const savedFriends = JSON.parse(localStorage.getItem('soulx_friends_list') || '[]');
        setFriendIds(savedFriends);
        const friendSet = new Set(savedFriends);
        const savedSent = JSON.parse(localStorage.getItem('soulx_sent_friend_requests') || '[]');
        setSentRequests(savedSent.filter((id: string) => !friendSet.has(id)));
      } catch {}
    };
    window.addEventListener('soulx_friends_updated', handleUpdate);
    window.addEventListener('soulx_friend_requests_updated', handleUpdate);
    return () => {
      window.removeEventListener('soulx_friends_updated', handleUpdate);
      window.removeEventListener('soulx_friend_requests_updated', handleUpdate);
    };
  }, []);

  const saveSentRequests = (list: string[]) => {
    setSentRequests(list);
    if (typeof window !== 'undefined') {
      localStorage.setItem('soulx_sent_friend_requests', JSON.stringify(list));
      window.dispatchEvent(new Event('soulx_friend_requests_updated'));
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleCopyId = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      showToast(isAr ? 'تم نسخ المعرف بنجاح!' : 'ID copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCopyMyId = () => {
    const myId = currentUser?.displayId || currentUser?.id || '';
    if (!myId) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(myId);
      setCopiedMyId(true);
      showToast(isAr ? 'تم نسخ معرّفك لمشاركته مع أصدقائك! 📋' : 'Your ID copied to share with friends! 📋');
      setTimeout(() => setCopiedMyId(false), 2000);
    }
  };

  // Perform backend search for friends by ID / name
  const searchTimeoutRef = useRef<any>(null);

  const executeSearch = async (queryToSearch: string) => {
    const cleanQ = queryToSearch.trim();
    if (!cleanQ) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setSearchAlert(null);
      return;
    }

    setIsSearching(true);
    setSearchAlert({
      type: 'info',
      message: isAr
        ? 'جاري البحث عن الصديق بالمعرف في قاعدة البيانات...'
        : 'Searching database for friend ID...',
    });

    let currentUid = '';
    if (currentUser?.id) currentUid = currentUser.id;
    else if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('soulx_auth_user') || '{}');
        if (u?.id) currentUid = u.id;
      } catch {}
    }

    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(cleanQ)}&currentUserId=${encodeURIComponent(currentUid)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success && Array.isArray(data.users)) {
        setSearchResults(data.users);
        setHasSearched(true);
        if (data.users.length > 0) {
          setSearchAlert({
            type: 'success',
            message: isAr
              ? `تم العثور على (${data.users.length}) مستخدم يطابق البحث بنجاح! ✨`
              : `Found (${data.users.length}) matching user(s) successfully! ✨`,
          });
        } else {
          setSearchAlert({
            type: 'warning',
            message: isAr
              ? `لم يتم العثور على أي مستخدم بالمعرف: "${cleanQ}". تأكد من كتابة ID الحساب بشكل دقيق (مثال: S-0101V77-X711).`
              : `No user found with ID: "${cleanQ}". Please verify the registered ID (e.g. S-0101V77-X711).`,
          });
        }
      } else {
        throw new Error(data.message || 'Search failed');
      }
    } catch (err) {
      setSearchAlert({
        type: 'error',
        message: isAr
          ? 'تعذر الاتصال بقاعدة البيانات للبحث. يرجى التحقق من الاتصال والمحاولة مجدداً.'
          : 'Could not connect to database for search. Please check your connection and try again.',
      });
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced auto-search when typing
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      setSearchAlert(null);
      return;
    }

    // Set immediate indicator that search is pending
    setIsSearching(true);
    setSearchAlert({
      type: 'info',
      message: isAr
        ? 'جاري البحث عن الصديق بالمعرف في قاعدة البيانات...'
        : 'Searching database for friend ID...',
    });

    searchTimeoutRef.current = setTimeout(() => {
      executeSearch(trimmed);
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, currentUser?.id]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    executeSearch(searchQuery);
  };

  // Send friend request
  const handleSendRequest = async (user: SearchUserResult) => {
    const targetId = user.displayId || user.id;
    setIsSubmitting(targetId);
    const senderId = currentUser?.displayId || currentUser?.id || 'guest-user';
    const senderName = currentUser?.name || 'مستخدم Soul-X';

    try {
      const res = await fetch('/api/friends/send-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId,
          senderName,
          senderAvatar: currentUser?.photoUrl,
          senderBio: currentUser?.bio,
          senderDisplayId: currentUser?.displayId,
          targetUserId: user.id,
          targetUserDisplayId: user.displayId || user.id,
          targetUserName: user.name,
          targetUserAvatar: user.avatar,
          targetUserBio: user.bio,
          timestamp: new Date().toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));

      const targetIdentifier = user.id;
      const displayIdentifier = user.displayId;
      const updated = Array.from(new Set([...sentRequests, targetIdentifier, ...(displayIdentifier ? [displayIdentifier] : [])]));
      saveSentRequests(updated);

      try {
        const existingSent = JSON.parse(localStorage.getItem('soulx_sent_requests_details') || '[]');
        const newReq = {
          id: `sent-${user.id}-${Date.now()}`,
          userId: user.id,
          displayId: user.displayId || user.id,
          name: user.name,
          avatar: user.avatar,
          bio: user.bio,
          country: user.country,
          age: user.age,
          time: isAr ? 'الآن' : 'Just now',
          status: 'pending',
        };
        localStorage.setItem(
          'soulx_sent_requests_details',
          JSON.stringify([newReq, ...existingSent.filter((r: any) => r.userId !== user.id && r.displayId !== user.displayId)])
        );
      } catch {}

      showToast(
        isAr
          ? `تم إرسال طلب الصداقة إلى ${user.name} بنجاح! ✨`
          : `Friend request sent to ${user.name} successfully! ✨`
      );
    } catch (e) {
      showToast(isAr ? 'تعذر إرسال الطلب، يرجى المحاولة لاحقاً' : 'Failed to send request, please try again');
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleCancelRequest = async (userId: string, userName: string, displayId?: string) => {
    const updated = sentRequests.filter((id) => id !== userId && (!displayId || id !== displayId));
    saveSentRequests(updated);

    try {
      const existingSent = JSON.parse(localStorage.getItem('soulx_sent_requests_details') || '[]');
      localStorage.setItem(
        'soulx_sent_requests_details',
        JSON.stringify(existingSent.filter((r: any) => r.userId !== userId && (!displayId || r.displayId !== displayId)))
      );
    } catch {}

    try {
      const senderId = currentUser?.displayId || currentUser?.id || '549182301';
      await fetch('/api/friends/cancel-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId,
          targetUserId: userId,
        }),
      });
    } catch {}

    showToast(
      isAr
        ? `تم إلغاء طلب الصداقة المرسل إلى ${userName}`
        : `Cancelled friend request to ${userName}`
    );
  };

  const handleStartChat = (user: SearchUserResult) => {
    onGoToChat(user.name);
  };

  const myDisplayId = currentUser?.displayId || currentUser?.id || 'S-0101V77-X711';

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col py-2 px-2 sm:px-4 space-y-6 animate-in fade-in duration-300">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-cyan-500 text-neutral-950 font-bold text-xs sm:text-sm shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================
          1. رأس الصفحة: خانة البحث عن صديق بالمعرف
          Header Search Box by ID
          ======================================================== */}
      <div className="p-5 sm:p-7 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4 relative overflow-hidden">
        {/* Ambient glow accent */}
        <div className="w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl absolute -top-8 -left-8 pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <Search className="w-4 h-4" />
              </div>
              <span>{isAr ? 'البحث عن صديق بالمعرف' : 'Search Friend by ID'}</span>
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {isAr
                ? 'أدخل المعرف الرقمي الخاص بالصديق للوصول إلى ملفه الشخصي وإرسال طلب صداقة فورياً'
                : 'Enter friend’s unique ID to find their profile and send a friend request'}
            </p>
          </div>

          {/* User's own ID badge with quick copy */}
          {currentUser && (
            <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800/80 px-3 py-1.5 rounded-2xl shrink-0">
              <div className="text-start">
                <span className="text-[10px] text-neutral-400 block font-medium">
                  {isAr ? 'معرفك الخاص:' : 'Your ID:'}
                </span>
                <span className="font-mono text-xs font-bold text-neutral-800 dark:text-neutral-200">
                  {myDisplayId}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyMyId}
                className="p-1.5 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800 text-neutral-500 hover:text-cyan-500 transition-colors cursor-pointer"
                title={isAr ? 'نسخ معرفي' : 'Copy my ID'}
              >
                {copiedMyId ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* The Search Bar Input with Form Submission & Search Button */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute right-4 top-1/2 -translate-y-1/2 rtl:right-4 rtl:left-auto ltr:left-4 ltr:right-auto pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAr
                  ? 'اكتب المعرف الرقمي (مثال: S-0101V77-X711 أو المعرف الرقمي)...'
                  : 'Enter friend ID (e.g. S-0101V77-X711)...'
              }
              className="w-full h-12 pr-11 pl-11 rtl:pr-11 rtl:pl-11 ltr:pl-11 ltr:pr-11 text-xs sm:text-sm rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none transition-all font-mono tracking-wide shadow-inner"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setHasSearched(false);
                  setSearchAlert(null);
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 rtl:left-3 rtl:right-auto ltr:right-3 ltr:left-auto p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title={isAr ? 'مسح البحث' : 'Clear'}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="h-12 px-5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-neutral-950 font-black text-xs sm:text-sm transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4 stroke-[2.5]" />
            )}
            <span className="hidden sm:inline">{isAr ? 'بحث' : 'Search'}</span>
          </button>
        </form>

        {/* ========================================================
            تنبيه واضح عند البحث عن صديق (Prominent Search Alert)
            ======================================================== */}
        {searchAlert && searchQuery.trim() && (
          <div
            className={`p-3.5 rounded-2xl border text-xs sm:text-sm flex items-start gap-3 transition-all animate-in fade-in duration-200 ${
              searchAlert.type === 'info'
                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300'
                : searchAlert.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : searchAlert.type === 'warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
            }`}
          >
            {searchAlert.type === 'info' && (
              <Loader2 className="w-5 h-5 animate-spin shrink-0 text-cyan-500 mt-0.5" />
            )}
            {searchAlert.type === 'success' && (
              <Check className="w-5 h-5 shrink-0 text-emerald-500 mt-0.5 stroke-[2.5]" />
            )}
            {searchAlert.type === 'warning' && (
              <AlertCircle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
            )}
            {searchAlert.type === 'error' && (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
            )}
            <div className="flex-1 font-medium leading-relaxed">
              {searchAlert.message}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          2. نتائج البحث بالمعرف:
          المستخدم، معرفه، اسمه، العمر، الدولة مع زر طلب صداقة
          ======================================================== */}
      {searchQuery.trim() ? (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-neutral-500">
              {isAr ? 'نتائج البحث عن المعرف:' : 'Search results:'}
            </span>
            <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
              {searchResults.length} {isAr ? 'مستخدم' : 'user(s)'}
            </span>
          </div>

          {isSearching && searchResults.length === 0 ? (
            <div className="py-12 text-center space-y-3 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xs">
              <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
              <p className="text-xs font-bold text-neutral-500">
                {isAr ? 'جاري التحقق من المعرف في قاعدة بيانات Soul-X...' : 'Searching database for Soul-X ID...'}
              </p>
            </div>
          ) : hasSearched && searchResults.length === 0 ? (
            <div className="py-12 text-center space-y-3 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-neutral-900 dark:text-white">
                {isAr ? 'لم يتم العثور على مستخدم بهذا المعرف' : 'No user found with this ID'}
              </h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                {isAr
                  ? 'يرجى التأكد من كتابة ID الحساب بشكل دقيق (مثال: S-0101V77-X711 أو المعرف الرقمي المسجل)، أو اطلب من صديقك مشاركة معرفه معك.'
                  : 'Please make sure the ID is entered accurately (e.g. S-0101V77-X711) or ask your friend to share their ID.'}
              </p>
            </div>
          ) : (
            /* كروت الملف الشخصي للمستخدمين الذين تم العثور عليهم */
            <div className="grid grid-cols-1 gap-4">
              {searchResults.map((user) => {
                const userDisplayId = user.displayId || user.id;
                const isFriend = friendIds.includes(user.id) || friendIds.includes(userDisplayId);
                const hasSentRequest =
                  !isFriend &&
                  (sentRequests.includes(user.id) ||
                    sentRequests.includes(userDisplayId) ||
                    (user.originalId && sentRequests.includes(user.originalId)));
                const isSending = isSubmitting === user.id || isSubmitting === userDisplayId;

                const displayAge = user.age || 24;
                const displayCountry = user.country || user.location || (isAr ? 'المملكة العربية السعودية' : 'Saudi Arabia');

                return (
                  <div
                    key={user.id}
                    className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border-2 border-cyan-500/30 hover:border-cyan-500/60 transition-all shadow-md space-y-4 relative overflow-hidden"
                  >
                    {/* Corner cyan accent */}
                    <div className="w-24 h-24 bg-cyan-500/10 blur-xl rounded-full absolute -top-4 -right-4 pointer-events-none" />

                    {/* 1. المستخدم (Avatar + Status + Resonance) */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-cyan-500/40 shadow-sm"
                          />
                          {user.status === 'online' && (
                            <span
                              className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute -bottom-1 -right-1"
                              title={isAr ? 'متصل الآن' : 'Online'}
                            />
                          )}
                        </div>

                        <div className="min-w-0 space-y-1.5 flex-1">
                          {/* 2. الاسم (User Name) */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white truncate">
                              {user.name}
                            </h3>
                            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-mono font-bold flex items-center gap-1 border border-cyan-500/20">
                              <Sparkles className="w-3 h-3 text-cyan-500" />
                              <span>{user.matchScore}% {isAr ? 'توافق' : 'match'}</span>
                            </span>
                          </div>

                          {/* 3. المعرف (User ID with Copy Button) */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-xl flex items-center gap-1.5 border border-neutral-200 dark:border-neutral-700 shadow-2xs">
                              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold font-sans">
                                {isAr ? 'المعرف:' : 'ID:'}
                              </span>
                              <span>{userDisplayId}</span>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyId(userDisplayId, e)}
                              className="p-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-500 hover:text-cyan-500 transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700"
                              title={isAr ? 'نسخ المعرف' : 'Copy ID'}
                            >
                              {copiedId === userDisplayId ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4. العمر و 5. الدولة (Age & Country Details Badges) */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
                      {/* العمر */}
                      <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200/70 dark:border-neutral-800/70">
                        <div className="w-7 h-7 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                          <Calendar className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-neutral-400 block font-medium">
                            {isAr ? 'العمر' : 'Age'}
                          </span>
                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                            {displayAge} {isAr ? 'سنة' : 'yrs'}
                          </span>
                        </div>
                      </div>

                      {/* الدولة */}
                      <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200/70 dark:border-neutral-800/70">
                        <div className="w-7 h-7 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                          <Globe className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] text-neutral-400 block font-medium">
                            {isAr ? 'الدولة' : 'Country'}
                          </span>
                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate block">
                            {displayCountry}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bio / النبذة */}
                    {user.bio && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-neutral-950/50 p-3 rounded-2xl border border-neutral-200/70 dark:border-neutral-800/70">
                        "{user.bio}"
                      </p>
                    )}

                    {/* 6. زر طلب صداقة (Friend Request Action Button) */}
                    <div className="pt-1">
                      {isFriend ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 py-3 px-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5">
                            <UserCheck className="w-4 h-4 stroke-[2.5]" />
                            <span>{isAr ? 'أنتما صديقان بالفعل' : 'You are friends'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartChat(user)}
                            className="py-3 px-5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 text-xs sm:text-sm font-black transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>{isAr ? 'بدء محادثة' : 'Chat'}</span>
                          </button>
                        </div>
                      ) : hasSentRequest ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 py-3 px-3.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs sm:text-sm font-bold flex items-center justify-center gap-2">
                            <Clock className="w-4 h-4 animate-pulse text-amber-500" />
                            <span>{isAr ? 'تم إرسال طلب الصداقة ✓' : 'Friend Request Sent ✓'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCancelRequest(user.id, user.name, user.displayId)}
                            className="py-3 px-4 rounded-2xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold transition-colors cursor-pointer shrink-0"
                          >
                            {isAr ? 'إلغاء الطلب' : 'Cancel'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(isSending)}
                          onClick={() => handleSendRequest(user)}
                          className="w-full py-3.5 px-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-xs sm:text-sm transition-all cursor-pointer shadow-md active:scale-98 flex items-center justify-center gap-2"
                        >
                          {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserPlus className="w-4 h-4 stroke-[2.5]" />
                          )}
                          <span>
                            {isSending
                              ? isAr
                                ? 'جاري إرسال طلب الصداقة...'
                                : 'Sending friend request...'
                              : isAr
                              ? 'طلب صداقة'
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
      ) : (
        /* ========================================================
            3. المحتوى الافتراضي للرئيسية للبحث عن الأصدقاء بالمعرف
            Search Guide Placeholder when query is empty
            ======================================================== */
        <div className="py-12 sm:py-16 text-center space-y-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xs animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center mx-auto">
            <Search className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
              {isAr ? 'البحث عن الأصدقاء بواسطة ID' : 'Find Friends by ID'}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {isAr
                ? 'اكتب المعرف الرقمي الخاص بصديقك في خانة البحث بالأعلى لعرض ملفه الشخصي، اسمه، عمره، ودولته، وإرسال طلب صداقة مباشرة.'
                : 'Enter your friend’s numerical ID in the search bar above to view their profile, name, age, country, and send a friend request directly.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
