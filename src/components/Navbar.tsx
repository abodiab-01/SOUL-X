import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Language, AuthUser } from '../types';

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
}

export const Navbar: React.FC<NavbarProps> = ({
  lang = 'ar',
  onBrandClick,
  onBack,
  backLabel,
}) => {
  const isAr = lang === 'ar';

  // Dynamic back button registered by child views (e.g. ChatsView active chat, FriendsView, etc.)
  const [dynamicBack, setDynamicBack] = useState<{
    onBack: () => void;
    label?: string;
  } | null>(null);

  useEffect(() => {
    const handleSetBack = (e: any) => {
      const detail = e.detail;
      if (detail && typeof detail.onBack === 'function') {
        setDynamicBack({
          onBack: detail.onBack,
          label: detail.label,
        });
      } else {
        setDynamicBack(null);
      }
    };

    window.addEventListener('soulx:set-navbar-back', handleSetBack);
    return () => {
      window.removeEventListener('soulx:set-navbar-back', handleSetBack);
    };
  }, []);

  const effectiveOnBack = onBack || dynamicBack?.onBack;
  const effectiveBackLabel = backLabel || dynamicBack?.label;

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/85 dark:bg-neutral-950/85 border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      {/* 
        Forced dir="ltr" on the top bar container so that:
        1. The website brand (SOUL-X) is ALWAYS physically on the LEFT in BOTH languages (Arabic and English).
        2. Any menu/view with a back button is ALWAYS physically in the RIGHT corner.
      */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between" dir="ltr">
        {/* Left Side: اسم الموقع دائماً على اليسار في كلا اللغتين */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onBrandClick}
            className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap shrink-0 flex items-center gap-1.5 sm:gap-2 group cursor-pointer focus:outline-none"
            title={isAr ? 'الصفحة الرئيسية' : 'Home'}
          >
            <span className="font-extrabold tracking-widest text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-500 transition-colors">
              SOUL<span className="text-neutral-400 dark:text-neutral-500 font-light">—</span>X
            </span>
          </button>
        </div>

        {/* Right Corner: زر العودة في الزاوية اليمين دائماً عند وجود قائمة تحتوي على زر عودة */}
        <div className="flex items-center shrink-0">
          {effectiveOnBack && (
            <button
              type="button"
              onClick={effectiveOnBack}
              dir={isAr ? 'rtl' : 'ltr'}
              className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-900 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 border border-neutral-200/80 dark:border-neutral-800 shadow-xs group"
            >
              {isAr ? (
                <ArrowRight className="w-4 h-4 text-neutral-600 dark:text-neutral-300 transition-transform group-hover:translate-x-0.5" />
              ) : (
                <ArrowLeft className="w-4 h-4 text-neutral-600 dark:text-neutral-300 transition-transform group-hover:-translate-x-0.5" />
              )}
              <span>{effectiveBackLabel || (isAr ? 'الرجوع' : 'Back')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
