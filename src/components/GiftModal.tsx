import React from 'react';
import { X, Sparkles, AlertCircle } from 'lucide-react';
import { Language } from '../types';
import { CoinIcon } from './CurrencyIcons';
import { GiftSvgIcon } from './GiftIcons';

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
): { id: string; icon: string; name: string; quantity: number } | null => {
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
        id: g.id,
        icon: g.icon,
        name: isAr ? g.nameAr : g.nameEn,
        quantity,
      };
    }
  }

  if (fallbackIcon || fallbackName) {
    const cleanedFallbackName = fallbackName ? fallbackName.replace(/\s*[x×]\s*\d+\s*$/i, '').trim() : '';
    return {
      id: 'default',
      icon: fallbackIcon || '🎁',
      name: cleanedFallbackName || (isAr ? 'هدية' : 'Gift'),
      quantity,
    };
  }

  if (cleanText && cleanText.includes('🎁')) {
    const match = cleanText.match(/هدية:\s*([^(✨\n]+)/) || cleanText.match(/gift:\s*([^(✨\n]+)/i);
    const cleanedName = match ? match[1].trim() : cleanText.replace(/[🎁✨]/g, '').trim();
    return {
      id: 'default',
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
  const stripRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<{ isDown: boolean; startX: number; scrollLeft: number; dragged: boolean }>({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    dragged: false,
  });

  React.useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
    }
  }, [isOpen]);

  // Effective balance used for sending is Coins
  const effectiveCoins = typeof coinsBalance === 'number' ? coinsBalance : (walletBalance ?? 0);

  if (!isOpen) return null;

  const totalCost = selectedGift.cost * quantity;

  const handleSend = () => {
    if (effectiveCoins < totalCost) {
      setErrorMsg(
        isAr
          ? `رصيدك (${effectiveCoins.toLocaleString()}) لا يكفي (${totalCost.toLocaleString()} كوينز)`
          : `Insufficient balance (${effectiveCoins.toLocaleString()} / ${totalCost.toLocaleString()} Coins)`
      );
      return;
    }
    setErrorMsg(null);
    onSendGift(selectedGift, quantity);
    onClose();
  };

  const handleStripWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const el = stripRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += isAr ? -e.deltaY : e.deltaY;
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = stripRef.current;
    if (!el) return;
    dragStateRef.current = {
      isDown: true,
      startX: e.pageX,
      scrollLeft: el.scrollLeft,
      dragged: false,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = stripRef.current;
    const state = dragStateRef.current;
    if (!el || !state.isDown) return;
    const delta = e.pageX - state.startX;
    if (Math.abs(delta) > 5) {
      state.dragged = true;
    }
    el.scrollLeft = state.scrollLeft - delta;
  };

  const handleMouseUpOrLeave = () => {
    dragStateRef.current.isDown = false;
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-neutral-950/55 backdrop-blur-[2px] animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border-t border-x border-neutral-200/80 dark:border-neutral-800 rounded-t-3xl px-4 pt-2.5 pb-4 safe-area-pb shadow-[0_-12px_36px_rgba(0,0,0,0.28)] max-h-[50vh] flex flex-col gap-2.5 overflow-y-auto animate-in slide-in-from-bottom-6 duration-200"
      >
        {/* Subtle sheet handle */}
        <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700 mx-auto shrink-0" />

        {/* Simple Header: Balance + Close */}
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div
              dir="ltr"
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/12 border border-amber-500/25 text-xs font-mono font-black text-amber-600 dark:text-amber-400 shrink-0"
            >
              <CoinIcon className="w-4 h-4" />
              <span>{effectiveCoins.toLocaleString()}</span>
            </div>
            {recipientName && (
              <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 truncate">
                {isAr ? `إلى ${recipientName}` : `To ${recipientName}`}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 dark:text-neutral-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-[11px] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{errorMsg}</span>
            </div>
            {onOpenWallet && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenWallet();
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-500 text-neutral-950 font-bold text-[10px] shrink-0 cursor-pointer"
              >
                {isAr ? 'شحن' : 'Top up'}
              </button>
            )}
          </div>
        )}

        {/* Horizontally Scrollable / Rotatable Gifts Strip */}
        <div
          ref={stripRef}
          onWheel={handleStripWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="flex items-stretch gap-2.5 overflow-x-auto snap-x snap-proximity touch-pan-x py-1 px-0.5 shrink-0 select-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {SOULX_GIFTS.map((gift) => {
            const isSelected = selectedGift.id === gift.id;
            const canAffordOne = effectiveCoins >= gift.cost;

            return (
              <button
                key={gift.id}
                type="button"
                onClick={(e) => {
                  if (dragStateRef.current.dragged) {
                    dragStateRef.current.dragged = false;
                    return;
                  }
                  setSelectedGift(gift);
                  setErrorMsg(null);
                  e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                }}
                className={`shrink-0 w-[84px] sm:w-[90px] snap-center p-2 rounded-2xl flex flex-col items-center justify-center text-center gap-1 transition-all cursor-pointer border active:scale-95 ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/12 ring-2 ring-amber-500/25 shadow-xs'
                    : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-950/60 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <span className="flex items-center justify-center pt-0.5">
                  <GiftSvgIcon giftId={gift.id} className="w-10 h-10" />
                </span>
                <span className="text-[11px] font-bold text-neutral-900 dark:text-white truncate w-full">
                  {isAr ? gift.nameAr : gift.nameEn}
                </span>
                <span
                  dir="ltr"
                  className={`text-[10px] font-mono font-extrabold inline-flex items-center gap-0.5 ${
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

        {/* Simple Quantity Row + Send Button */}
        <div className="flex flex-col gap-2 shrink-0 pt-0.5">
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
                  className={`py-1.5 rounded-xl font-mono font-bold text-xs transition-all cursor-pointer border active:scale-95 ${
                    isQtySelected
                      ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-xs'
                      : 'bg-neutral-50 dark:bg-neutral-950 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-amber-500/40'
                  }`}
                >
                  x{qty}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleSend}
            className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-black text-xs sm:text-sm transition-all shadow-sm active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{isAr ? `إرسال ${selectedGift.nameAr}` : `Send ${selectedGift.nameEn}`}</span>
            <span dir="ltr" className="font-mono text-xs font-black">
              x{quantity}
            </span>
            <span dir="ltr" className="inline-flex items-center gap-1 font-mono text-xs">
              <span>({totalCost.toLocaleString()}</span>
              <CoinIcon className="w-3.5 h-3.5" />
              <span>)</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
