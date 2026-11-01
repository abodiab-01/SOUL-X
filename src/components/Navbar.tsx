import { Language } from '../types';

interface NavbarProps {
  lang: Language;
  walletBalance: number;
  onOpenWallet: () => void;
  onBrandClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  lang,
  walletBalance,
  onOpenWallet,
  onBrandClick,
}) => {
  const isAr = lang === 'ar';

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-white/80 dark:bg-neutral-950/85 border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element Brand wordmark */}
        <button
          type="button"
          onClick={onBrandClick}
          className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white whitespace-nowrap shrink-0 flex items-center gap-2 group cursor-pointer focus:outline-none"
        >
          <span className="font-extrabold tracking-widest text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-500 transition-colors">
            SOUL<span className="text-neutral-400 dark:text-neutral-500 font-light">—</span>X
          </span>
        </button>

        {/* Zone 2: الرصيد في البار العلوي */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenWallet}
            title={isAr ? 'فتح المحفظة وشحن الرصيد' : 'Open Wallet & Recharge'}
            className="flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:border-cyan-500/50 transition-all duration-200 cursor-pointer shadow-xs active:scale-95 group shrink-0"
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

            {/* Balance Number with English Digits */}
            <span className="font-mono text-xs sm:text-sm font-bold tabular-nums">
              {walletBalance.toLocaleString()}
            </span>

            <span className="text-[10px] text-cyan-600/70 dark:text-cyan-400/70 font-semibold hidden sm:inline">
              {isAr ? 'ماسة' : 'Diamonds'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
