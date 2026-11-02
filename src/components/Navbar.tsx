import React from 'react';
import { Language, AuthUser } from '../types';

interface NavbarProps {
  lang: Language;
  walletBalance: number;
  coinsBalance?: number;
  onOpenWallet: (tab?: 'diamonds' | 'coins') => void;
  onBrandClick: () => void;
  onNavigateToChats?: (friendName?: string) => void;
  currentUser?: AuthUser | null;
  onOpenAdmin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  lang,
  walletBalance,
  coinsBalance = 25000,
  onOpenWallet,
  onBrandClick,
}) => {
  const isAr = lang === 'ar';

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/85 dark:bg-neutral-950/85 border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand wordmark */}
        <button
          type="button"
          onClick={onBrandClick}
          className="text-lg sm:text-xl font-bold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap shrink-0 flex items-center gap-1.5 sm:gap-2 group cursor-pointer focus:outline-none"
        >
          <span className="font-extrabold tracking-widest text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-500 transition-colors">
            SOUL<span className="text-neutral-400 dark:text-neutral-500 font-light">—</span>X
          </span>
        </button>

        {/* Right side controls: Diamonds & Coins Balances */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Coins Badge */}
          <button
            type="button"
            onClick={() => onOpenWallet('coins')}
            title={isAr ? 'رصيد كوينز (Coins)' : 'Coins Balance'}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:border-amber-500/50 transition-all duration-200 cursor-pointer shadow-xs active:scale-95 group shrink-0"
          >
            <span className="text-xs sm:text-sm">🪙</span>
            <span className="font-mono text-xs sm:text-sm font-bold tabular-nums">
              {coinsBalance.toLocaleString()}
            </span>
          </button>

          {/* Diamonds Badge */}
          <button
            type="button"
            onClick={() => onOpenWallet('diamonds')}
            title={isAr ? 'رصيد الماس (Diamonds)' : 'Diamonds Balance'}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:border-cyan-500/50 transition-all duration-200 cursor-pointer shadow-xs active:scale-95 group shrink-0"
          >
            <svg
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-500 fill-cyan-500/20 stroke-cyan-500 stroke-[1.8] shrink-0 transition-transform group-hover:scale-110"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <polygon points="6 3 18 3 22 9 12 22 2 9 6 3" />
              <polyline points="11 3 8 9 12 22 16 9 13 3" fill="none" />
              <line x1="2" y1="9" x2="22" y2="9" />
            </svg>
            <span className="font-mono text-xs sm:text-sm font-bold tabular-nums">
              {walletBalance.toLocaleString()}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
