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
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Globe,
  Calendar,
  Camera,
  QrCode,
  Upload,
  RefreshCw,
  ShieldCheck,
  User,
  Flag,
  Share2,
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Language, SearchUserResult } from '../types';
import { getDefaultAvatar, getEffectiveAvatar } from '../lib/avatar';
import { ReportUserModal, ReportTargetUser } from './ReportUserModal';

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
  initialQuery?: string;
}

export const FriendSearchView: React.FC<FriendSearchViewProps> = ({
  lang,
  onBack,
  onNavigateToChats,
  initialQuery = '',
}) => {
  const isAr = lang === 'ar';
  const [activeMode, setActiveMode] = useState<'input' | 'scanner'>('input');
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  // Profile Modal State
  const [selectedUserProfile, setSelectedUserProfile] = useState<SearchUserResult | null>(null);

  // Reporting State
  const [reportTarget, setReportTarget] = useState<ReportTargetUser | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery));
  const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
  const [searchAlert, setSearchAlert] = useState<{
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

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

  // Synchronize top bar Navbar back button
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('soulx:set-navbar-back', {
        detail: {
          onBack: onBack,
          label: isAr ? 'الرئيسية' : 'Home',
          title: isAr ? 'البحث عن أصدقاء' : 'Search Friends',
        },
      })
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent('soulx:set-navbar-back', { detail: null })
      );
    };
  }, [onBack, isAr]);

  const saveSentRequests = (list: string[]) => {
    setSentRequests(list);
    if (typeof window !== 'undefined') {
      localStorage.setItem('soulx_sent_friend_requests', JSON.stringify(list));
      window.dispatchEvent(new Event('soulx_friend_requests_updated'));
    }
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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Search logic
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
        ? 'جاري البحث في قاعدة البيانات...'
        : 'Searching database...',
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
        let users: SearchUserResult[] = data.users;

        // Ensure Admin 1 or Admin 2 is prioritized if querying 1 or 2
        const cleanNoDashes = cleanQ.replace(/[-\s]/g, '');
        if (cleanNoDashes === '1' || cleanQ === '1') {
          users = users.sort((a, b) => {
            const aIs1 = a.displayId === '1' || a.id === 'admin-1001' || (a.name && a.name.includes('ADMIN1'));
            const bIs1 = b.displayId === '1' || b.id === 'admin-1001' || (b.name && b.name.includes('ADMIN1'));
            if (aIs1 && !bIs1) return -1;
            if (!aIs1 && bIs1) return 1;
            return 0;
          });
        } else if (cleanNoDashes === '2' || cleanQ === '2') {
          users = users.sort((a, b) => {
            const aIs2 = a.displayId === '2' || a.id === 'admin-1002' || (a.name && a.name.includes('ADMIN2'));
            const bIs2 = b.displayId === '2' || b.id === 'admin-1002' || (b.name && b.name.includes('ADMIN2'));
            if (aIs2 && !bIs2) return -1;
            if (!aIs2 && bIs2) return 1;
            return 0;
          });
        }

        setSearchResults(users);
        setHasSearched(true);
        if (users.length > 0) {
          const firstIsAdmin = users[0].isAdmin || users[0].displayId === '1' || users[0].displayId === '2';
          setSearchAlert({
            type: 'success',
            message: firstIsAdmin
              ? isAr
                ? `تم العثور على حساب الإدارة بنجاح كأول نتيجة! 🛡️ (${users.length} نتيجة)`
                : `Found Admin account as top result! 🛡️ (${users.length} results)`
              : isAr
              ? `تم العثور على (${users.length}) نتيجة مطابقة بنجاح! ✨`
              : `Found (${users.length}) matching result(s)! ✨`,
          });
        } else {
          setSearchAlert({
            type: 'warning',
            message: isAr
              ? `لم يتم العثور على أي مستخدم بالبحث: "${cleanQ}". جرب البحث برقم 1 أو 2 لعرض حسابات الإدارة.`
              : `No user found for: "${cleanQ}". Try searching 1 or 2 for admin accounts.`,
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
          : 'Could not connect to database for search. Please try again.',
      });
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
      setSearchAlert(null);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(() => {
      executeSearch(trimmed);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    executeSearch(searchQuery);
  };

  // QR Scanner functions
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
    setActiveMode('input');
    setSearchQuery(processed);
    showToast(isAr ? `تم مسح رمز QR بنجاح: ${processed}` : `QR scanned: ${processed}`);
    executeSearch(processed);
  };

  const startCamera = async () => {
    setScannerError(null);
    setIsScannerRunning(true);

    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('soulx-page-scanner', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
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
          ? 'تعذر الوصول إلى الكاميرا. يرجى منح الإذن أو رفع صورة رمز QR من المعرض.'
          : 'Unable to access camera. Please allow permission or upload a QR image.'
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
    if (activeMode === 'scanner') {
      const timer = setTimeout(() => {
        startCamera();
      }, 200);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [activeMode]);

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
          ? 'لم يتم العثور على رمز QR صالح في هذه الصورة. يرجى اختيار صورة واضحة.'
          : 'No valid QR code detected in this image.'
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
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

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] max-w-4xl mx-auto flex flex-col py-4 px-3 sm:px-6 space-y-6 animate-in fade-in duration-300 pb-24">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] px-6 py-4 rounded-3xl bg-neutral-950/95 dark:bg-neutral-900/95 text-white font-black text-xs sm:text-sm shadow-2xl border-2 border-cyan-400 shadow-cyan-500/30 backdrop-blur-xl flex items-center justify-center gap-2.5 text-center max-w-[90vw] animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
          <Sparkles className="w-5 h-5 shrink-0 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Page Header with Return Button */}
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 sm:p-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-all cursor-pointer active:scale-95 border border-neutral-200/80 dark:border-neutral-700 shadow-xs"
            title={isAr ? 'الرجوع للقائمة الرئيسية' : 'Back to Home'}
          >
            {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <Search className="w-6 h-6 text-cyan-500 shrink-0" />
              <span>{isAr ? 'البحث عن أصدقاء ومستخدمين' : 'Find Friends & Users'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              {isAr
                ? 'ابحث بالمعرف أو الاسم أو الرقم، مع عرض الملفات الشخصية فورياً'
                : 'Search by ID, name, or number with instant profile previews'}
            </p>
          </div>
        </div>

        {/* Mode switcher pills */}
        <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 p-1 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => setActiveMode('input')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeMode === 'input'
                ? 'bg-white dark:bg-neutral-800 text-cyan-600 dark:text-cyan-400 shadow-xs font-black'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isAr ? 'إدخال بحث' : 'Search Input'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('scanner')}
            className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeMode === 'scanner'
                ? 'bg-white dark:bg-neutral-800 text-cyan-600 dark:text-cyan-400 shadow-xs font-black'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isAr ? 'مسح QR' : 'Scan QR'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================
          MODE A: كاميرا مسح الباركود / رمز الـ QR
          ======================================================== */}
      {activeMode === 'scanner' && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-col items-center space-y-4">
          <div className="w-full max-w-sm relative rounded-3xl overflow-hidden bg-neutral-950 aspect-square border-2 border-cyan-500/40 shadow-xl flex items-center justify-center">
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

          <p className="text-xs text-neutral-500 text-center max-w-xs">
            {isAr
              ? 'وجّه الكاميرا نحو رمز QR الخاص بالمستخدم للانتقال لملفه فورياً'
              : 'Point camera at user’s QR code to view profile instantly'}
          </p>

          {scannerError && (
            <div className="w-full max-w-sm p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 text-start">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="leading-relaxed">{scannerError}</span>
            </div>
          )}

          <div className="flex items-center gap-2.5 w-full max-w-sm pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-3 px-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-xs transition-all cursor-pointer shadow-md active:scale-98 flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>{isAr ? 'رفع صورة رمز QR' : 'Upload QR Image'}</span>
            </button>

            <button
              type="button"
              onClick={startCamera}
              className="py-3 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700 flex items-center justify-center gap-1.5"
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
          MODE B: خانة إدخال البحث + الاقتراحات السريعة
          ======================================================== */}
      {activeMode === 'input' && (
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
          <form onSubmit={handleSearchSubmit} className="relative flex items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-neutral-400 absolute right-4 top-1/2 -translate-y-1/2 rtl:right-4 rtl:left-auto ltr:left-4 ltr:right-auto pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAr
                    ? 'ابحث بالمعرف الرقمي (اكتب 1 أو 2 لحسابات الإدارة) أو الاسم...'
                    : 'Search by ID (type 1 or 2 for Admins) or name...'
                }
                className="w-full h-13 pr-12 pl-12 rtl:pr-12 rtl:pl-12 ltr:pl-12 ltr:pr-12 text-sm sm:text-base rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none transition-all font-mono tracking-wide shadow-inner"
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
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 rtl:left-3.5 rtl:right-auto ltr:right-3.5 ltr:left-auto p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  title={isAr ? 'مسح البحث' : 'Clear'}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="h-13 px-6 rounded-2xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-neutral-950 font-black text-sm transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
            >
              {isSearching ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Search className="w-5 h-5 stroke-[2.5]" />
              )}
              <span className="hidden sm:inline">{isAr ? 'بحث' : 'Search'}</span>
            </button>
          </form>

          {/* Quick Filter Chips (1: Admin 1, 2: Admin 2) */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="text-[11px] font-bold text-neutral-400">
              {isAr ? 'اقتراحات سريعة:' : 'Quick Shortcuts:'}
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('1');
                executeSearch('1');
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
              <span>{isAr ? 'رقم 1: مدير النظام (ADMIN1)' : 'No. 1: Admin 1'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('2');
                executeSearch('2');
              }}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
              <span>{isAr ? 'رقم 2: مدير النظام (ADMIN2)' : 'No. 2: Admin 2'}</span>
            </button>
          </div>

          {/* Notification Alert Banner */}
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
      )}

      {/* ========================================================
          نتائج البحث + إمكانية عرض الملفات الشخصية
          ======================================================== */}
      {searchQuery.trim() ? (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs sm:text-sm font-bold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
              <span>{isAr ? 'نتائج البحث:' : 'Search results:'}</span>
              {(searchQuery.trim() === '1' || searchQuery.trim() === '2') && (
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                  {isAr ? 'أولوية لحسابات الإدارة 🛡️' : 'Admin Account Priority 🛡️'}
                </span>
              )}
            </span>
            <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
              {searchResults.length} {isAr ? 'مستخدم' : 'user(s)'}
            </span>
          </div>

          {isSearching && searchResults.length === 0 ? (
            <div className="py-16 text-center space-y-3 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xs">
              <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mx-auto" />
              <p className="text-sm font-bold text-neutral-500">
                {isAr ? 'جاري استرجاع النتائج وفحص السجلات...' : 'Fetching user profiles...'}
              </p>
            </div>
          ) : hasSearched && searchResults.length === 0 ? (
            <div className="py-16 text-center space-y-3 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xs">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h4 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white">
                {isAr ? 'لم يتم العثور على أي مستخدم بهذا البحث' : 'No user found for this search'}
              </h4>
              <p className="text-xs sm:text-sm text-neutral-500 max-w-md mx-auto leading-relaxed">
                {isAr
                  ? 'جرب البحث برقم 1 أو 2 لعرض حسابات الإدارة فورياً، أو تحقق من دقة المعرف المطلوب.'
                  : 'Try typing 1 or 2 to quickly view official system administrators.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {searchResults.map((user, idx) => {
                const userDisplayId = user.displayId || user.id;
                const isAdmin = Boolean(
                  user.isAdmin ||
                  user.id === 'admin-1001' ||
                  user.id === 'admin-1002' ||
                  userDisplayId === '1' ||
                  userDisplayId === '2' ||
                  (user.name && user.name.includes('مدير النظام'))
                );
                const isFriend = friendIds.includes(user.id) || friendIds.includes(userDisplayId);
                const hasSentRequest =
                  !isFriend &&
                  (sentRequests.includes(user.id) ||
                    sentRequests.includes(userDisplayId) ||
                    (user.originalId && sentRequests.includes(user.originalId)));
                const isSending = isSubmitting === user.id || isSubmitting === userDisplayId;
                const displayAge = user.age || 24;
                const displayCountry = user.country || user.location || (isAr ? 'الجمهورية العربية السورية' : 'Syria');

                return (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUserProfile(user)}
                    className={`p-5 rounded-3xl bg-white dark:bg-neutral-900 transition-all shadow-md space-y-4 relative overflow-hidden cursor-pointer hover:shadow-lg ${
                      isAdmin
                        ? 'border-2 border-amber-500/50 hover:border-amber-400 bg-gradient-to-br from-white via-amber-50/20 to-white dark:from-neutral-900 dark:via-amber-950/20 dark:to-neutral-900'
                        : 'border-2 border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/50'
                    }`}
                  >
                    {/* Admin top badge */}
                    {isAdmin && (
                      <div className="absolute top-0 right-0 left-0 bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 font-black text-[10px] sm:text-xs py-1 px-4 flex items-center justify-between shadow-xs">
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-neutral-950" />
                          <span>
                            {userDisplayId === '1' || user.id === 'admin-1001'
                              ? isAr
                                ? 'الحساب الرسمي لمدير النظام (ADMIN 1)'
                                : 'Official System Admin (ADMIN 1)'
                              : isAr
                              ? 'الحساب الرسمي لمدير النظام (ADMIN 2)'
                              : 'Official System Admin (ADMIN 2)'}
                          </span>
                        </span>
                        <span className="bg-neutral-950 text-amber-400 px-1.5 py-0.2 rounded-md font-mono text-[9px]">
                          {isAr ? 'أول اقتراح' : 'Top Result'}
                        </span>
                      </div>
                    )}

                    {/* Header info */}
                    <div className={`flex items-start justify-between gap-3 ${isAdmin ? 'pt-3' : ''}`}>
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="relative shrink-0">
                          <img
                            src={user.avatar || getDefaultAvatar(user.gender)}
                            alt={user.name}
                            className={`w-16 h-16 sm:w-18 sm:h-18 rounded-2xl object-cover shadow-sm ${
                              isAdmin
                                ? 'border-2 border-amber-500 ring-2 ring-amber-400/30'
                                : 'border-2 border-cyan-500/40'
                            }`}
                          />
                          {user.status === 'online' && (
                            <span
                              className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute -bottom-1 -right-1"
                              title={isAr ? 'متصل الآن' : 'Online'}
                            />
                          )}
                        </div>

                        <div className="min-w-0 space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white truncate">
                              {user.name}
                            </h3>
                            {isAdmin && (
                              <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black border border-amber-500/30 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-amber-500" />
                                <span>{isAr ? 'مدير النظام' : 'Admin'}</span>
                              </span>
                            )}
                          </div>

                          {/* ID with Copy */}
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

                    {/* Age and Country details */}
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

                    {/* Bio snippet */}
                    {user.bio && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed bg-neutral-50 dark:bg-neutral-950/50 p-2.5 rounded-2xl border border-neutral-200/70 dark:border-neutral-800/70 line-clamp-2">
                        "{user.bio}"
                      </p>
                    )}

                    {/* Action buttons row */}
                    <div
                      className="pt-1 flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Button 1: عرض الملف الشخصي */}
                      <button
                        type="button"
                        onClick={() => setSelectedUserProfile(user)}
                        className="flex-1 py-2.5 px-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 border border-neutral-200 dark:border-neutral-700"
                      >
                        <User className="w-4 h-4 text-cyan-500" />
                        <span>{isAr ? 'الملف الشخصي' : 'View Profile'}</span>
                      </button>

                      {/* Button 2: محادثة */}
                      <button
                        type="button"
                        onClick={() => handleStartChat(user)}
                        className="py-2.5 px-3.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0 shadow-xs active:scale-95"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{isAr ? 'محادثة' : 'Chat'}</span>
                      </button>

                      {/* Button 3: طلب صداقة */}
                      {isFriend ? (
                        <div className="py-2.5 px-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 shrink-0">
                          <UserCheck className="w-4 h-4" />
                        </div>
                      ) : hasSentRequest ? (
                        <button
                          type="button"
                          onClick={() => handleCancelRequest(user.id, user.name, user.displayId)}
                          className="py-2.5 px-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                          title={isAr ? 'إلغاء طلب الصداقة' : 'Cancel request'}
                        >
                          <Clock className="w-4 h-4 animate-pulse text-amber-500" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(isSending)}
                          onClick={() => handleSendRequest(user)}
                          className="py-2.5 px-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                          title={isAr ? 'طلب صداقة' : 'Add friend'}
                        >
                          {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                          ) : (
                            <UserPlus className="w-4 h-4 text-cyan-500" />
                          )}
                        </button>
                      )}

                      {/* Button 4: إبلاغ */}
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
      ) : (
        /* Empty state with helpful prompt */
        <div className="py-14 text-center space-y-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 sm:p-10 shadow-xs animate-in fade-in duration-200">
          <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center mx-auto shadow-inner">
            <Search className="w-8 h-8 stroke-[2.2]" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h4 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
              {isAr ? 'البحث الفوري واستعراض الملفات' : 'Instant Search & Profile Exploration'}
            </h4>
            <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
              {isAr
                ? 'أدخل المعرف الرقمي أو الاسم أعلاه للبحث السريع. عند البحث برقم 1 أو 2 ستظهر حسابات الإدارة الرسمية كأول اقتراح دائماً.'
                : 'Type any user ID or name above. Typing 1 or 2 will prioritize official system administrator profiles.'}
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('1');
                executeSearch('1');
              }}
              className="py-2.5 px-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 active:scale-95"
            >
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              <span>{isAr ? 'عرض حساب مدير النظام 1' : 'View Admin 1 Profile'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('2');
                executeSearch('2');
              }}
              className="py-2.5 px-4 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-2 active:scale-95"
            >
              <ShieldCheck className="w-4 h-4 text-cyan-500" />
              <span>{isAr ? 'عرض حساب مدير النظام 2' : 'View Admin 2 Profile'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          نافذة عرض الملف الشخصي الكامل (USER PROFILE MODAL)
          ======================================================== */}
      {selectedUserProfile && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200"
          dir={isAr ? 'rtl' : 'ltr'}
          onClick={() => setSelectedUserProfile(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setSelectedUserProfile(null)}
              className="absolute top-4 left-4 rtl:left-4 rtl:right-auto ltr:right-4 ltr:left-auto p-2 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Admin Banner if Admin */}
            {(selectedUserProfile.isAdmin ||
              selectedUserProfile.id === 'admin-1001' ||
              selectedUserProfile.id === 'admin-1002' ||
              selectedUserProfile.displayId === '1' ||
              selectedUserProfile.displayId === '2') && (
              <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  {isAr
                    ? 'هذا الحساب موثق كحساب رسمي لإدارة منصة Soul-X'
                    : 'Verified Official Soul-X Administration Account'}
                </span>
              </div>
            )}

            {/* Avatar & Basic Info */}
            <div className="text-center space-y-2 pt-1">
              <div className="relative inline-block">
                <img
                  src={selectedUserProfile.avatar || getDefaultAvatar(selectedUserProfile.gender)}
                  alt={selectedUserProfile.name}
                  className="w-24 h-24 rounded-full object-cover mx-auto border-3 border-cyan-400 shadow-xl"
                />
                {selectedUserProfile.status === 'online' && (
                  <span
                    className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute bottom-1 right-1"
                    title={isAr ? 'متصل الآن' : 'Online'}
                  />
                )}
              </div>

              <div>
                <h3 className="text-xl font-black text-neutral-900 dark:text-white flex items-center justify-center gap-1.5">
                  <span>{selectedUserProfile.name}</span>
                  {selectedUserProfile.isAdmin && (
                    <ShieldCheck className="w-5 h-5 text-amber-500" />
                  )}
                </h3>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                  {selectedUserProfile.status === 'online'
                    ? isAr
                      ? 'متصل الآن في المنصة'
                      : 'Online now'
                    : isAr
                    ? 'غير متصل حالياً'
                    : 'Offline'}
                </p>
              </div>
            </div>

            {/* Soul-X ID with Copy */}
            <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-neutral-400 block font-medium">
                  {isAr ? 'المعرف الرقمي (ID):' : 'Numerical ID:'}
                </span>
                <span className="font-mono text-sm font-black text-cyan-600 dark:text-cyan-400">
                  {selectedUserProfile.displayId || selectedUserProfile.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  handleCopyId(selectedUserProfile.displayId || selectedUserProfile.id)
                }
                className="py-1.5 px-3 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                {copiedId === (selectedUserProfile.displayId || selectedUserProfile.id) ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{isAr ? 'تم النسخ' : 'Copied'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isAr ? 'نسخ' : 'Copy'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Profile Attributes Cards */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-cyan-500 shrink-0" />
                <div>
                  <span className="text-[10px] text-neutral-400 block font-medium">
                    {isAr ? 'العمر' : 'Age'}
                  </span>
                  <span className="text-xs font-black text-neutral-900 dark:text-white">
                    {selectedUserProfile.age || 24} {isAr ? 'سنة' : 'years'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-cyan-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] text-neutral-400 block font-medium">
                    {isAr ? 'الدولة' : 'Country'}
                  </span>
                  <span className="text-xs font-black text-neutral-900 dark:text-white truncate block">
                    {selectedUserProfile.country || selectedUserProfile.location || (isAr ? 'الجمهورية العربية السورية' : 'Syria')}
                  </span>
                </div>
              </div>
            </div>

            {/* Bio */}
            {selectedUserProfile.bio && (
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-1">
                <span className="text-[10px] text-neutral-400 block font-medium">
                  {isAr ? 'النبذة التعريفية:' : 'Bio:'}
                </span>
                <p className="text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-medium">
                  "{selectedUserProfile.bio}"
                </p>
              </div>
            )}

            {/* Modal Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const target = selectedUserProfile;
                  setSelectedUserProfile(null);
                  handleStartChat(target);
                }}
                className="w-full py-3.5 px-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-xs sm:text-sm transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 active:scale-98"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{isAr ? 'بدء محادثة خاصة فوراً' : 'Start Private Chat'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                {friendIds.includes(selectedUserProfile.id) ||
                friendIds.includes(selectedUserProfile.displayId || '') ? (
                  <div className="py-2.5 px-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5">
                    <UserCheck className="w-4 h-4" />
                    <span>{isAr ? 'صديق مضاف' : 'Friend'}</span>
                  </div>
                ) : sentRequests.includes(selectedUserProfile.id) ||
                  sentRequests.includes(selectedUserProfile.displayId || '') ? (
                  <button
                    type="button"
                    onClick={() =>
                      handleCancelRequest(
                        selectedUserProfile.id,
                        selectedUserProfile.name,
                        selectedUserProfile.displayId
                      )
                    }
                    className="py-2.5 px-3 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Clock className="w-4 h-4" />
                    <span>{isAr ? 'إلغاء الطلب' : 'Cancel Req'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(isSubmitting)}
                    onClick={() => handleSendRequest(selectedUserProfile)}
                    className="py-2.5 px-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <UserPlus className="w-4 h-4 text-cyan-500" />
                    <span>{isAr ? 'طلب صداقة' : 'Add Friend'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const target = selectedUserProfile;
                    setSelectedUserProfile(null);
                    handleOpenReportModal(target);
                  }}
                  className="py-2.5 px-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Flag className="w-4 h-4" />
                  <span>{isAr ? 'إبلاغ عن الحساب' : 'Report User'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة الإبلاغ عن المستخدم */}
      <ReportUserModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        lang={lang}
        targetUser={reportTarget}
        source="chat"
      />
    </div>
  );
};
