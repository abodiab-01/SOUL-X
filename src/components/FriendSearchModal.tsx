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
  AlertCircle,
  Globe,
  Calendar,
} from 'lucide-react';
import { Language, SearchUserResult } from '../types';

interface FriendSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onNavigateToChats?: (friendInfo?: { id: string; name: string; avatar: string; status: 'online' | 'offline'; bio?: string } | string) => void;
  initialQuery?: string;
}

export const FriendSearchModal: React.FC<FriendSearchModalProps> = ({
  isOpen,
  onClose,
  lang,
  onNavigateToChats,
  initialQuery = '',
}) => {
  const isAr = lang === 'ar';
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  useEffect(() => {
    if (isOpen && initialQuery) {
      setSearchQuery(initialQuery);
    }
  }, [isOpen, initialQuery]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  // Current friends (persisted in localStorage or database)
  const [friendIds, setFriendIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('soulx_friends_list');
        if (saved) return JSON.parse(saved);
      } catch {}
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

  // Synchronize friends and sent requests across components and tabs
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
    if (typeof window !== 'undefined') {
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
              : `No user found with ID: "${cleanQ}". Please verify the registered ID.`,
          });
        }
      } else {
        throw new Error(data.message || 'Search failed');
      }
    } catch (err) {
      setSearchAlert({
        type: 'error',
        message: isAr
          ? 'تعذر الاتصال بقاعدة البيانات للبحث. يرجى المحاولة مجدداً.'
          : 'Could not connect to database for search. Please try again.',
      });
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

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
  }, [searchQuery, isOpen]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    executeSearch(searchQuery);
  };

  // Send friend request handler
  const handleSendRequest = async (user: SearchUserResult) => {
    const userDisplayId = user.displayId || user.id;
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
      const res = await fetch('/api/friends/send-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId,
          senderName,
          senderAvatar,
          senderBio,
          senderDisplayId,
          targetUserId: user.id,
          targetUserDisplayId: userDisplayId,
          targetUserName: user.name,
          targetUserAvatar: user.avatar,
          targetUserBio: user.bio,
          timestamp: new Date().toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));

      const updated = Array.from(new Set([...sentRequests, user.id, ...(user.displayId ? [user.displayId] : [])]));
      saveSentRequests(updated);

      try {
        const existingSent = JSON.parse(localStorage.getItem('soulx_sent_requests_details') || '[]');
        const newReq = {
          id: `sent-${user.id}-${Date.now()}`,
          userId: user.id,
          displayId: userDisplayId,
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
          JSON.stringify([newReq, ...existingSent.filter((r: any) => r.userId !== user.id && r.displayId !== userDisplayId)])
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
      const u = JSON.parse(localStorage.getItem('soulx_auth_user') || '{}');
      const senderId = u?.id || u?.displayId || '549182301';
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
    onClose();
    if (onNavigateToChats) {
      onNavigateToChats({
        id: user.displayId || user.id,
        name: user.name,
        avatar: user.avatar,
        status: user.status || 'online',
        bio: user.bio,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="absolute top-3 left-4 right-4 z-30 animate-in slide-in-from-top duration-300">
            <div className="p-3 bg-cyan-500 text-neutral-950 font-bold rounded-2xl shadow-xl flex items-center gap-2 text-xs">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-500" />
              <span>{isAr ? 'البحث عن صديق بالمعرف' : 'Search Friend by ID'}</span>
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {isAr
                ? 'ابحث بواسطة المعرف الرقمي الخاص بصديقك للتواصل وإرسال طلب صداقة'
                : 'Search by unique numerical ID to connect and add friend'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Box */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 shrink-0 space-y-3">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 rtl:right-3 rtl:left-auto ltr:left-3 ltr:right-auto pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAr
                    ? 'اكتب المعرف الرقمي (مثال: S-0101V77-X711)...'
                    : 'Enter friend ID (e.g. S-0101V77-X711)...'
                }
                className="w-full h-11 pr-9 pl-9 rtl:pr-9 rtl:pl-9 ltr:pl-9 ltr:pr-9 text-xs sm:text-sm rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none transition-all font-mono tracking-wide"
                autoFocus
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
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 rtl:left-2.5 rtl:right-auto ltr:right-2.5 ltr:left-auto p-1 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="h-11 px-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-neutral-950 font-black text-xs transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1 shrink-0 active:scale-95"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 stroke-[2.5]" />}
              <span>{isAr ? 'بحث' : 'Search'}</span>
            </button>
          </form>

          {/* Prominent Search Alert */}
          {searchAlert && searchQuery.trim() && (
            <div
              className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 transition-all animate-in fade-in duration-200 ${
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
                <Loader2 className="w-4 h-4 animate-spin shrink-0 text-cyan-500 mt-0.5" />
              )}
              {searchAlert.type === 'success' && (
                <Check className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5 stroke-[2.5]" />
              )}
              {searchAlert.type === 'warning' && (
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
              )}
              {searchAlert.type === 'error' && (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
              )}
              <div className="flex-1 font-medium leading-relaxed">
                {searchAlert.message}
              </div>
            </div>
          )}
        </div>

        {/* Modal Results Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 flex-1">
          {searchQuery.trim() ? (
            isSearching && searchResults.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mx-auto" />
                <p className="text-xs text-neutral-500 font-bold">
                  {isAr ? 'جاري البحث في قاعدة البيانات...' : 'Searching database...'}
                </p>
              </div>
            ) : hasSearched && searchResults.length === 0 ? (
              <div className="py-10 text-center space-y-2 rounded-2xl bg-neutral-50 dark:bg-neutral-950 p-6 border border-neutral-200 dark:border-neutral-800">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'لم يتم العثور على مستخدم بهذا المعرف' : 'No user found with this ID'}
                </h4>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
                  {isAr
                    ? 'تأكد من كتابة ID الحساب بشكل دقيق (مثال: S-0101V77-X711).'
                    : 'Double-check the registered numerical ID or ask your friend for their ID.'}
                </p>
              </div>
            ) : (
              searchResults.map((user) => {
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
                    className="p-4 rounded-3xl bg-neutral-50 dark:bg-neutral-950 border-2 border-cyan-500/30 hover:border-cyan-500/60 transition-all space-y-3.5 relative overflow-hidden"
                  >
                    {/* 1. المستخدم (Avatar & Status) */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-14 h-14 rounded-2xl object-cover border-2 border-cyan-500/40 shadow-xs"
                          />
                          {user.status === 'online' && (
                            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute -bottom-0.5 -right-0.5" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-1 flex-1">
                          {/* 2. الاسم (Name) */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white truncate">
                              {user.name}
                            </h4>
                          </div>

                          {/* 3. المعرف (ID with copy) */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-200/70 dark:bg-neutral-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold font-sans">
                                {isAr ? 'المعرف:' : 'ID:'}
                              </span>
                              <span>{userDisplayId}</span>
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyId(userDisplayId, e)}
                              className="p-1 rounded text-neutral-400 hover:text-cyan-500 transition-colors cursor-pointer"
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

                    {/* 4. العمر و 5. الدولة (Age & Country) */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-200/80 dark:border-neutral-800/80">
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60">
                        <Calendar className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[9px] text-neutral-400 block font-medium">
                            {isAr ? 'العمر' : 'Age'}
                          </span>
                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                            {displayAge} {isAr ? 'سنة' : 'yrs'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800/60">
                        <Globe className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-[9px] text-neutral-400 block font-medium">
                            {isAr ? 'الدولة' : 'Country'}
                          </span>
                          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate block">
                            {displayCountry}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 6. زر طلب صداقة */}
                    <div className="pt-0.5">
                      {isFriend ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5">
                            <UserCheck className="w-4 h-4" />
                            <span>{isAr ? 'أنتما صديقان بالفعل' : 'You are friends'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartChat(user)}
                            className="py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>{isAr ? 'بدء محادثة' : 'Chat'}</span>
                          </button>
                        </div>
                      ) : hasSentRequest ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold flex items-center justify-center gap-1.5">
                            <Clock className="w-4 h-4 animate-pulse text-amber-500" />
                            <span>{isAr ? 'تم إرسال طلب الصداقة ✓' : 'Request Sent ✓'}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCancelRequest(user.id, user.name, user.displayId)}
                            className="py-2 px-3 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-bold transition-colors cursor-pointer shrink-0"
                          >
                            {isAr ? 'إلغاء الطلب' : 'Cancel'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(isSending)}
                          onClick={() => handleSendRequest(user)}
                          className="w-full py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-xs transition-all cursor-pointer shadow-xs active:scale-98 flex items-center justify-center gap-1.5"
                        >
                          {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserPlus className="w-4 h-4 stroke-[2.5]" />
                          )}
                          <span>
                            {isSending
                              ? isAr
                                ? 'جاري إرسال الطلب...'
                                : 'Sending request...'
                              : isAr
                              ? 'طلب صداقة'
                              : 'Send Friend Request'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )
          ) : (
            <div className="py-12 text-center space-y-2">
              <Search className="w-8 h-8 text-neutral-400 mx-auto" />
              <p className="text-xs text-neutral-500">
                {isAr
                  ? 'اكتب المعرف الرقمي الخاص بالصديق للبحث عنه فورياً'
                  : 'Enter friend’s numerical ID to find their profile'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
