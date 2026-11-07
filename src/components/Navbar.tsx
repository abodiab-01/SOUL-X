import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Search, Users } from 'lucide-react';
import { Language, AuthUser } from '../types';
import { TabType } from './BottomNav';

interface NavbarProps {
  lang: Language;
  walletBalance?: number;
  coinsBalance?: number;
  onOpenWallet?: (tab?: 'diamonds' | 'coins') => void;
  onBrandClick: () => void;
  onNavigateToChats?: (friendName?: string) => void;
  currentUser?: AuthUser | null;
  onOpenAdmin?: () => void;
  onBack?: (() => void) | null;
  backLabel?: string | null;
  onOpenSearch?: (() => void) | null;
  onOpenFriends?: (() => void) | null;
  friendRequestsCount?: number;
  title?: string | null;
  activeTab?: TabType;
}

export const Navbar: React.FC<NavbarProps> = ({
  lang = 'ar',
  onBrandClick,
  onBack,
  backLabel,
  onOpenSearch,
  onOpenFriends,
  friendRequestsCount: propsFriendRequestsCount,
  title,
  activeTab,
}) => {
  const isAr = lang === 'ar';

  const tabTitles: Record<TabType, { ar: string; en: string }> = {
    home: { ar: 'الرئيسية', en: 'Home' },
    match: { ar: 'المطابقة', en: 'Match' },
    chats: { ar: 'الدردشات', en: 'Chats' },
    account: { ar: 'حسابي', en: 'Account' },
  };

  // Dynamic back button registered by child views (e.g. ChatsView active chat, FriendsView, etc.)
  const [dynamicBack, setDynamicBack] = useState<{
    onBack: () => void;
    label?: string;
    title?: string;
  } | null>(null);

  const [dynamicTitle, setDynamicTitle] = useState<string | null>(null);
  const [internalFriendRequestsCount, setInternalFriendRequestsCount] = useState<number>(0);

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

    const handleFriendRequestsCount = (e: any) => {
      if (typeof e.detail?.count === 'number') {
        setInternalFriendRequestsCount(e.detail.count);
      }
    };

    window.addEventListener('soulx:set-navbar-back', handleSetBack);
    window.addEventListener('soulx:set-navbar-title', handleSetTitle);
    window.addEventListener('soulx_friend_requests_count', handleFriendRequestsCount);
    return () => {
      window.removeEventListener('soulx:set-navbar-back', handleSetBack);
      window.removeEventListener('soulx:set-navbar-title', handleSetTitle);
      window.removeEventListener('soulx_friend_requests_count', handleFriendRequestsCount);
    };
  }, []);

  const effectiveOnBack = onBack || dynamicBack?.onBack;
  const effectiveBackLabel = backLabel || dynamicBack?.label;
  const defaultTabTitle = activeTab ? (isAr ? tabTitles[activeTab]?.ar : tabTitles[activeTab]?.en) : null;
  const effectiveTitle = dynamicTitle || dynamicBack?.title || title || defaultTabTitle;

  return (
    <header
      className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/85 dark:bg-neutral-950/85 border-b border-neutral-200 dark:border-neutral-800 transition-colors"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* 
        حاوية البار العلوي ديناميكية حسب اتجاه اللغة (RTL للعربية / LTR للإنجليزية):
        1. اسم الموقع (SOUL-X) في جهة البداية (اليمين في العربية، واليسار في الإنجليزية) ومصغر بنسبة 5%.
        2. اسم القسم المفتوح يظهر دائماً في منتصف البار تماماً.
        3. أزرار الإجراءات (الأصدقاء، البحث، أو زر الرجوع) في جهة النهاية (اليسار في العربية، واليمين في الإنجليزية).
      */}
      <div
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between relative"
        dir={isAr ? 'rtl' : 'ltr'}
      >
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

        {/* أزرار الإجراءات (الأصدقاء، البحث، الرجوع) — تتحرك تلقائياً للطرف المقابل حسب اللغة */}
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

          {/* زر الأصدقاء في يمين البار العلوي عند التواجد في قسم الدردشات */}
          {((onOpenFriends || activeTab === 'chats') && !effectiveOnBack) && (
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
                    : (propsFriendRequestsCount ?? internalFriendRequestsCount)}
                </span>
              )}
            </button>
          )}

          {onOpenSearch && !effectiveOnBack && (
            <button
              type="button"
              onClick={onOpenSearch}
              dir={isAr ? 'rtl' : 'ltr'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 shadow-xs hover:border-cyan-500/50"
              title={isAr ? 'البحث عن صديق بالمعرف أو مسح باركود' : 'Search friend by ID or scan barcode'}
              aria-label={isAr ? 'بحث' : 'Search'}
            >
              <Search className="w-4 h-4 stroke-[2.5]" />
              <span>{isAr ? 'بحث' : 'Search'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
