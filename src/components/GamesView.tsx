import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Gamepad2, Play, RefreshCw, Wrench } from 'lucide-react';
import { AuthUser, Language } from '../types';
import { PlinkoGame } from './PlinkoGame';
import { MinesGame } from './MinesGame';
import { DiceGame } from './DiceGame';
import { OlympusGame } from './OlympusGame';
import { BoxesGame } from './BoxesGame';
import { WinterSlotsGame } from './WinterSlotsGame';
import { GoldenTreeGame } from './GoldenTreeGame';
import { GoldenTreeSymbolArt } from './GoldenTreeArt';
import { GAME_BET_AMOUNTS } from '../lib/gamesConfig';
import plinkoCardImg from '../assets/images/plinko_game_card_1794757254790.jpg';
import minesCardImg from '../assets/images/mines_game_card_1794802083243.jpg';
import diceCardImg from '../assets/images/dice_game_card_1794805006562.jpg';
import olympusCardImg from '../assets/images/olympus_game_card_1794815720291.jpg';
import boxesCardImg from '../assets/images/boxes_game_card_1794834717589.jpg';
import winterSlotsCardImg from '../assets/images/winter_slots_card_1794836907232.jpg';

export type ActiveGameId = 'golden-tree' | 'plinko' | 'mines' | 'dice' | 'olympus' | 'boxes' | 'winter-slots' | null;

interface GameMaintenanceState {
  enabled: boolean;
  reasonAr?: string;
  reasonEn?: string;
  updatedAt?: string;
}

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
  const [maintenanceGames, setMaintenanceGames] = useState<Record<string, GameMaintenanceState>>({});
  const [isRefreshingConfig, setIsRefreshingConfig] = useState(false);

  const fetchGamesConfig = useCallback(async () => {
    setIsRefreshingConfig(true);
    try {
      const res = await fetch('/api/games/config');
      const data = await res.json();
      if (res.ok && data?.success && data.maintenanceGames && typeof data.maintenanceGames === 'object') {
        setMaintenanceGames(data.maintenanceGames);
      }
    } catch {
      // silent fallback
    } finally {
      setIsRefreshingConfig(false);
    }
  }, []);

  useEffect(() => {
    fetchGamesConfig();
  }, [fetchGamesConfig, activeGame]);

  const activeMaint = activeGame ? maintenanceGames[activeGame] : undefined;
  if (activeGame && activeMaint?.enabled) {
    const maintReason = isAr
      ? activeMaint.reasonAr || 'هذه اللعبة تحت الصيانة والتطوير حالياً، يرجى المحاولة لاحقاً'
      : activeMaint.reasonEn || 'This game is currently under maintenance for development. Please check back soon.';

    return (
      <div
        className="w-full max-w-xl mx-auto px-4 sm:px-6 py-12 animate-in fade-in duration-300"
        dir={isAr ? 'rtl' : 'ltr'}
      >
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-amber-500/35 shadow-sm text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <Wrench className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-black">
              {isAr ? 'اللعبة تحت الصيانة مؤقتاً' : 'Temporarily Under Maintenance'}
            </span>
            <h2 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white">
              {isAr ? 'جاري التطوير والصيانة' : 'Development & Maintenance'}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
              {maintReason}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={fetchGamesConfig}
              disabled={isRefreshingConfig}
              className="px-4 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold text-neutral-800 dark:text-neutral-100 flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingConfig ? 'animate-spin' : ''}`} />
              <span>{isAr ? 'تحديث الحالة' : 'Check Status'}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectGame(null)}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black flex items-center gap-2 transition-colors cursor-pointer"
            >
              {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
              <span>{isAr ? 'العودة لقائمة الألعاب' : 'Back to Games'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

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

  if (activeGame === 'boxes') {
    return (
      <BoxesGame
        lang={lang}
        currentUser={currentUser}
        coinsBalance={coinsBalance}
        betAmounts={GAME_BET_AMOUNTS}
        onCoinsBalanceSync={onCoinsBalanceSync}
        onOpenWallet={onOpenWallet}
      />
    );
  }

  if (activeGame === 'golden-tree') {
    return (
      <GoldenTreeGame
        lang={lang}
        currentUser={currentUser}
        coinsBalance={coinsBalance}
        betAmounts={GAME_BET_AMOUNTS}
        onCoinsBalanceSync={onCoinsBalanceSync}
        onOpenWallet={onOpenWallet}
      />
    );
  }

  if (activeGame === 'winter-slots') {
    return (
      <WinterSlotsGame
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
      id: 'golden-tree' as const,
      name: 'Golden Tree',
      subtitle: isAr ? '5 بكرات · 10 خطوط ربح · Buy Bonus' : '5 Reels · 10 Paylines · Buy Bonus',
      image: '',
    },
    {
      id: 'winter-slots' as const,
      name: 'Winter Slots',
      subtitle: isAr ? '3 بكرات · رموز الشتاء و Wild' : '3 Reels · Winter & Wild',
      image: winterSlotsCardImg,
    },
    {
      id: 'boxes' as const,
      name: isAr ? 'صناديق الحظ' : 'Mystery Boxes',
      subtitle: isAr ? '8 صناديق · 1x–50x' : '8 Boxes · 1x–50x',
      image: boxesCardImg,
    },
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
          const isInMaint = Boolean(maintenanceGames[game.id]?.enabled);

          return (
            <button
              key={game.id}
              type="button"
              onClick={() => onSelectGame(game.id)}
              className={`group flex flex-col items-stretch text-start rounded-2xl bg-white dark:bg-neutral-900 border shadow-xs transition-all duration-200 overflow-hidden cursor-pointer active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
                isInMaint
                  ? 'border-amber-500/50 opacity-85 hover:opacity-100'
                  : 'border-neutral-200/90 dark:border-neutral-800 hover:border-cyan-500/50 hover:shadow-md'
              }`}
            >
              {/* Square Icon / Image Container */}
              <div className="relative w-full aspect-square bg-neutral-950 overflow-hidden">
                {game.id === 'golden-tree' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#581c87_0%,#240748_55%,#100222_100%)] p-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(250,204,21,0.28),transparent_65%)] pointer-events-none" />
                    <div className="relative z-10 flex flex-col items-center gap-1.5">
                      <GoldenTreeSymbolArt symbol="wild" className="w-20 h-20 drop-shadow-[0_4px_14px_rgba(250,204,21,0.5)]" />
                      <div className="flex items-center gap-1.5 opacity-95">
                        <GoldenTreeSymbolArt symbol="seven" className="w-6 h-6" />
                        <GoldenTreeSymbolArt symbol="scatter_dollar" className="w-6 h-6" />
                        <GoldenTreeSymbolArt symbol="scatter_star" className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                ) : !hasImgError ? (
                  <img
                    src={game.image}
                    alt={game.name}
                    referrerPolicy="no-referrer"
                    onError={() => setImgErrors((prev) => ({ ...prev, [game.id]: true }))}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : game.id === 'winter-slots' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#09182D] text-cyan-300 gap-2 p-4">
                    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" aria-hidden="true">
                      <rect x="8" y="16" width="48" height="32" rx="7" fill="#0F294A" stroke="#38BDF8" strokeWidth="2.5" />
                      <line x1="24" y1="18" x2="24" y2="46" stroke="#1E4B7A" strokeWidth="1.5" />
                      <line x1="40" y1="18" x2="40" y2="46" stroke="#1E4B7A" strokeWidth="1.5" />
                      <path d="M16 25V39M12 29L20 35M20 29L12 35" stroke="#BAE6FD" strokeWidth="2" strokeLinecap="round" />
                      <path d="M29 25H36L31 39" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M49 24L45 33H50L47 40L53 31H48L49 24Z" fill="#38BDF8" />
                    </svg>
                  </div>
                ) : game.id === 'boxes' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#121826] text-amber-400 gap-2 p-4">
                    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none" aria-hidden="true">
                      <rect x="12" y="24" width="40" height="26" rx="5" fill="#1E293B" stroke="#F59E0B" strokeWidth="2.5" />
                      <path d="M12 24C12 17 17 13 32 13C47 13 52 17 52 24H12Z" fill="#293548" stroke="#FBBF24" strokeWidth="2.5" />
                      <rect x="27" y="22" width="10" height="10" rx="3" fill="#FBBF24" />
                    </svg>
                  </div>
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

                {/* Maintenance Overlay or Play indicator */}
                {isInMaint ? (
                  <>
                    <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-[1px] flex flex-col items-center justify-center p-2 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-neutral-950 text-[11px] font-black shadow-md">
                        <Wrench className="w-3 h-3" />
                        <span>{isAr ? 'تحت الصيانة' : 'Maintenance'}</span>
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                    <div className="absolute bottom-2.5 end-2.5 w-8 h-8 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center shadow-md transition-transform duration-200 group-hover:scale-110">
                      <Play className="w-4 h-4 fill-current" />
                    </div>
                  </>
                )}
              </div>

              {/* Game Name Footer */}
              <div className="p-3 flex items-center justify-between gap-2 bg-white dark:bg-neutral-900">
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white truncate">
                    {game.name}
                  </h2>
                  <span
                    className={`text-[11px] font-semibold block truncate ${
                      isInMaint
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {isInMaint
                      ? isAr
                        ? 'موقوفة مؤقتاً للصيانة والتطوير'
                        : 'Paused for maintenance'
                      : game.subtitle}
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
