import React from 'react';
import { X, Sparkles, AlertCircle } from 'lucide-react';
import { Language } from '../types';
import { CoinIcon, DiamondIcon } from './CurrencyIcons';

export interface GiftItem {
  id: string;
  nameAr: string;
  nameEn: string;
  cost: number;
  icon: string;
  color: string;
}

export const SOULX_GIFTS: GiftItem[] = [
  { id: 'rose', nameAr: 'وردة روحية', nameEn: 'Soul Rose', cost: 20, icon: '🌹', color: 'from-rose-500 to-pink-500' },
  { id: 'diamond', nameAr: 'ماسة نقية', nameEn: 'Pure Diamond', cost: 50, icon: '💎', color: 'from-cyan-400 to-blue-500' },
  { id: 'heart', nameAr: 'قلب متوهج', nameEn: 'Glowing Heart', cost: 100, icon: '💖', color: 'from-pink-500 to-rose-600' },
  { id: 'crown', nameAr: 'تاج الأرواح', nameEn: 'Soul Crown', cost: 250, icon: '👑', color: 'from-amber-400 to-yellow-500' },
  { id: 'rocket', nameAr: 'صاروخ الإعجاب', nameEn: 'Super Rocket', cost: 500, icon: '🚀', color: 'from-violet-500 to-purple-600' },
  { id: 'galaxy', nameAr: 'مجرة التوافق', nameEn: 'Soul Galaxy', cost: 1000, icon: '🌌', color: 'from-indigo-500 to-cyan-500' },
];

export const getGiftDisplayInfo = (
  text?: string | null,
  isAr: boolean = true,
  fallbackIcon?: string,
  fallbackName?: string
) => {
  if (fallbackIcon && fallbackName) {
    return { icon: fallbackIcon, name: fallbackName };
  }
  if (!text) {
    if (fallbackIcon || fallbackName) {
      return { icon: fallbackIcon || '🎁', name: fallbackName || (isAr ? 'هدية' : 'Gift') };
    }
    return null;
  }
  for (const g of SOULX_GIFTS) {
    if (
      (fallbackIcon && g.icon === fallbackIcon) ||
      text.includes(g.icon) ||
      text.includes(g.nameAr) ||
      text.includes(g.nameEn) ||
      text.includes(g.id)
    ) {
      return {
        icon: g.icon,
        name: isAr ? g.nameAr : g.nameEn,
      };
    }
  }
  if (fallbackIcon) {
    return {
      icon: fallbackIcon,
      name: fallbackName || (isAr ? 'هدية' : 'Gift'),
    };
  }
  if (text.includes('🎁') || text.includes('هدية') || text.toLowerCase().includes('gift')) {
    const match = text.match(/هدية:\s*([^(✨\n]+)/) || text.match(/gift:\s*([^(✨\n]+)/i);
    const cleanedName = match ? match[1].trim() : text.replace(/[🎁✨]/g, '').trim();
    return {
      icon: '🎁',
      name: cleanedName || (isAr ? 'هدية' : 'Gift'),
    };
  }
  return null;
};

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  coinsBalance?: number;
  walletBalance?: number;
  recipientName: string;
  onSendGift: (gift: GiftItem) => void;
  onOpenWallet?: () => void;
}

export const GiftModal: React.FC<GiftModalProps> = ({
  isOpen,
  onClose,
  lang,
  coinsBalance = 0,
  walletBalance,
  recipientName,
  onSendGift,
  onOpenWallet,
}) => {
  const isAr = lang === 'ar';
  const [selectedGift, setSelectedGift] = React.useState<GiftItem>(SOULX_GIFTS[0]);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Effective balance used for sending is Coins
  const effectiveCoins = typeof coinsBalance === 'number' ? coinsBalance : (walletBalance ?? 0);

  if (!isOpen) return null;

  const handleSend = () => {
    if (effectiveCoins < selectedGift.cost) {
      setErrorMsg(
        isAr
          ? `رصيدك الحالي (${effectiveCoins.toLocaleString()} كوينز) لا يكفي لإرسال ${selectedGift.nameAr} (${selectedGift.cost} كوينز).`
          : `Insufficient coins (${effectiveCoins.toLocaleString()}) for ${selectedGift.nameEn} (${selectedGift.cost} Coins).`
      );
      return;
    }
    setErrorMsg(null);
    onSendGift(selectedGift);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎁</span>
            <div>
              <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                {isAr ? 'إرسال هدية مميزة' : 'Send Special Gift'}
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {isAr ? `إلى ${recipientName}` : `To ${recipientName}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Balance Badge - Coins for sending */}
        <div className="flex items-center justify-between p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs">
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">
            {isAr ? 'رصيد الكوينز المتاح للخصم:' : 'Your Coins balance:'}
          </span>
          <div className="flex items-center gap-1.5 font-mono font-black text-amber-600 dark:text-amber-400">
            <CoinIcon className="w-4 h-4" />
            <span>{effectiveCoins.toLocaleString()}</span>
          </div>
        </div>

        {/* Notice: Sent in Coins, Received in Diamonds */}
        <div className="px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-700 dark:text-cyan-300 font-medium flex items-center gap-2">
          <DiamondIcon className="shrink-0 w-4 h-4 text-cyan-400" />
          <span className="inline-flex items-center gap-1 flex-wrap">
            <span>{isAr ? 'تُرسل الهدية بعملة Coins' : 'Gifts are sent in Coins'}</span>
            <CoinIcon className="w-3.5 h-3.5 inline-block" />
            <span>{isAr ? 'ويستلمها المستخدم كـ Diamonds' : 'and received as Diamonds'}</span>
            <DiamondIcon className="w-3.5 h-3.5 text-cyan-400 inline-block" />
            <span>{isAr ? 'بنفس القيمة.' : 'with equal value.'}</span>
          </span>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-start">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            {onOpenWallet && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWallet();
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-neutral-950 font-bold text-[11px] shrink-0 cursor-pointer"
              >
                {isAr ? 'شحن كوينز' : 'Recharge Coins'}
              </button>
            )}
          </div>
        )}

        {/* Gifts Grid */}
        <div className="grid grid-cols-3 gap-2.5 py-1">
          {SOULX_GIFTS.map((gift) => {
            const isSelected = selectedGift.id === gift.id;
            const canAfford = effectiveCoins >= gift.cost;

            return (
              <button
                key={gift.id}
                type="button"
                onClick={() => {
                  setSelectedGift(gift);
                  setErrorMsg(null);
                }}
                className={`p-3 rounded-2xl flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer border relative active:scale-95 ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/10 shadow-sm ring-2 ring-amber-500/20'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <span className="text-2xl transition-transform hover:scale-125 duration-200">{gift.icon}</span>
                <span className="text-xs font-bold text-neutral-900 dark:text-white truncate w-full">
                  {isAr ? gift.nameAr : gift.nameEn}
                </span>
                <span className={`text-[10px] font-mono font-bold flex items-center gap-1 ${
                  canAfford ? 'text-amber-500' : 'text-neutral-400 line-through'
                }`}>
                  <span>{gift.cost}</span>
                  <CoinIcon className="w-3 h-3" />
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleSend}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-black text-xs sm:text-sm transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span className="inline-flex items-center gap-1">
              <span>{isAr ? `إرسال ${selectedGift.nameAr} (${selectedGift.cost}` : `Send ${selectedGift.nameEn} (${selectedGift.cost}`}</span>
              <CoinIcon className="w-3.5 h-3.5" />
              <span>)</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
