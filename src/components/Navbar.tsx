import React from 'react';
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
}

export const Navbar: React.FC<NavbarProps> = ({
  lang = 'ar',
  onBrandClick,
}) => {

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/85 dark:bg-neutral-950/85 border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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
      </div>
    </header>
  );
};
