import React from 'react';
import { X, Sparkles, AlertCircle, Crown } from 'lucide-react';
import { Language } from '../types';
import { CoinIcon, DiamondIcon } from './CurrencyIcons';

export interface GiftItem {
  id: string;
  nameAr: string;
  nameEn: string;
  cost: number;
  icon: string;
  color: string;
  tier?: 'classic' | 'premium' | 'legendary';
}

export const GIFT_QUANTITIES = [1, 5, 10, 50, 100] as const;

export const SOULX_GIFTS: GiftItem[] = [
  { id: 'rose', nameAr: 'وردة روحية', nameEn: 'Soul Rose', cost: 20, icon: '🌹', color: 'from-rose-500 to-pink-500', tier: 'classic' },
  { id: 'coffee', nameAr: 'قهوة فاخرة', nameEn: 'Luxury Coffee', cost: 35, icon: '☕', color: 'from-amber-600 to-orange-500', tier: 'classic' },
  { id: 'diamond', nameAr: 'ماسة نقية', nameEn: 'Pure Diamond', cost: 50, icon: '💎', color: 'from-cyan-400 to-blue-500', tier: 'classic' },
  { id: 'heart', nameAr: 'قلب متوهج', nameEn: 'Glowing Heart', cost: 100, icon: '💖', color: 'from-pink-500 to-rose-600', tier: 'classic' },
  { id: 'bouquet', nameAr: 'باقة زهور', nameEn: 'Flower Bouquet', cost: 150, icon: '💐', color: 'from-fuchsia-500 to-rose-500', tier: 'classic' },
  { id: 'crown', nameAr: 'تاج الأرواح', nameEn: 'Soul Crown', cost: 250, icon: '👑', color: 'from-amber-400 to-yellow-500', tier: 'classic' },
  { id: 'rocket', nameAr: 'صاروخ الإعجاب', nameEn: 'Super Rocket', cost: 500, icon: '🚀', color: 'from-violet-500 to-purple-600', tier: 'classic' },
  { id: 'galaxy', nameAr: 'مجرة التوافق', nameEn: 'Soul Galaxy', cost: 1000, icon: '🌌', color: 'from-indigo-500 to-cyan-500', tier: 'premium' },
  { id: 'ring', nameAr: 'خاتم الأبدية', nameEn: 'Eternity Ring', cost: 2500, icon: '💍', color: 'from-sky-400 to-cyan-500', tier: 'premium' },
  { id: 'unicorn', nameAr: 'وحيد القرن', nameEn: 'Magic Unicorn', cost: 5000, icon: '🦄', color: 'from-purple-500 to-pink-500', tier: 'premium' },
  { id: 'fireworks', nameAr: 'ألعاب نارية', nameEn: 'Royal Fireworks', cost: 10000, icon: '🎆', color: 'from-amber-500 to-rose-500', tier: 'premium' },
  { id: 'supercar', nameAr: 'سيارة خارقة', nameEn: 'Supercar', cost: 25000, icon: '🏎️', color: 'from-red-500 to-orange-500', tier: 'premium' },
  { id: 'yacht', nameAr: 'يخت فاخر', nameEn: 'Luxury Yacht', cost: 50000, icon: '🛥️', color: 'from-blue-500 to-cyan-400', tier: 'premium' },
  { id: 'jet', nameAr: 'طائرة خاصة', nameEn: 'Private Jet', cost: 100000, icon: '🛩️', color: 'from-slate-500 to-cyan-500', tier: 'legendary' },
  { id: 'castle', nameAr: 'قصر الأحلام', nameEn: 'Dream Castle', cost: 250000, icon: '🏰', color: 'from-violet-500 to-indigo-600', tier: 'legendary' },
  { id: 'island', nameAr: 'جزيرة خاصة', nameEn: 'Private Island', cost: 500000, icon: '🏝️', color: 'from-emerald-400 to-teal-500', tier: 'legendary' },
  { id: 'phoenix', nameAr: 'عنقاء الخلود', nameEn: 'Eternal Phoenix', cost: 1000000, icon: '🦅', color: 'from-orange-500 to-amber-500', tier: 'legendary' },
  { id: 'planet', nameAr: 'كوكب ذهبي', nameEn: 'Golden Planet', cost: 2500000, icon: '🪐', color: 'from-yellow-400 to-amber-600', tier: 'legendary' },
  { id: 'throne', nameAr: 'عرش الملوك', nameEn: 'Sovereign Throne', cost: 5000000, icon: '⚜️', color: 'from-amber-400 via-yellow-500 to-orange-500', tier: 'legendary' },
];

export const formatCompactGiftCost = (cost: number): string => {
  if (cost >= 1_000_000) {
    return `${Number((cost / 1_000_000).toFixed(2))}M`;
  }
  if (cost >= 1_000) {
    return `${Number((cost / 1_000).toFixed(2))}K`;
  }
  return cost.toLocaleString();
};

export const getGiftDisplayInfo = (
  text?: string | null,
  isAr: boolean = true,
  fallbackIcon?: string,
  fallbackName?: string,
  fallbackQuantity?: number
): { icon: string; name: string; quantity: number } | null => {
  const qtyMatch = typeof text === 'string' ? text.match(/(?:^|\s)[x×]\s*(\d+)\s*$/i) : null;
  const parsedQty = qtyMatch ? Math.max(1, parseInt(qtyMatch[1], 10)) : 1;
  const quantity =
    typeof fallbackQuantity === 'number' && Number.isFinite(fallbackQuantity) && fallbackQuantity > 0
      ? Math.floor(fallbackQuantity)
      : parsedQty;

  const cleanText = typeof text === 'string' ? text.replace(/\s*[x×]\s*\d+\s*$/i, '').trim() : '';

  for (const g of SOULX_GIFTS) {
    if (
      (fallbackIcon && g.icon === fallbackIcon) ||
      (fallbackName && (fallbackName === g.nameAr || fallbackName === g.nameEn || fallbackName === g.id)) ||
      (cleanText && (cleanText.includes(g.icon) || cleanText.includes(g.nameAr) || cleanText.includes(g.nameEn)))
    ) {
      return {
        icon: g.icon,
        name: isAr ? g.nameAr : g.nameEn,
        quantity,
      };
    }
  }

  if (fallbackIcon || fallbackName) {
    const cleanedFallbackName = fallbackName ? fallbackName.replace(/\s*[x×]\s*\d+\s*$/i, '').trim() : '';
    return {
      icon: fallbackIcon || '🎁',
      name: cleanedFallbackName || (isAr ? 'هدية' : 'Gift'),
      quantity,
    };
  }

  if (cleanText && cleanText.includes('🎁')) {
    const match = cleanText.match(/هدية:\s*([^(✨\n]+)/) || cleanText.match(/gift:\s*([^(✨\n]+)/i);
    const cleanedName = match ? match[1].trim() : cleanText.replace(/[🎁✨]/g, '').trim();
    return {
      icon: '🎁',
      name: cleanedName || (isAr ? 'هدية' : 'Gift'),
      quantity,
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
  onSendGift: (gift: GiftItem, quantity: number) => void;
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
  const [quantity, setQuantity] = React.useState<number>(1);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Effective balance used for sending is Coins
  const effectiveCoins = typeof coinsBalance === 'number' ? coinsBalance : (walletBalance ?? 0);

  if (!isOpen) return null;

  const totalCost = selectedGift.cost * quantity;
  const canAffordSelected = effectiveCoins >= totalCost;

  const handleSend = () => {
    if (effectiveCoins < totalCost) {
      setErrorMsg(
        isAr
          ? `رصيدك الحالي (${effectiveCoins.toLocaleString()} كوينز) لا يكفي لإرسال ${selectedGift.nameAr} x${quantity} (${totalCost.toLocaleString()} كوينز).`
          : `Insufficient coins (${effectiveCoins.toLocaleString()}) for ${selectedGift.nameEn} x${quantity} (${totalCost.toLocaleString()} Coins).`
      );
      return;
    }
    setErrorMsg(null);
    onSendGift(selectedGift, quantity);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400/20 to-rose-500/20 border border-amber-500/30 flex items-center justify-center text-lg shadow-xs">
              🎁
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                {isAr ? 'متجر الهدايا المميزة' : 'Special Gifts Store'}
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {isAr ? `إرسال إلى ${recipientName}` : `Sending to ${recipientName}`}
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

        {/* User Balance Badge + Notice */}
        <div className="space-y-2 shrink-0">
          <div className="flex items-center justify-between px-3 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs">
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              {isAr ? 'رصيد الكوينز المتاح:' : 'Coins Balance:'}
            </span>
            <div className="flex items-center gap-1.5 font-mono font-black text-amber-600 dark:text-amber-400">
              <CoinIcon className="w-4 h-4" />
              <span>{effectiveCoins.toLocaleString()}</span>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-700 dark:text-cyan-300 font-medium flex items-center gap-2">
            <DiamondIcon className="shrink-0 w-3.5 h-3.5 text-cyan-400" />
            <span className="inline-flex items-center gap-1 flex-wrap">
              <span>{isAr ? 'تُرسل بـ Coins' : 'Sent in Coins'}</span>
              <CoinIcon className="w-3 h-3 inline-block" />
              <span>{isAr ? 'وتصل للمستلم Diamonds' : 'and received as Diamonds'}</span>
              <DiamondIcon className="w-3 h-3 text-cyan-400 inline-block" />
              <span>{isAr ? 'بنفس القيمة.' : 'with equal value.'}</span>
            </span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-2 shrink-0">
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
                {isAr ? 'شحن كوينز' : 'Recharge'}
              </button>
            )}
          </div>
        )}

        {/* Scrollable Gifts Grid */}
        <div className="grid grid-cols-3 gap-2 py-1 overflow-y-auto overscroll-contain max-h-[38vh] pe-0.5">
          {SOULX_GIFTS.map((gift) => {
            const isSelected = selectedGift.id === gift.id;
            const canAffordOne = effectiveCoins >= gift.cost;
            const isLegendary = gift.tier === 'legendary';

            return (
              <button
                key={gift.id}
                type="button"
                onClick={() => {
                  setSelectedGift(gift);
                  setErrorMsg(null);
                }}
                className={`p-2.5 rounded-2xl flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer border relative active:scale-95 ${
                  isSelected
                    ? 'border-amber-500 bg-gradient-to-b from-amber-500/15 to-amber-500/5 shadow-sm ring-2 ring-amber-500/25'
                    : isLegendary
                    ? 'border-amber-500/25 dark:border-amber-500/25 bg-gradient-to-b from-amber-500/5 to-neutral-50 dark:from-amber-500/5 dark:to-neutral-950/70 hover:border-amber-500/50'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                {isLegendary && (
                  <span className="absolute top-1.5 start-1.5 px-1 py-0.2 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[8px] font-black flex items-center gap-0.5">
                    <Crown className="w-2.5 h-2.5" />
                    <span>VIP</span>
                  </span>
                )}
                <span className="text-2xl sm:text-3xl transition-transform hover:scale-115 duration-200 leading-none pt-1">
                  {gift.icon}
                </span>
                <span className="text-[11px] font-bold text-neutral-900 dark:text-white truncate w-full mt-0.5">
                  {isAr ? gift.nameAr : gift.nameEn}
                </span>
                <span
                  dir="ltr"
                  className={`text-[10px] font-mono font-extrabold flex items-center gap-0.5 ${
                    canAffordOne ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-400'
                  }`}
                >
                  <span>{formatCompactGiftCost(gift.cost)}</span>
                  <CoinIcon className="w-3 h-3" />
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Gift Summary + Quantity Multiplier Selector */}
        <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/80 border border-neutral-200 dark:border-neutral-800 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl shrink-0">{selectedGift.icon}</span>
              <div className="min-w-0">
                <div className="font-black text-neutral-900 dark:text-white truncate">
                  {isAr ? selectedGift.nameAr : selectedGift.nameEn}
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono flex items-center gap-1" dir="ltr">
                  <span>{selectedGift.cost.toLocaleString()}</span>
                  <CoinIcon className="w-3 h-3" />
                  <span>× {quantity}</span>
                </div>
              </div>
            </div>

            <div className="text-end shrink-0">
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 block">
                {isAr ? 'الإجمالي' : 'Total'}
              </span>
              <span
                dir="ltr"
                className={`text-xs font-mono font-black inline-flex items-center gap-1 ${
                  canAffordSelected ? 'text-amber-600 dark:text-amber-400' : 'text-rose-500'
                }`}
              >
                <span>{totalCost.toLocaleString()}</span>
                <CoinIcon className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                {isAr ? 'كمية الإرسال:' : 'Send Quantity:'}
              </span>
              <span className="text-[11px] font-mono font-black text-amber-600 dark:text-amber-400" dir="ltr">
                x{quantity}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5" dir="ltr">
              {GIFT_QUANTITIES.map((qty) => {
                const isQtySelected = quantity === qty;
                return (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => {
                      setQuantity(qty);
                      setErrorMsg(null);
                    }}
                    className={`py-1.5 rounded-xl font-mono font-black text-xs transition-all cursor-pointer border active:scale-95 ${
                      isQtySelected
                        ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-xs'
                        : 'bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-amber-500/40'
                    }`}
                  >
                    x{qty}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={handleSend}
            className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-black text-xs sm:text-sm transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="inline-flex items-center gap-1.5 flex-wrap justify-center">
              <span>
                {isAr
                  ? `إرسال ${selectedGift.nameAr}`
                  : `Send ${selectedGift.nameEn}`}
              </span>
              <span dir="ltr" className="px-1.5 py-0.5 rounded-md bg-neutral-950/15 font-mono text-xs font-black">
                x{quantity}
              </span>
              <span dir="ltr" className="inline-flex items-center gap-1 font-mono">
                <span>({totalCost.toLocaleString()}</span>
                <CoinIcon className="w-3.5 h-3.5" />
                <span>)</span>
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
