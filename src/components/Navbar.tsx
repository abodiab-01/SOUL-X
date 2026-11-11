import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  Users,
  Settings,
  MoreVertical,
  Gift,
  User,
  BellOff,
  Bell,
  Trash2,
  ShieldAlert,
  Copy,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { Language, AuthUser } from '../types';
import { TabType } from './BottomNav';

export interface ActiveChatInfo {
  name: string;
  avatar?: string;
  statusText?: string;
  isOnline?: boolean;
  isTyping?: boolean;
  isOfficial?: boolean;
  partnerId?: string;
  displayId?: string;
  age?: number;
  country?: string;
  onBack: () => void;
  onSendGift?: () => void;
  onClearChat?: () => void;
  onViewProfile?: () => void;
  onAddFriend?: () => void;
  isFriend?: boolean;
  isFriendRequested?: boolean;
}

interface NavbarProps {
  lang: Language;
  walletBalance?: number;
  coinsBalance?: number;
  onOpenWallet?: (tab?: 'diamonds' | 'coins') => void;
  onBrandClick: () => void;
  onNavigateToChats?: (friendName?: string) => void;
  currentUser?: AuthUser | null;
  onOpenSettings?: () => void;
  onOpenAdmin?: () => void;
  onBack?: (() => void) | null;
  backLabel?: string | null;
  onOpenSearch?: (() => void) | null;
  onOpenFriends?: (() => void) | null;
  friendRequestsCount?: number;
  title?: string | null;
  activeTab?: TabType;
  activeChat?: ActiveChatInfo | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  lang = 'ar',
  onBrandClick,
  onOpenSettings,
  onOpenAdmin,
  onBack,
  backLabel,
  onOpenSearch,
  onOpenFriends,
  friendRequestsCount: propsFriendRequestsCount,
  title,
  activeTab,
  activeChat,
}) => {
  const isAr = lang === 'ar';

  const tabTitles: Record<TabType, { ar: string; en: string }> = {
    home: { ar: 'الرئيسية', en: 'Home' },
    match: { ar: 'المطابقة', en: 'Match' },
    chats: { ar: 'الدردشات', en: 'Chats' },
    account: { ar: 'حسابي', en: 'Account' },
  };

  // Dynamic back button registered by child views
  const [dynamicBack, setDynamicBack] = useState<{
    onBack: () => void;
    label?: string;
    title?: string;
  } | null>(null);

  const [dynamicTitle, setDynamicTitle] = useState<string | null>(null);
  const [dynamicChat, setDynamicChat] = useState<ActiveChatInfo | null>(null);
  const [internalFriendRequestsCount, setInternalFriendRequestsCount] = useState<number>(0);

  // 3-dots Menu & Profile Modal State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    const handleSetBack = (e: any) => {
      const detail = e.detail;
      if (detail && typeof detail.onBack === 'function') {
        setDynamicBack({
          onBack: detail.onBack,
          label: detail.label,
          title: detail.title,
        });
      } else {
        setDynamicBack(null);
      }
    };

    const handleSetTitle = (e: any) => {
      const detail = e.detail;
      if (typeof detail?.title === 'string') {
        setDynamicTitle(detail.title);
      } else if (typeof detail === 'string') {
        setDynamicTitle(detail);
      } else {
        setDynamicTitle(null);
      }
    };

    const handleSetChat = (e: any) => {
      if (e.detail && typeof e.detail === 'object') {
        setDynamicChat(e.detail);
      } else {
        setDynamicChat(null);
      }
    };

    const handleFriendRequestsCount = (e: any) => {
      if (typeof e.detail?.count === 'number') {
        setInternalFriendRequestsCount(e.detail.count);
      }
    };

    window.addEventListener('soulx:set-navbar-back', handleSetBack);
    window.addEventListener('soulx:set-navbar-title', handleSetTitle);
    window.addEventListener('soulx:set-navbar-chat', handleSetChat);
    window.addEventListener('soulx_friend_requests_count', handleFriendRequestsCount);
    return () => {
      window.removeEventListener('soulx:set-navbar-back', handleSetBack);
      window.removeEventListener('soulx:set-navbar-title', handleSetTitle);
      window.removeEventListener('soulx:set-navbar-chat', handleSetChat);
      window.removeEventListener('soulx_friend_requests_count', handleFriendRequestsCount);
    };
  }, []);

  const effectiveChat = activeChat || dynamicChat;
  const effectiveOnBack = onBack || dynamicBack?.onBack;
  const effectiveBackLabel = backLabel || dynamicBack?.label;
  const defaultTabTitle = activeTab ? (isAr ? tabTitles[activeTab]?.ar : tabTitles[activeTab]?.en) : null;
  const effectiveTitle = dynamicTitle || dynamicBack?.title || title || defaultTabTitle;

  const handleCopyId = (idToCopy: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(idToCopy);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      showToast(isAr ? 'تم نسخ المعرف بنجاح' : 'ID copied to clipboard');
    }
  };

  return (
    <>
      <header
        className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/95 dark:bg-neutral-950/95 border-b border-neutral-200 dark:border-neutral-800 transition-colors shadow-xs"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div
          className="w-full max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between relative"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          {effectiveChat ? (
            /* ========================================================
               ACTIVE CHAT TOP BAR (اسم الشخص، زر العودة، زر ثلاث نقاط الثابت)
               ======================================================== */
            <>
              {/* جهة البداية (اليمين في العربية، اليسار في الإنجليزية): زر العودة + صورة واسم الشخص */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                {/* زر العودة الثابت */}
                <button
                  type="button"
                  onClick={effectiveChat.onBack}
                  className="p-2 sm:p-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-all cursor-pointer shrink-0 active:scale-95 border border-neutral-200/80 dark:border-neutral-800 shadow-xs"
                  title={isAr ? 'العودة' : 'Back'}
                  aria-label={isAr ? 'العودة' : 'Back'}
                >
                  {isAr ? (
                    <ArrowRight className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                  ) : (
                    <ArrowLeft className="w-5 h-5 text-neutral-700 dark:text-neutral-300" />
                  )}
                </button>

                {/* صورة المستخدم مع مؤشر الحالة */}
                <div
                  className="relative shrink-0 cursor-pointer"
                  onClick={() => setIsProfileModalOpen(true)}
                  title={isAr ? 'عرض الملف الشخصي' : 'View profile'}
                >
                  <img
                    src={
                      effectiveChat.avatar ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
                    }
                    alt={effectiveChat.name}
                    className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border-2 border-cyan-500/40 shadow-xs"
                  />
                  {effectiveChat.isOfficial ? (
                    <span
                      className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-950 absolute bottom-0 right-0 flex items-center justify-center text-[7px] text-white font-bold"
                      title={isAr ? 'قناة موثقة' : 'Verified'}
                    >
                      ✓
                    </span>
                  ) : effectiveChat.isOnline !== false ? (
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-950 absolute bottom-0 right-0" />
                  ) : null}
                </div>

                {/* اسم الشخص وحالته المباشرة — يظهر في البار العلوي الأساسي */}
                <div
                  className="min-w-0 flex-1 cursor-pointer select-none"
                  onClick={() => setIsProfileModalOpen(true)}
                  title={isAr ? 'عرض تفاصيل الحساب' : 'View user details'}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h1 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white truncate leading-tight">
                      {effectiveChat.name}
                    </h1>
                    {effectiveChat.isOfficial && (
                      <span className="px-1.5 py-0.2 rounded-md bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 text-[10px] font-bold border border-cyan-500/25 shrink-0">
                        {isAr ? 'رسمي' : 'Official'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate leading-tight mt-0.5">
                    {effectiveChat.isTyping
                      ? isAr
                        ? 'يكتب الآن...'
                        : 'typing...'
                      : effectiveChat.statusText ||
                        (effectiveChat.isOnline !== false
                          ? isAr
                            ? 'متصل الآن'
                            : 'online'
                          : isAr
                          ? 'آخر ظهور اليوم'
                          : 'last seen today')}
                  </div>
                </div>
              </div>

              {/* جهة النهاية: زر ثلاث نقاط الثابت وقائمة الخيارات */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative" ref={menuRef}>
                {/* زر الهدية السريع إذا توفر */}
                {effectiveChat.onSendGift && (
                  <button
                    type="button"
                    onClick={effectiveChat.onSendGift}
                    className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center gap-1 text-xs font-bold cursor-pointer active:scale-95 transition-all shadow-2xs"
                    title={isAr ? 'إرسال هدية' : 'Send Gift'}
                  >
                    <Gift className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="hidden md:inline">{isAr ? 'هدية' : 'Gift'}</span>
                  </button>
                )}

                {/* زر ثلاث نقاط (MoreVertical) */}
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all cursor-pointer border active:scale-95 ${
                    isMenuOpen
                      ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/40 shadow-xs'
                      : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200/80 dark:border-neutral-800'
                  }`}
                  title={isAr ? 'خيارات المحادثة' : 'Chat Options'}
                  aria-label={isAr ? 'خيارات المحادثة' : 'Chat Options'}
                >
                  <MoreVertical className="w-5 h-5 stroke-[2.3]" />
                </button>

                {/* القائمة المنسدلة لزر ثلاث نقاط */}
                {isMenuOpen && (
                  <div
                    className={`absolute top-12 z-50 w-56 sm:w-60 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150 space-y-1 ${
                      isAr ? 'left-0 origin-top-left' : 'right-0 origin-top-right'
                    }`}
                    dir={isAr ? 'rtl' : 'ltr'}
                  >
                    {/* خيار 1: عرض الملف الشخصي / المعرف */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-neutral-100 dark:hover:bg-neutral-800/80 text-xs sm:text-sm font-bold text-neutral-800 dark:text-neutral-200 transition-colors text-start cursor-pointer group"
                    >
                      <User className="w-4 h-4 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform" />
                      <span>{isAr ? 'عرض الملف الشخصي' : 'View Profile'}</span>
                    </button>

                    {/* خيار 2: إرسال هدية */}
                    {effectiveChat.onSendGift && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          effectiveChat.onSendGift?.();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-amber-500/10 text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 transition-colors text-start cursor-pointer group"
                      >
                        <Gift className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                        <span>{isAr ? 'إرسال هدية' : 'Send Gift'}</span>
                      </button>
                    )}

                    {/* خيار 3: كتم / تفعيل الإشعارات */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsMuted((prev) => {
                          const next = !prev;
                          showToast(
                            next
                              ? isAr
                                ? 'تم كتم إشعارات هذه المحادثة 🔕'
                                : 'Chat notifications muted 🔕'
                              : isAr
                              ? 'تم تفعيل إشعارات المحادثة 🔔'
                              : 'Chat notifications unmuted 🔔'
                          );
                          return next;
                        });
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-neutral-100 dark:hover:bg-neutral-800/80 text-xs sm:text-sm font-bold text-neutral-800 dark:text-neutral-200 transition-colors text-start cursor-pointer group"
                    >
                      {isMuted ? (
                        <>
                          <Bell className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                          <span>{isAr ? 'تفعيل الإشعارات' : 'Unmute Notifications'}</span>
                        </>
                      ) : (
                        <>
                          <BellOff className="w-4 h-4 text-neutral-400 group-hover:scale-110 transition-transform" />
                          <span>{isAr ? 'كتم الإشعارات' : 'Mute Notifications'}</span>
                        </>
                      )}
                    </button>

                    {/* خيار 4: مسح المحادثة */}
                    {effectiveChat.onClearChat && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          effectiveChat.onClearChat?.();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-neutral-100 dark:hover:bg-neutral-800/80 text-xs sm:text-sm font-bold text-neutral-700 dark:text-neutral-300 transition-colors text-start cursor-pointer group"
                      >
                        <Trash2 className="w-4 h-4 text-neutral-500 group-hover:scale-110 transition-transform" />
                        <span>{isAr ? 'مسح الرسائل' : 'Clear Messages'}</span>
                      </button>
                    )}

                    {/* خيار 5: إبلاغ وحظر */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsMenuOpen(false);
                        showToast(isAr ? 'تم استلام البلاغ وسيتم مراجعته فوراً' : 'Report submitted and under review');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl hover:bg-rose-500/10 text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 transition-colors text-start cursor-pointer group border-t border-neutral-100 dark:border-neutral-800/60 pt-2"
                    >
                      <ShieldAlert className="w-4 h-4 text-rose-500 group-hover:scale-110 transition-transform" />
                      <span>{isAr ? 'إبلاغ أو حظر' : 'Report / Block'}</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ========================================================
               DEFAULT TOP BAR (البار العلوي عند عدم وجود محادثة نشطة)
               ======================================================== */
            <>
              {/* اسم الموقع — يتحرك مكانه تلقائياً حسب اتجاه اللغة ومصغر بنسبة 5% */}
              <div className="flex items-center shrink-0">
                <button
                  type="button"
                  onClick={onBrandClick}
                  className={`text-[17.1px] sm:text-[19px] font-bold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap shrink-0 flex items-center gap-1.5 sm:gap-2 group cursor-pointer focus:outline-none scale-95 ${
                    isAr ? 'origin-right' : 'origin-left'
                  } transition-all duration-200`}
                  title={isAr ? 'الصفحة الرئيسية' : 'Home'}
                >
                  <span className="font-extrabold tracking-widest text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-500 transition-colors">
                    SOUL<span className="text-neutral-400 dark:text-neutral-500 font-light">—</span>X
                  </span>
                </button>
              </div>

              {/* Center: اسم القسم المفتوح في منتصف البار العلوي تماماً */}
              {effectiveTitle && (
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center max-w-[45%] sm:max-w-[50%] px-2 text-center select-none z-10 animate-in fade-in duration-200"
                  dir={isAr ? 'rtl' : 'ltr'}
                >
                  <span className="text-sm sm:text-base font-bold text-neutral-800 dark:text-neutral-200 tracking-wide truncate">
                    {effectiveTitle}
                  </span>
                </div>
              )}

              {/* أزرار الإجراءات (الأصدقاء، البحث، الرجوع) */}
              <div className="flex items-center gap-2 shrink-0 z-10">
                {effectiveOnBack && (
                  <button
                    type="button"
                    onClick={effectiveOnBack}
                    dir={isAr ? 'rtl' : 'ltr'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 border border-neutral-200/80 dark:border-neutral-800 shadow-xs group"
                  >
                    {isAr ? (
                      <ArrowRight className="w-4 h-4 text-neutral-600 dark:text-neutral-300 transition-transform group-hover:translate-x-0.5" />
                    ) : (
                      <ArrowLeft className="w-4 h-4 text-neutral-600 dark:text-neutral-300 transition-transform group-hover:-translate-x-0.5" />
                    )}
                    <span>{effectiveBackLabel || (isAr ? 'الرجوع' : 'Back')}</span>
                  </button>
                )}

                {/* زر الأصدقاء في قسم الدردشات */}
                {(onOpenFriends || activeTab === 'chats') && !effectiveOnBack && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenFriends) {
                        onOpenFriends();
                      } else {
                        window.dispatchEvent(new CustomEvent('soulx:open-friends'));
                      }
                    }}
                    dir={isAr ? 'rtl' : 'ltr'}
                    className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 shadow-xs hover:border-cyan-500/50 group"
                    title={isAr ? 'الأصدقاء وطلبات الصداقة' : 'Friends & Requests'}
                    aria-label={isAr ? 'الأصدقاء' : 'Friends'}
                  >
                    <Users className="w-4 h-4 transition-transform group-hover:scale-110" />
                    <span>{isAr ? 'الأصدقاء' : 'Friends'}</span>
                    {(propsFriendRequestsCount ?? internalFriendRequestsCount) > 0 && (
                      <span className="min-w-4 h-4 px-1 rounded-full bg-rose-500 text-white font-mono text-[9px] font-black flex items-center justify-center shadow-xs animate-pulse">
                        {(propsFriendRequestsCount ?? internalFriendRequestsCount) > 99
                          ? '99+'
                          : propsFriendRequestsCount ?? internalFriendRequestsCount}
                      </span>
                    )}
                  </button>
                )}

                {/* زر الإعدادات في صفحة حسابي */}
                {activeTab === 'account' && onOpenSettings && !effectiveOnBack && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    dir={isAr ? 'rtl' : 'ltr'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200/80 dark:border-neutral-800 text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 shadow-xs hover:border-cyan-500/40 group"
                    title={isAr ? 'الإعدادات' : 'Settings'}
                    aria-label={isAr ? 'الإعدادات' : 'Settings'}
                  >
                    <Settings className="w-4 h-4 text-cyan-600 dark:text-cyan-400 transition-transform duration-300 group-hover:rotate-45" />
                    <span>{isAr ? 'الإعدادات' : 'Settings'}</span>
                  </button>
                )}

                {onOpenSearch && !effectiveOnBack && (
                  <button
                    type="button"
                    onClick={onOpenSearch}
                    dir={isAr ? 'rtl' : 'ltr'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 shadow-xs hover:border-cyan-500/50"
                    title={isAr ? 'البحث عن صديق بالمعرف أو مسح رمز QR' : 'Search friend by ID or scan QR code'}
                    aria-label={isAr ? 'بحث' : 'Search'}
                  >
                    <Search className="w-4 h-4 stroke-[2.5]" />
                    <span>{isAr ? 'بحث' : 'Search'}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* نافذة عرض الملف الشخصي للمستخدم في المحادثة */}
      {isProfileModalOpen && effectiveChat && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-md animate-in fade-in duration-200"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 relative">
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-4 left-4 rtl:left-4 rtl:right-auto ltr:right-4 ltr:left-auto p-2 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Avatar & Name */}
            <div className="text-center space-y-2 pt-2">
              <div className="relative inline-block">
                <img
                  src={
                    effectiveChat.avatar ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'
                  }
                  alt={effectiveChat.name}
                  className="w-20 h-20 rounded-full object-cover mx-auto border-3 border-cyan-500 shadow-lg"
                />
                {effectiveChat.isOnline !== false && (
                  <span className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900 absolute bottom-1 right-1" />
                )}
              </div>
              <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                {effectiveChat.name}
              </h3>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {effectiveChat.statusText || (isAr ? 'متصل الآن' : 'Online')}
              </p>
            </div>

            {/* ID & Details */}
            <div className="space-y-2.5 bg-neutral-50 dark:bg-neutral-950/60 p-3.5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800">
              {(effectiveChat.displayId || effectiveChat.partnerId) && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {isAr ? 'المعرف (ID):' : 'User ID:'}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">
                    <span>{effectiveChat.displayId || effectiveChat.partnerId}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyId(effectiveChat.displayId || effectiveChat.partnerId || '')}
                      className="p-1 rounded hover:bg-cyan-500/10 cursor-pointer"
                      title={isAr ? 'نسخ المعرف' : 'Copy ID'}
                    >
                      {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {effectiveChat.age && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {isAr ? 'العمر:' : 'Age:'}
                  </span>
                  <span className="text-xs font-bold text-neutral-900 dark:text-white">
                    {effectiveChat.age} {isAr ? 'سنة' : 'years'}
                  </span>
                </div>
              )}

              {effectiveChat.country && (
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {isAr ? 'الدولة:' : 'Country:'}
                  </span>
                  <span className="text-xs font-bold text-neutral-900 dark:text-white truncate max-w-[60%]">
                    {effectiveChat.country}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              {effectiveChat.onSendGift && (
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    effectiveChat.onSendGift?.();
                  }}
                  className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                >
                  <Gift className="w-4 h-4" />
                  <span>{isAr ? 'إرسال هدية' : 'Send Gift'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="flex-1 py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs cursor-pointer active:scale-95 transition-all"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};


