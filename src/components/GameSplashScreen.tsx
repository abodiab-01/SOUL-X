import React, { useEffect, useState } from 'react';
import { Language } from '../types';
import { ActiveGameId } from './GamesView';
import { GoldenTreeSymbolArt } from './GoldenTreeArt';
import plinkoCardImg from '../assets/images/plinko_game_card_1794757254790.jpg';
import minesCardImg from '../assets/images/mines_game_card_1794802083243.jpg';
import diceCardImg from '../assets/images/dice_game_card_1794805006562.jpg';
import olympusCardImg from '../assets/images/olympus_game_card_1794815720291.jpg';
import boxesCardImg from '../assets/images/boxes_game_card_1794834717589.jpg';
import winterSlotsCardImg from '../assets/images/winter_slots_card_1794836907232.jpg';

interface GameSplashScreenProps {
  gameId: Exclude<ActiveGameId, null>;
  lang: Language;
  onComplete: () => void;
  onInteract?: () => void;
}

interface SplashThemeMeta {
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  backdropClass: string;
  ringClass: string;
  barClass: string;
  textAccentClass: string;
  image?: string;
}

const SPLASH_THEMES: Record<Exclude<ActiveGameId, null>, SplashThemeMeta> = {
  'golden-tree': {
    titleAr: 'Golden Tree',
    titleEn: 'Golden Tree',
    subtitleAr: '5 بكرات · 10 خطوط ربح ذهبية',
    subtitleEn: '5 Reels · 10 Golden Paylines',
    backdropClass: 'bg-[radial-gradient(ellipse_at_center,#4c1d95_0%,#240748_55%,#0f0320_100%)]',
    ringClass: 'border-amber-400/50 shadow-[0_0_36px_rgba(250,204,21,0.3)] bg-purple-950/90',
    barClass: 'from-amber-300 via-yellow-400 to-amber-500',
    textAccentClass: 'text-amber-300',
  },
  'winter-slots': {
    titleAr: 'Winter Slots',
    titleEn: 'Winter Slots',
    subtitleAr: '3 بكرات شتوية · رموز مضاعفة',
    subtitleEn: '3 Winter Reels · Wild Multipliers',
    backdropClass: 'bg-[radial-gradient(ellipse_at_center,#0f294a_0%,#09182d_55%,#050b16_100%)]',
    ringClass: 'border-cyan-400/45 shadow-[0_0_36px_rgba(34,211,238,0.28)] bg-slate-950/90',
    barClass: 'from-cyan-300 via-sky-400 to-cyan-500',
    textAccentClass: 'text-cyan-300',
    image: winterSlotsCardImg,
  },
  boxes: {
    titleAr: 'صناديق الحظ',
    titleEn: 'Mystery Boxes',
    subtitleAr: 'اختر صندوقك واربح حتى 50x',
    subtitleEn: 'Pick a Box · Win Up to 50x',
    backdropClass: 'bg-[radial-gradient(ellipse_at_center,#292014_0%,#141722_55%,#090b10_100%)]',
    ringClass: 'border-amber-400/45 shadow-[0_0_36px_rgba(245,158,11,0.25)] bg-slate-900/90',
    barClass: 'from-amber-400 via-orange-400 to-amber-500',
    textAccentClass: 'text-amber-300',
    image: boxesCardImg,
  },
  olympus: {
    titleAr: 'Olympus Gates',
    titleEn: 'Olympus Gates',
    subtitleAr: 'بوابات أوليمبوس ومضاعفات زيوس',
    subtitleEn: 'Gates of Olympus · Zeus Multipliers',
    backdropClass: 'bg-[radial-gradient(ellipse_at_center,#231942_0%,#120e2b_55%,#070814_100%)]',
    ringClass: 'border-amber-400/50 shadow-[0_0_36px_rgba(139,92,246,0.32)] bg-slate-950/90',
    barClass: 'from-amber-300 via-violet-400 to-amber-500',
    textAccentClass: 'text-amber-300',
    image: olympusCardImg,
  },
  plinko: {
    titleAr: 'Plinko',
    titleEn: 'Plinko',
    subtitleAr: 'أطلق الكرة نحو أعلى المضاعفات',
    subtitleEn: 'Drop the Ball to High Multipliers',
    backdropClass: 'bg-[radial-gradient(ellipse_at_center,#122238_0%,#0b1322_55%,#050912_100%)]',
    ringClass: 'border-cyan-400/45 shadow-[0_0_36px_rgba(6,182,212,0.28)] bg-slate-950/90',
    barClass: 'from-cyan-400 via-amber-400 to-orange-500',
    textAccentClass: 'text-cyan-300',
    image: plinkoCardImg,
  },
  mines: {
    titleAr: 'Mines',
    titleEn: 'Mines',
    subtitleAr: 'اكشف الجواهر وتجنّب الألغام',
    subtitleEn: 'Uncover Gems · Avoid the Mines',
    backdropClass: 'bg-[radial-gradient(ellipse_at_center,#0b2a22_0%,#091916_55%,#040b0a_100%)]',
    ringClass: 'border-emerald-400/45 shadow-[0_0_36px_rgba(16,185,129,0.28)] bg-slate-950/90',
    barClass: 'from-emerald-400 via-teal-400 to-emerald-500',
    textAccentClass: 'text-emerald-300',
    image: minesCardImg,
  },
  dice: {
    titleAr: 'Dice',
    titleEn: 'Dice',
    subtitleAr: 'حدّد الرقم المستهدف وارمِ النرد',
    subtitleEn: 'Set Your Target & Roll the Dice',
    backdropClass: 'bg-[radial-gradient(ellipse_at_center,#1e1b38_0%,#111424_55%,#070912_100%)]',
    ringClass: 'border-amber-400/45 shadow-[0_0_36px_rgba(245,158,11,0.25)] bg-slate-950/90',
    barClass: 'from-amber-400 via-cyan-400 to-amber-500',
    textAccentClass: 'text-amber-300',
    image: diceCardImg,
  },
};

export const GameSplashScreen: React.FC<GameSplashScreenProps> = ({
  gameId,
  lang,
  onComplete,
  onInteract,
}) => {
  const isAr = lang === 'ar';
  const theme = SPLASH_THEMES[gameId];
  const [progress, setProgress] = useState(12);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const startTimer = window.setTimeout(() => {
      setProgress(100);
    }, 60);

    const completeTimer = window.setTimeout(() => {
      onComplete();
    }, 1150);

    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const handleTap = () => {
    onInteract?.();
    onComplete();
  };

  return (
    <div
      onPointerDown={handleTap}
      onClick={handleTap}
      role="status"
      aria-label={isAr ? `جاري تشغيل ${theme.titleAr}` : `Loading ${theme.titleEn}`}
      dir={isAr ? 'rtl' : 'ltr'}
      className={`absolute inset-0 z-40 flex flex-col items-center justify-center p-6 text-white select-none cursor-pointer animate-in fade-in duration-200 ${theme.backdropClass}`}
    >
      <div className="w-full max-w-xs flex flex-col items-center text-center gap-4">
        {/* Emblem / Game Icon */}
        <div
          className={`w-28 h-28 sm:w-32 sm:h-32 rounded-3xl border-2 overflow-hidden flex items-center justify-center p-2 transition-transform duration-500 scale-100 ${theme.ringClass}`}
        >
          {gameId === 'golden-tree' || !theme.image || imgError ? (
            <GoldenTreeSymbolArt symbol="wild" className="w-20 h-20 sm:w-24 sm:h-24" />
          ) : (
            <img
              src={theme.image}
              alt={isAr ? theme.titleAr : theme.titleEn}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover rounded-2xl"
            />
          )}
        </div>

        {/* Title & 1-line Subtitle */}
        <div className="space-y-1">
          <h2 className="text-xl sm:text-2xl font-black tracking-wide text-white">
            {isAr ? theme.titleAr : theme.titleEn}
          </h2>
          <p className={`text-xs sm:text-sm font-semibold ${theme.textAccentClass}`}>
            {isAr ? theme.subtitleAr : theme.subtitleEn}
          </p>
        </div>

        {/* Smooth Progress Track */}
        <div className="w-48 sm:w-56 space-y-2 pt-1">
          <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-out ${theme.barClass}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] font-medium text-white/55">
            {isAr ? 'اضغط في أي مكان للبدء' : 'Tap anywhere to start'}
          </p>
        </div>
      </div>
    </div>
  );
};
