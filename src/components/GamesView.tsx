import React, { useState } from 'react';
import { Gamepad2, Play } from 'lucide-react';
import { AuthUser, Language } from '../types';
import { PlinkoGame } from './PlinkoGame';
import { MinesGame } from './MinesGame';
import { DiceGame } from './DiceGame';
import { OlympusGame } from './OlympusGame';
import { GAME_BET_AMOUNTS } from '../lib/gamesConfig';
import plinkoCardImg from '../assets/images/plinko_game_card_1794757254790.jpg';
import minesCardImg from '../assets/images/mines_game_card_1794802083243.jpg';
import diceCardImg from '../assets/images/dice_game_card_1794805006562.jpg';
import olympusCardImg from '../assets/images/olympus_game_card_1794815720291.jpg';

export type ActiveGameId = 'plinko' | 'mines' | 'dice' | 'olympus' | null;

interface GamesViewProps {
  lang: Language;
  currentUser: AuthUser | null;
  coinsBalance: number;
  activeGame: ActiveGameId;
  onSelectGame: (game: ActiveGameId) => void;
  onCoinsBalanceSync: (nextBalance: number) => void;
  onOpenWallet: () => void;
}

export const GamesView: React.FC<GamesViewProps> = ({
  lang,
  currentUser,
  coinsBalance,
  activeGame,
  onSelectGame,
  onCoinsBalanceSync,
  onOpenWallet,
}) => {
  const isAr = lang === 'ar';
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  if (activeGame === 'plinko') {
    return (
      <PlinkoGame
        lang={lang}
        currentUser={currentUser}
        coinsBalance={coinsBalance}
        betAmounts={GAME_BET_AMOUNTS}
        onCoinsBalanceSync={onCoinsBalanceSync}
        onOpenWallet={onOpenWallet}
      />
    );
  }

  if (activeGame === 'mines') {
    return (
      <MinesGame
        lang={lang}
        currentUser={currentUser}
        coinsBalance={coinsBalance}
        betAmounts={GAME_BET_AMOUNTS}
        onCoinsBalanceSync={onCoinsBalanceSync}
        onOpenWallet={onOpenWallet}
      />
    );
  }

  if (activeGame === 'dice') {
    return (
      <DiceGame
        lang={lang}
        currentUser={currentUser}
        coinsBalance={coinsBalance}
        betAmounts={GAME_BET_AMOUNTS}
        onCoinsBalanceSync={onCoinsBalanceSync}
        onOpenWallet={onOpenWallet}
      />
    );
  }

  if (activeGame === 'olympus') {
    return (
      <OlympusGame
        lang={lang}
        currentUser={currentUser}
        coinsBalance={coinsBalance}
        betAmounts={GAME_BET_AMOUNTS}
        onCoinsBalanceSync={onCoinsBalanceSync}
        onOpenWallet={onOpenWallet}
      />
    );
  }

  const availableGames = [
    {
      id: 'olympus' as const,
      name: 'Olympus Gates',
      subtitle: isAr ? 'بوابات أوليمبوس' : 'Zeus Multipliers',
      image: olympusCardImg,
    },
    {
      id: 'plinko' as const,
      name: 'Plinko',
      subtitle: isAr ? 'بلينكو' : 'Arcade Drop',
      image: plinkoCardImg,
    },
    {
      id: 'mines' as const,
      name: 'Mines',
      subtitle: isAr ? 'الألغام والجواهر' : 'Gems & Bombs',
      image: minesCardImg,
    },
    {
      id: 'dice' as const,
      name: 'Dice',
      subtitle: isAr ? 'النرد' : 'Roll Over / Under',
      image: diceCardImg,
    },
  ];

  return (
    <div
      className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-5 pb-24 space-y-5 animate-in fade-in duration-300"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white leading-tight">
              {isAr ? 'الألعاب المتوفرة' : 'Available Games'}
            </h1>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
              {isAr ? 'اختر لعبة للعب برصيد الكوينز الخاص بك' : 'Select a game to play using your Coins balance'}
            </p>
          </div>
        </div>
      </div>

      {/* Square Game Tiles Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {availableGames.map((game) => {
          const hasImgError = Boolean(imgErrors[game.id]);

          return (
            <button
              key={game.id}
              type="button"
              onClick={() => onSelectGame(game.id)}
              className="group flex flex-col items-stretch text-start rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 hover:border-cyan-500/50 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              {/* Square Icon / Image Container */}
              <div className="relative w-full aspect-square bg-neutral-950 overflow-hidden">
                {!hasImgError ? (
                  <img
                    src={game.image}
                    alt={game.name}
                    referrerPolicy="no-referrer"
                    onError={() => setImgErrors((prev) => ({ ...prev, [game.id]: true }))}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : game.id === 'olympus' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#120E2B] text-amber-400 gap-2 p-4">
                    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" aria-hidden="true">
                      <path d="M12 44L9 20L22 30L32 14L42 30L55 20L52 44H12Z" fill="#F59E0B" stroke="#FEF3C7" strokeWidth="2" />
                      <path d="M35 20L25 35H33L30 48L41 32H33L35 20Z" fill="#38BDF8" />
                    </svg>
                  </div>
                ) : game.id === 'mines' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-emerald-400 gap-2 p-4">
                    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" aria-hidden="true">
                      <polygon points="32,12 46,24 32,50 18,24" fill="#10B981" stroke="#34D399" strokeWidth="2" />
                      <circle cx="46" cy="44" r="8" fill="#1E293B" stroke="#EF4444" strokeWidth="2" />
                      <circle cx="46" cy="44" r="3" fill="#EF4444" />
                    </svg>
                  </div>
                ) : game.id === 'dice' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-amber-400 gap-2 p-4">
                    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" aria-hidden="true">
                      <rect x="14" y="14" width="36" height="36" rx="8" fill="#1E293B" stroke="#F59E0B" strokeWidth="2.5" />
                      <circle cx="24" cy="24" r="3" fill="#FBBF24" />
                      <circle cx="40" cy="24" r="3" fill="#FBBF24" />
                      <circle cx="32" cy="32" r="3" fill="#22D3EE" />
                      <circle cx="24" cy="40" r="3" fill="#FBBF24" />
                      <circle cx="40" cy="40" r="3" fill="#FBBF24" />
                    </svg>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-amber-400 gap-2 p-4">
                    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" aria-hidden="true">
                      <circle cx="32" cy="14" r="3" fill="#22D3EE" />
                      <circle cx="24" cy="26" r="3" fill="#22D3EE" />
                      <circle cx="40" cy="26" r="3" fill="#FBBF24" />
                      <circle cx="16" cy="38" r="3" fill="#22D3EE" />
                      <circle cx="32" cy="38" r="4.5" fill="#F59E0B" />
                      <circle cx="48" cy="38" r="3" fill="#22D3EE" />
                      <rect x="10" y="50" width="12" height="6" rx="2" fill="#EF4444" />
                      <rect x="26" y="50" width="12" height="6" rx="2" fill="#10B981" />
                      <rect x="42" y="50" width="12" height="6" rx="2" fill="#EF4444" />
                    </svg>
                  </div>
                )}

                {/* Subtle bottom gradient & Play indicator */}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                <div className="absolute bottom-2.5 end-2.5 w-8 h-8 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center shadow-md transition-transform duration-200 group-hover:scale-110">
                  <Play className="w-4 h-4 fill-current" />
                </div>
              </div>

              {/* Game Name Footer */}
              <div className="p-3 flex items-center justify-between gap-2 bg-white dark:bg-neutral-900">
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white truncate">
                    {game.name}
                  </h2>
                  <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block truncate">
                    {game.subtitle}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
