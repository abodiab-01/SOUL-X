import React, { useState } from 'react';
import { Gamepad2, ShoppingBag, Clock, Lock, TrendingUp } from 'lucide-react';
import { Language, AuthUser } from '../types';

interface HomeViewProps {
  lang: Language;
  currentUser?: AuthUser | null;
  gamesEnabled?: boolean;
  storeEnabled?: boolean;
  onNavigateToTab?: (tab: 'home' | 'match' | 'chats' | 'account') => void;
  onGoToChat?: (friendName?: string) => void;
  onOpenWallet?: () => void;
  onOpenSearch?: () => void;
  onOpenGames?: () => void;
  onOpenStore?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  lang,
  gamesEnabled = true,
  storeEnabled = true,
  onOpenGames,
  onOpenStore,
}) => {
  const isAr = lang === 'ar';
  const [selectedCard, setSelectedCard] = useState<'games' | 'store' | 'soul-trader-pro' | null>(null);

  const cards = [
    {
      id: 'games' as const,
      enabled: gamesEnabled,
      title: isAr ? 'الألعاب' : 'Games',
      secondaryTitle: isAr ? 'Games' : 'الألعاب',
      statusLabel: gamesEnabled
        ? isAr
          ? 'متاح الآن · العب الآن'
          : 'Available · Play Now'
        : isAr
        ? 'معطّل حالياً من الإدارة'
        : 'Currently Disabled',
      activeNotice: isAr ? 'متاح الآن · العب الآن' : 'Available · Play Now',
      Icon: Gamepad2,
      accentText: gamesEnabled ? 'text-cyan-600 dark:text-cyan-400' : 'text-neutral-500 dark:text-neutral-400',
      iconSurface: gamesEnabled
        ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
        : 'bg-neutral-200/70 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border-neutral-300/70 dark:border-neutral-700',
      colClass: '',
    },
    {
      id: 'store' as const,
      enabled: storeEnabled,
      title: isAr ? 'المتجر' : 'Store',
      secondaryTitle: isAr ? 'Store' : 'المتجر',
      statusLabel: storeEnabled
        ? isAr
          ? 'متاح الآن · تصفح الإطارات'
          : 'Available · Browse Frames'
        : isAr
        ? 'معطّل حالياً من الإدارة'
        : 'Currently Disabled',
      activeNotice: isAr ? 'متاح الآن · تصفح الإطارات' : 'Available · Browse Frames',
      Icon: ShoppingBag,
      accentText: storeEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-500 dark:text-neutral-400',
      iconSurface: storeEnabled
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
        : 'bg-neutral-200/70 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 border-neutral-300/70 dark:border-neutral-700',
      colClass: '',
    },
    {
      id: 'soul-trader-pro' as const,
      enabled: true,
      title: 'Soul-Trader Pro',
      secondaryTitle: isAr ? 'تداول برو' : 'Pro Trading',
      statusLabel: isAr ? 'قريباً · Coming Soon' : 'Coming Soon · قريباً',
      activeNotice: isAr
        ? 'سيتم إطلاق Soul-Trader Pro قريباً.'
        : 'Soul-Trader Pro launching soon.',
      Icon: TrendingUp,
      accentText: 'text-emerald-600 dark:text-emerald-400',
      iconSurface: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      colClass: 'sm:col-start-2',
    },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col justify-center min-h-[calc(100dvh-14rem)] py-6 px-4 sm:px-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
        {cards.map((card) => {
          const IconComponent = card.Icon;
          const isSelected = card.enabled && selectedCard === card.id;

          return (
            <button
              key={card.id}
              type="button"
              disabled={!card.enabled}
              onClick={() => {
                if (!card.enabled) return;
                if (card.id === 'games' && onOpenGames) {
                  onOpenGames();
                  return;
                }
                if (card.id === 'store' && onOpenStore) {
                  onOpenStore();
                  return;
                }
                setSelectedCard((prev) => (prev === card.id ? null : card.id));
              }}
              aria-pressed={card.id === 'games' || card.id === 'store' || !card.enabled ? undefined : isSelected}
              className={`group text-start w-full rounded-2xl p-5 border flex flex-col justify-between gap-4 transition-transform duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${card.colClass} ${
                !card.enabled
                  ? 'bg-neutral-100/90 dark:bg-neutral-900/50 border-neutral-200/80 dark:border-neutral-800/80 opacity-65 cursor-not-allowed'
                  : isSelected
                  ? 'bg-white dark:bg-neutral-900 border-neutral-400 dark:border-neutral-600 shadow-md cursor-pointer active:scale-[0.99]'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-sm cursor-pointer active:scale-[0.99]'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2 min-w-0">
                  <h2 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white tracking-tight truncate">
                    {card.title}
                  </h2>
                  <span className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 whitespace-nowrap shrink-0">
                    {card.secondaryTitle}
                  </span>
                </div>

                <div
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 ${
                    card.enabled ? 'group-hover:scale-105' : ''
                  } ${card.iconSurface}`}
                >
                  <IconComponent className="w-5 h-5 stroke-[2]" />
                </div>
              </div>

              {/* Hairline Footer */}
              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center gap-2">
                {card.enabled ? (
                  <Clock className={`w-3.5 h-3.5 shrink-0 ${card.accentText}`} />
                ) : (
                  <Lock className={`w-3.5 h-3.5 shrink-0 ${card.accentText}`} />
                )}
                <span className={`text-xs font-bold leading-relaxed ${card.accentText}`}>
                  {isSelected ? card.activeNotice : card.statusLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
