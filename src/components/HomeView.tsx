import React, { useState } from 'react';
import { Gamepad2, ShoppingBag, Clock } from 'lucide-react';
import { Language, AuthUser } from '../types';

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
      Icon: Gamepad2,
      accentText: 'text-cyan-600 dark:text-cyan-400',
      iconSurface: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
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
      Icon: ShoppingBag,
      accentText: 'text-amber-600 dark:text-amber-400',
      iconSurface: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col justify-center min-h-[calc(100dvh-14rem)] py-6 px-4 sm:px-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
        {cards.map((card) => {
          const IconComponent = card.Icon;
          const isSelected = selectedCard === card.id;

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setSelectedCard((prev) => (prev === card.id ? null : card.id))}
              aria-pressed={isSelected}
              className={`group text-start w-full rounded-2xl p-5 bg-white dark:bg-neutral-900 border transition-transform duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 flex flex-col justify-between gap-4 cursor-pointer ${
                isSelected
                  ? 'border-neutral-400 dark:border-neutral-600 shadow-md'
                  : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 shadow-sm'
              }`}
            >
              {/* Card Header & Body */}
              <div className="space-y-3">
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
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${card.iconSurface}`}
                  >
                    <IconComponent className="w-5 h-5 stroke-[2]" />
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                  {card.description}
                </p>
              </div>

              {/* Hairline Footer */}
              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center gap-2">
                <Clock className={`w-3.5 h-3.5 shrink-0 ${card.accentText}`} />
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
