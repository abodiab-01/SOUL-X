import React, { useState } from 'react';
import { Gamepad2, ShoppingBag, Clock } from 'lucide-react';
import { Language, AuthUser } from '../types';
import gamesArtwork from '../assets/images/games_coming_soon_1794740632589.jpg';
import storeArtwork from '../assets/images/store_coming_soon_1794740632338.jpg';

interface HomeViewProps {
  lang: Language;
  currentUser?: AuthUser | null;
  onNavigateToTab?: (tab: 'home' | 'match' | 'chats' | 'account') => void;
  onGoToChat?: (friendName?: string) => void;
  onOpenWallet?: () => void;
  onOpenSearch?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ lang }) => {
  const isAr = lang === 'ar';
  const [selectedCard, setSelectedCard] = useState<'games' | 'store' | null>(null);
  const [gamesImgError, setGamesImgError] = useState(false);
  const [storeImgError, setStoreImgError] = useState(false);

  const cards = [
    {
      id: 'games' as const,
      title: isAr ? 'الألعاب' : 'Games',
      secondaryTitle: isAr ? 'Games' : 'الألعاب',
      statusLabel: isAr ? 'قريباً · Coming Soon' : 'Coming Soon · قريباً',
      description: isAr
        ? 'ألعاب تفاعلية وتحديات جماعية ممتعة مع الأصدقاء قيد التطوير حالياً.'
        : 'Interactive multiplayer games and challenges with friends are currently in development.',
      activeNotice: isAr
        ? 'سيتم إطلاق قسم الألعاب قريباً في التحديثات القادمة.'
        : 'The Games hub will launch soon in an upcoming release.',
      image: gamesArtwork,
      imgError: gamesImgError,
      onImgError: () => setGamesImgError(true),
      Icon: Gamepad2,
      accentText: 'text-cyan-600 dark:text-cyan-400',
      iconSurface: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
      fallbackGradient: 'from-neutral-900 via-cyan-950/60 to-neutral-950',
    },
    {
      id: 'store' as const,
      title: isAr ? 'المتجر' : 'Store',
      secondaryTitle: isAr ? 'Store' : 'المتجر',
      statusLabel: isAr ? 'قريباً · Coming Soon' : 'Coming Soon · قريباً',
      description: isAr
        ? 'متجر حصري للإطارات والهدايا والمقتنيات المميزة قريباً في متناول يدك.'
        : 'An exclusive boutique for profile frames, gifts, and collectibles arriving soon.',
      activeNotice: isAr
        ? 'سيتم افتتاح المتجر قريباً في التحديثات القادمة.'
        : 'The Store will open soon in an upcoming release.',
      image: storeArtwork,
      imgError: storeImgError,
      onImgError: () => setStoreImgError(true),
      Icon: ShoppingBag,
      accentText: 'text-amber-600 dark:text-amber-400',
      iconSurface: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      fallbackGradient: 'from-neutral-900 via-amber-950/50 to-neutral-950',
    },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col justify-center min-h-[calc(100dvh-13rem)] py-6 px-4 sm:px-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {cards.map((card) => {
          const IconComponent = card.Icon;
          const isSelected = selectedCard === card.id;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedCard((prev) => (prev === card.id ? null : card.id))}
              aria-pressed={isSelected}
              className={`group text-start w-full rounded-3xl overflow-hidden bg-white dark:bg-neutral-900 border transition-transform duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 flex flex-col justify-between cursor-pointer ${
                isSelected
                  ? 'border-neutral-400 dark:border-neutral-600 shadow-lg'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-sm'
              }`}
            >
              {/* Visual Artwork Header */}
              <div className="relative w-full aspect-video overflow-hidden bg-neutral-950">
                {!card.imgError ? (
                  <img
                    src={card.image}
                    alt={card.title}
                    referrerPolicy="no-referrer"
                    onError={card.onImgError}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div
                    className={`w-full h-full bg-gradient-to-br ${card.fallbackGradient} flex items-center justify-center`}
                  >
                    <IconComponent className="w-14 h-14 text-white/30" />
                  </div>
                )}

                {/* Measured scrim for crisp foreground legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

                {/* Clean overlay status strip */}
                <div className="absolute bottom-4 inset-x-5 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-xs font-bold tracking-wide text-white/95">
                    <Clock className="w-3.5 h-3.5 text-white/80 shrink-0" />
                    <span className="whitespace-nowrap">{card.statusLabel}</span>
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 sm:p-7 flex-1 flex flex-col justify-between gap-5">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-baseline gap-2.5 min-w-0">
                      <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight truncate">
                        {card.title}
                      </h2>
                      <span className="text-xs font-semibold text-neutral-400 dark:text-neutral-500 whitespace-nowrap shrink-0">
                        {card.secondaryTitle}
                      </span>
                    </div>

                    <div
                      className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${card.iconSurface}`}
                    >
                      <IconComponent className="w-5 h-5 stroke-[2]" />
                    </div>
                  </div>

                  <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {card.description}
                  </p>
                </div>

                {/* Hairline Footer */}
                <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-3 min-h-[44px]">
                  <span className={`text-xs font-bold leading-relaxed ${card.accentText}`}>
                    {isSelected ? card.activeNotice : card.statusLabel}
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
