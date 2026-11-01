import React, { useState, useEffect } from 'react';
import { Search, UserPlus, Sparkles, ShieldAlert } from 'lucide-react';
import { Language, AuthUser } from '../types';
import { FriendSearchModal } from './FriendSearchModal';

interface NavbarProps {
  lang: Language;
  walletBalance: number;
  onOpenWallet: () => void;
  onBrandClick: () => void;
  onNavigateToChats?: (friendName?: string) => void;
  currentUser?: AuthUser | null;
  onOpenAdmin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  lang,
  walletBalance,
  onOpenWallet,
  onBrandClick,
  onNavigateToChats,
  currentUser,
  onOpenAdmin,
}) => {
  const isAr = lang === 'ar';
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  useEffect(() => {
    const email = currentUser?.email?.toLowerCase().trim();
    if (!email) {
      setIsAdminUser(false);
      return;
    }

    fetch('/api/admin/check-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then((res) => res.json())
      .then((data) => {
        setIsAdminUser(Boolean(data.isAdmin));
      })
      .catch(() => {
        setIsAdminUser(false);
      });
  }, [currentUser?.email]);

  return (
    <>
      <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/85 dark:bg-neutral-950/85 border-b border-neutral-200 dark:border-neutral-800 transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Zone 1: Brand wordmark */}
          <button
            type="button"
            onClick={onBrandClick}
            className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap shrink-0 flex items-center gap-1.5 sm:gap-2 group cursor-pointer focus:outline-none"
          >
            <span className="font-extrabold tracking-widest text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-500 transition-colors">
              SOUL<span className="text-neutral-400 dark:text-neutral-500 font-light">—</span>X
            </span>
          </button>

          {/* Zone 2: بحث عن صديق بالمعرف (ID) في البار العلوي */}
          <div className="flex-1 max-w-xs sm:max-w-md mx-1 sm:mx-4">
            {/* Desktop / Tablet Search Trigger Bar */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="w-full h-9 sm:h-10 px-3 sm:px-4 rounded-full bg-neutral-100 hover:bg-neutral-200/80 dark:bg-neutral-900/90 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/50 dark:hover:border-cyan-500/50 transition-all duration-200 cursor-pointer flex items-center justify-between gap-2 group text-start shadow-xs"
              title={isAr ? 'بحث عن صديق بالمعرف الرقمي (ID)' : 'Search friend by ID'}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Search className="w-4 h-4 text-neutral-400 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors shrink-0" />
                <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  <span className="hidden sm:inline">
                    {isAr ? 'بحث عن صديق بالمعرّف الرقمي (ID)...' : 'Search friend by ID...'}
                  </span>
                  <span className="sm:hidden">
                    {isAr ? 'بحث بالمعرّف (ID)...' : 'Search by ID...'}
                  </span>
                </span>
              </div>

              {/* User Plus Quick Icon */}
              <div className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-semibold border border-cyan-500/20 group-hover:bg-cyan-500 group-hover:text-neutral-950 transition-colors">
                <UserPlus className="w-3 h-3 stroke-[2.2]" />
                <span className="hidden md:inline font-mono">
                  {isAr ? 'طلب صداقة' : 'Add'}
                </span>
              </div>
            </button>
          </div>

          {/* Zone 3: لوحة تحكم الإدارة (ADMIN1 و ADMIN2) + الرصيد */}
          <div className="flex items-center gap-2 shrink-0">
            {isAdminUser && onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                title={isAr ? 'لوحة تحكم الإدارة' : 'Admin Control Panel'}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 hover:border-amber-500/60 text-amber-700 dark:text-amber-300 transition-all duration-200 cursor-pointer shadow-xs active:scale-95 group shrink-0"
              >
                <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/25 text-amber-700 dark:text-amber-300">
                  ADMIN
                </span>
                <span className="text-xs font-bold hidden sm:inline">
                  {isAr ? 'لوحة التحكم' : 'Admin'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenWallet}
              title={isAr ? 'فتح المحفظة وشحن الرصيد' : 'Open Wallet & Recharge'}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:border-cyan-500/50 transition-all duration-200 cursor-pointer shadow-xs active:scale-95 group shrink-0"
            >
              {/* Diamond SVG Icon */}
              <svg
                className="w-4 h-4 text-cyan-500 fill-cyan-500/20 stroke-cyan-500 stroke-[1.8] shrink-0 transition-transform group-hover:scale-110"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <polygon points="6 3 18 3 22 9 12 22 2 9 6 3" />
                <polyline points="11 3 8 9 12 22 16 9 13 3" fill="none" />
                <line x1="2" y1="9" x2="22" y2="9" />
              </svg>

              {/* Balance Number */}
              <span className="font-mono text-xs sm:text-sm font-bold tabular-nums">
                {walletBalance.toLocaleString()}
              </span>

              <span className="text-[10px] text-cyan-600/70 dark:text-cyan-400/70 font-semibold hidden md:inline">
                {isAr ? 'ماسة' : 'Diamonds'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* نافذة البحث عن صديق بالمعرف وإرسال طلب الصداقة */}
      <FriendSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        lang={lang}
        onNavigateToChats={onNavigateToChats}
      />
    </>
  );
};
