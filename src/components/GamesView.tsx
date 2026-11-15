import React, { useState } from 'react';
import { Gamepad2, Play } from 'lucide-react';
import { AuthUser, Language } from '../types';
import { PlinkoGame } from './PlinkoGame';
import { GAME_BET_AMOUNTS } from '../lib/gamesConfig';
import plinkoCardImg from '../assets/images/plinko_game_card_1794757254790.jpg';

export type ActiveGameId = 'plinko' | null;

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
  const [imgError, setImgError] = useState(false);

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

  const availableGames = [
    {
      id: 'plinko' as const,
      name: 'Plinko',
      subtitle: isAr ? 'بلينكو' : 'Arcade Drop',
      image: plinkoCardImg,
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
        {availableGames.map((game) => (
          <button
            key={game.id}
            type="button"
            onClick={() => onSelectGame(game.id)}
            className="group flex flex-col items-stretch text-start rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 hover:border-cyan-500/50 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            {/* Square Icon / Image Container */}
            <div className="relative w-full aspect-square bg-neutral-950 overflow-hidden">
              {!imgError ? (
                <img
                  src={game.image}
                  alt={game.name}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
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

              {/* Subtle bottom gradient & Play indicator on hover */}
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
        ))}
      </div>
    </div>
  );
};
