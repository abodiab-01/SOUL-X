import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  UserPlus,
  UserCheck,
  Check,
  Copy,
  X,
  Sparkles,
  MessageCircle,
  Clock,
  Loader2,
  AlertCircle,
  Globe,
  Calendar,
  Camera,
  QrCode,
  Upload,
  RefreshCw,
  User,
  Flag,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Language, SearchUserResult } from '../types';
import { getDefaultAvatar, getEffectiveAvatar } from '../lib/avatar';
import { ReportUserModal, ReportTargetUser } from './ReportUserModal';
import { openUserProfile } from '../lib/profileModal';

interface FriendSearchViewProps {
  lang: Language;
  onBack: () => void;
  onNavigateToChats?: (
    friendInfo?:
      | {
          id: string;
          name: string;
          avatar: string;
          status: 'online' | 'offline';
          bio?: string;
        }
      | string
  ) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isScannerOpen: boolean;
  setIsScannerOpen: (open: boolean) => void;
}

export const FriendSearchView: React.FC<FriendSearchViewProps> = ({
  lang,
  onBack,
  onNavigateToChats,
  searchQuery,
  setSearchQuery,
  isScannerOpen,
  setIsScannerOpen,
}) => {
  const isAr = lang === 'ar';
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  // Reporting State
  const [reportTarget, setReportTarget] = useState<ReportTargetUser | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Search & Suggestions state
  const [isSearching, setIsSearching] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<SearchUserResult[]>([]);
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // QR Scanner State
  const [isScannerRunning, setIsScannerRunning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Current friends (persisted in localStorage)
  const [friendIds, setFriendIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('soulx_friends_list');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

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
      showToast(isAr ? `تم نسخ المعرف (${id}) بنجاح!` : `ID (${id}) copied!`);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Load initial suggestions (available users in database)
  useEffect(() => {
    let currentUid = '';
    if (typeof window !== 'undefined') {
      try {
        const u = JSON.parse(localStorage.getItem('soulx_auth_user') || '{}');
        if (u?.id) currentUid = u.id;
      } catch {}
    }

    setInitialLoading(true);
    fetch(`/api/users/search?q=&currentUserId=${encodeURIComponent(currentUid)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.users)) {
          setSuggestions(data.users);
        }
      })
      .catch(() => {})
      .finally(() => {
        setInitialLoading(false);
      });
  }, []);

  // Debounced search logic
  const searchTimeoutRef = useRef<any>(null);

  const executeSearch = async (queryToSearch: string) => {
    const cleanQ = queryToSearch.trim();
    if (!cleanQ) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
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
      } else {
        setSearchResults([]);
        setHasSearched(true);
      }
    } catch {
      setSearchResults([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      executeSearch(trimmed);
    }, 280);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // QR Scanner logic
  const handleScannedCode = (rawCode: string) => {
    const cleanCode = rawCode.trim();
    if (!cleanCode) return;

    let processed = cleanCode;
    if (processed.includes('id=')) {
      processed = processed.split('id=')[1].split('&')[0];
    } else if (processed.includes('/user/')) {
      processed = processed.split('/user/')[1].split('?')[0];
    }

    stopCamera();
    setIsScannerOpen(false);
    setSearchQuery(processed);
    showToast(isAr ? `تم مسح الباركود بنجاح: ${processed}` : `Barcode scanned: ${processed}`);
    executeSearch(processed);
  };

  const startCamera = async () => {
    setScannerError(null);
    setIsScannerRunning(true);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('soulx-page-scanner', {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
          ],
          verbose: false,
        });
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => handleScannedCode(decodedText),
        () => {}
      );
    } catch (err: any) {
      setIsScannerRunning(false);
      setScannerError(
        isAr
          ? 'تعذر الوصول إلى الكاميرا. يرجى منح الإذن أو رفع صورة الباركود من المعرض.'
          : 'Unable to access camera. Please allow permission or upload an image.'
      );
    }
  };

  const stopCamera = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
    } catch {}
    setIsScannerRunning(false);
  };

  useEffect(() => {
    if (isScannerOpen) {
      const timer = setTimeout(() => {
        startCamera();
      }, 150);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [isScannerOpen]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScannerError(null);
    try {
      let tempScanner = scannerRef.current;
      if (!tempScanner) {
        tempScanner = new Html5Qrcode('soulx-page-scanner');
        scannerRef.current = tempScanner;
      }
      const decodedText = await tempScanner.scanFile(file, true);
      handleScannedCode(decodedText);
    } catch (err) {
      setScannerError(
        isAr
          ? 'لم يتم العثور على رمز باركود صالح في هذه الصورة. يرجى اختيار صورة واضحة.'
          : 'No valid barcode detected in this image.'
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Profile modal trigger
  const handleOpenUserProfile = (u: SearchUserResult) => {
    openUserProfile({
      id: u.id,
      displayId: u.displayId || u.id,
      name: u.name,
      avatar: u.avatar || getDefaultAvatar(u.gender),
      bio: u.bio,
      country: u.country || u.location,
      age: u.age,
      gender: u.gender,
      status: u.status,
      isFriend: friendIds.includes(u.id) || (u.displayId ? friendIds.includes(u.displayId) : false),
      hasPendingRequest: sentRequests.includes(u.id) || (u.displayId ? sentRequests.includes(u.displayId) : false),
      isAdmin: u.isAdmin,
    });
  };

  // Friend Request Handler
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
          senderAvatar = getEffectiveAvatar(u.photoUrl, u.gender);
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
          targetUserId: user.id,
          targetUserDisplayId: userDisplayId,
          targetUserName: user.name,
          targetUserAvatar: user.avatar,
          targetUserBio: user.bio,
          timestamp: new Date().toISOString(),
        }),
      });

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
    } catch {
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

  const handleOpenReportModal = (user: SearchUserResult, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReportTarget({
      id: user.id,
      displayId: user.displayId,
      name: user.name,
      avatar: user.avatar,
      email: (user as any).email || (user as any).username,
    });
    setIsReportModalOpen(true);
  };

  // Determine which list to show: if search query exists, show searchResults, otherwise suggestions
  const displayedUsers = searchQuery.trim() ? searchResults : suggestions;
  const isQueryMode = Boolean(searchQuery.trim());

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] max-w-4xl mx-auto flex flex-col py-4 px-3 sm:px-6 space-y-5 animate-in fade-in duration-300 pb-24">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] px-6 py-4 rounded-3xl bg-neutral-950/95 dark:bg-neutral-900/95 text-white font-black text-xs sm:text-sm shadow-2xl border-2 border-cyan-400 shadow-cyan-500/30 backdrop-blur-xl flex items-center justify-center gap-2.5 text-center max-w-[90vw] animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
          <Sparkles className="w-5 h-5 shrink-0 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================
          كاميرا مسح الباركود عند النقر على زر الباركود في البار العلوي
          ======================================================== */}
      {isScannerOpen && (
        <div className="p-6 rounded-3xl bg-white dark:bg-neutral-900 border-2 border-cyan-500/40 shadow-lg flex flex-col items-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between w-full pb-2 border-b border-neutral-100 dark:border-neutral-800">
            <h3 className="text-sm font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <QrCode className="w-5 h-5 text-cyan-500" />
              <span>{isAr ? 'ماسح الباركود ورمز الـ QR' : 'Barcode & QR Scanner'}</span>
            </h3>
            <button
              type="button"
              onClick={() => setIsScannerOpen(false)}
              className="p-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-500 cursor-pointer"
              title={isAr ? 'إغلاق الكاميرا' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full max-w-xs relative rounded-3xl overflow-hidden bg-neutral-950 aspect-square border-2 border-cyan-500/50 shadow-xl flex items-center justify-center">
            <div id="soulx-page-scanner" className="w-full h-full object-cover" />

            <div className="absolute inset-4 pointer-events-none border-2 border-cyan-400/30 rounded-2xl flex flex-col justify-between p-2">
              <div className="flex justify-between">
                <div className="w-4 h-4 border-t-2 border-l-2 border-cyan-400" />
                <div className="w-4 h-4 border-t-2 border-r-2 border-cyan-400" />
              </div>
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />
              <div className="flex justify-between">
                <div className="w-4 h-4 border-b-2 border-l-2 border-cyan-400" />
                <div className="w-4 h-4 border-b-2 border-r-2 border-cyan-400" />
              </div>
            </div>
          </div>

          <p className="text-xs text-neutral-500 text-center max-w-xs leading-relaxed">
            {isAr
              ? 'وجّه الكاميرا نحو باركود أو رمز QR الخاص بالمستخدم للانتقال الفوري'
              : 'Point camera at user’s barcode or QR code'}
          </p>

          {scannerError && (
            <div className="w-full max-w-xs p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 text-start">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="leading-relaxed">{scannerError}</span>
            </div>
          )}

          <div className="flex items-center gap-2.5 w-full max-w-xs pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2.5 px-3 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-xs transition-all cursor-pointer shadow-md active:scale-98 flex items-center justify-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              <span>{isAr ? 'رفع صورة باركود' : 'Upload Image'}</span>
            </button>

            <button
              type="button"
              onClick={startCamera}
              className="py-2.5 px-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700 flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{isAr ? 'إعادة' : 'Retry'}</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>
      )}

      {/* ========================================================
          قسم الاقتراحات والنتائج بالأسفل (Suggestions & Results)
          ======================================================== */}
      <div className="space-y-4 animate-in fade-in duration-200">
        {/* شريط عنوان القسم وتعداد النتائج */}
        <div className="flex items-center justify-between px-1">
          <div>
            <h2 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <span>
                {isQueryMode
                  ? isAr
                    ? `نتائج البحث عن: "${searchQuery}"`
                    : `Search results for: "${searchQuery}"`
                  : isAr
                  ? 'اقتراحات الأصدقاء'
                  : 'Friend Suggestions'}
              </span>
            </h2>
            <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {isQueryMode
                ? isAr
                  ? 'المستخدمون المطابقون للمعرف أو الاسم'
                  : 'Users matching the queried ID or name'
                : isAr
                ? 'مستخدمون متاحون للتواصل وتوافق الأرواح'
                : 'Available members ready to connect'}
            </p>
          </div>

          <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-xl border border-cyan-500/20">
            {displayedUsers.length} {isAr ? 'مستخدم' : 'users'}
          </span>
        </div>

        {/* حالة التحميل */}
        {(isSearching || initialLoading) && displayedUsers.length === 0 ? (
          <div className="py-16 text-center space-y-3 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xs">
            <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mx-auto" />
            <p className="text-sm font-bold text-neutral-500">
              {isAr ? 'جاري جلب الاقتراحات...' : 'Loading suggestions...'}
            </p>
          </div>
        ) : isQueryMode && hasSearched && displayedUsers.length === 0 ? (
          /* في حالة عدم وجود نتائج للبحث */
          <div className="py-16 text-center space-y-3 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xs">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h4 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
              {isAr ? 'لم يتم العثور على أي مستخدم يطابق البحث' : 'No user found matching this search'}
            </h4>
            <p className="text-xs sm:text-sm text-neutral-500 max-w-md mx-auto leading-relaxed">
              {isAr
                ? 'تأكد من كتابة المعرف أو الاسم بشكل دقيق، أو استخدم زر مسح الباركود في الأعلى.'
                : 'Please verify the ID or name, or use the barcode scanner button above.'}
            </p>
          </div>
        ) : (
          /* شبكة الاقتراحات ونتائج البحث */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {displayedUsers.map((user) => {
              const userDisplayId = user.displayId || user.id;
              const isFriend = friendIds.includes(user.id) || friendIds.includes(userDisplayId);
              const hasSentRequest =
                !isFriend &&
                (sentRequests.includes(user.id) ||
                  sentRequests.includes(userDisplayId) ||
                  (user.originalId && sentRequests.includes(user.originalId)));
              const isSending = isSubmitting === user.id || isSubmitting === userDisplayId;
              const displayAge = user.age || 24;
              const displayCountry = user.country || user.location || (isAr ? 'سوريا' : 'Syria');

              return (
                <div
                  key={user.id}
                  onClick={() => handleOpenUserProfile(user)}
                  className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border-2 border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/50 transition-all shadow-xs hover:shadow-md space-y-4 cursor-pointer relative"
                >
                  {/* معلومات المستخدم الأساسية */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className="relative shrink-0 cursor-pointer group/avatar"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenUserProfile(user);
                        }}
                        title={isAr ? 'عرض الملف الشخصي الكامل' : 'View Full Profile'}
                      >
                        <img
                          src={user.avatar || getDefaultAvatar(user.gender)}
                          alt={user.name}
                          className="w-16 h-16 rounded-2xl object-cover shadow-xs border-2 border-cyan-500/40 transition-transform group-hover/avatar:scale-105"
                        />
                        {user.status === 'online' && (
                          <span
                            className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute -bottom-1 -right-1"
                            title={isAr ? 'متصل الآن' : 'Online'}
                          />
                        )}
                      </div>

                      <div className="min-w-0 space-y-1.5 flex-1">
                        <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white truncate">
                          {user.name}
                        </h3>

                        {/* ID مع زر النسخ السريع */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            onClick={(e) => handleCopyId(userDisplayId, e)}
                            className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-1 rounded-xl flex items-center gap-1.5 border border-neutral-200 dark:border-neutral-700 hover:border-cyan-500/40 transition-colors"
                            title={isAr ? 'نسخ المعرف' : 'Copy ID'}
                          >
                            <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold font-sans">
                              {isAr ? 'المعرف:' : 'ID:'}
                            </span>
                            <span>{userDisplayId}</span>
                            {copiedId === userDisplayId ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-neutral-400 hover:text-cyan-500" />
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* العمر والدولة */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-100 dark:border-neutral-800/80">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200/70 dark:border-neutral-800/70">
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

                    <div className="flex items-center gap-2 p-2 rounded-xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200/70 dark:border-neutral-800/70">
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

                  {/* النبذة إذا توفرت */}
                  {user.bio && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-neutral-950/50 p-2.5 rounded-2xl border border-neutral-200/70 dark:border-neutral-800/70 line-clamp-2">
                      "{user.bio}"
                    </p>
                  )}

                  {/* أزرار الإجراءات */}
                  <div
                    className="pt-1 flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* زر عرض الملف الشخصي */}
                    <button
                      type="button"
                      onClick={() => handleOpenUserProfile(user)}
                      className="flex-1 py-2.5 px-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 border border-neutral-200 dark:border-neutral-700"
                    >
                      <User className="w-4 h-4 text-cyan-500" />
                      <span>{isAr ? 'الملف الشخصي' : 'Profile'}</span>
                    </button>

                    {/* زر بدء المحادثة إذا كانا أصدقاء */}
                    {isFriend ? (
                      <button
                        type="button"
                        onClick={() => handleStartChat(user)}
                        className="py-2.5 px-3.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0 active:scale-95"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{isAr ? 'محادثة' : 'Chat'}</span>
                      </button>
                    ) : hasSentRequest ? (
                      <button
                        type="button"
                        onClick={() => handleCancelRequest(user.id, user.name, user.displayId)}
                        className="py-2.5 px-3.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                        title={isAr ? 'إلغاء طلب الصداقة' : 'Cancel request'}
                      >
                        <Clock className="w-4 h-4 animate-pulse text-amber-500" />
                        <span>{isAr ? 'تم الإرسال' : 'Sent'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(isSending)}
                        onClick={() => handleSendRequest(user)}
                        className="py-2.5 px-3.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95"
                        title={isAr ? 'طلب صداقة' : 'Add friend'}
                      >
                        {isSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <UserPlus className="w-4 h-4 stroke-[2.5]" />
                        )}
                        <span>{isAr ? 'طلب صداقة' : 'Add'}</span>
                      </button>
                    )}

                    {/* زر الإبلاغ */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenReportModal(user, e)}
                      className="p-2.5 rounded-2xl bg-neutral-100 hover:bg-rose-50 dark:bg-neutral-800 dark:hover:bg-rose-950/30 text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700"
                      title={isAr ? 'إبلاغ عن هذا المستخدم' : 'Report user'}
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* نافذة الإبلاغ عن المستخدم */}
      {reportTarget && (
        <ReportUserModal
          isOpen={isReportModalOpen}
          onClose={() => {
            setIsReportModalOpen(false);
            setReportTarget(null);
          }}
          lang={lang}
          targetUser={reportTarget}
        />
      )}
    </div>
  );
};
