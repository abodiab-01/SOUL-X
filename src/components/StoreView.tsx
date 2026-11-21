import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag,
  Briefcase,
  Lock,
  Clock,
  Check,
  Sparkles,
  Crown,
  Palette,
  Award,
  X,
  Loader2,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { AuthUser, Gender, Language } from '../types';
import {
  AVATAR_FRAMES_CATALOG,
  AvatarFrameDef,
  FRAME_DURATIONS,
  FrameCategory,
  FrameDurationKey,
  formatRemainingDuration,
  getFrameById,
  getFramePriceForDuration,
} from '../data/avatarFrames';
import { AvatarWithFrame } from './AvatarFrame';
import { CoinIcon } from './CurrencyIcons';
import { getDefaultAvatar, getEffectiveAvatar } from '../lib/avatar';
import { getStoredAuthToken } from '../lib/authStorage';
import { playNavClick } from '../lib/uiAudio';

export interface StoreBagItem {
  frameId: string;
  purchasedAt: string;
  expiresAt: string;
  lastDurationKey: FrameDurationKey | string;
  isActive: boolean;
  isExpired: boolean;
  isEquipped: boolean;
  remainingMs: number;
}

interface StoreViewProps {
  lang: Language;
  currentUser: AuthUser | null;
  coinsBalance: number;
  gender?: Gender | null;
  onOpenWallet: () => void;
  onCoinsBalanceSync: (nextBalance: number) => void;
  onEquippedFrameChange: (frameId: string | null) => void;
}

export const StoreView: React.FC<StoreViewProps> = ({
  lang,
  currentUser,
  coinsBalance,
  gender,
  onOpenWallet,
  onCoinsBalanceSync,
  onEquippedFrameChange,
}) => {
  const isAr = lang === 'ar';

  const [mainTab, setMainTab] = useState<'store' | 'bag'>('store');
  const [storeScope, setStoreScope] = useState<'internal' | 'external'>('internal');
  const [categoryFilter, setCategoryFilter] = useState<'all' | FrameCategory>('all');

  const [bagItems, setBagItems] = useState<StoreBagItem[]>([]);
  const [equippedFrameId, setEquippedFrameId] = useState<string | null>(
    currentUser?.equippedFrameId || null
  );
  const [isLoadingBag, setIsLoadingBag] = useState(false);

  const [selectedFrame, setSelectedFrame] = useState<AvatarFrameDef | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<FrameDurationKey>('1m');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [actionLoadingFrameId, setActionLoadingFrameId] = useState<string | null>(null);

  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const userAvatarSrc = getEffectiveAvatar(
    currentUser?.photoUrl,
    gender || currentUser?.gender
  );
  const fallbackAvatarSrc = getDefaultAvatar(gender || currentUser?.gender);

  const showStatus = useCallback((text: string, type: 'success' | 'error') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage((prev) => (prev?.text === text ? null : prev));
    }, 3500);
  }, []);

  const syncFrameLocally = useCallback(
    (nextFrameId: string | null) => {
      setEquippedFrameId(nextFrameId);
      onEquippedFrameChange(nextFrameId);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('soulx:frame-updated', { detail: { equippedFrameId: nextFrameId } })
        );
      }
    },
    [onEquippedFrameChange]
  );

  const fetchBag = useCallback(async () => {
    if (!currentUser?.id && !currentUser?.displayId && !currentUser?.email) return;
    setIsLoadingBag(true);
    try {
      const token = getStoredAuthToken();
      const params = new URLSearchParams();
      if (currentUser?.id) params.set('userId', currentUser.id);
      if (currentUser?.displayId) params.set('displayId', currentUser.displayId);
      if (currentUser?.email) params.set('email', currentUser.email);

      const res = await fetch(`/api/store/bag?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (data?.success) {
        setBagItems(Array.isArray(data.items) ? data.items : []);
        const nextEq = data.equippedFrameId ?? null;
        if (nextEq !== (currentUser?.equippedFrameId ?? null)) {
          syncFrameLocally(nextEq);
        } else {
          setEquippedFrameId(nextEq);
        }
      }
    } catch {
      // Keep last known bag state cleanly
    } finally {
      setIsLoadingBag(false);
    }
  }, [
    currentUser?.id,
    currentUser?.displayId,
    currentUser?.email,
    currentUser?.equippedFrameId,
    syncFrameLocally,
  ]);

  useEffect(() => {
    fetchBag();
  }, [fetchBag]);

  useEffect(() => {
    setEquippedFrameId(currentUser?.equippedFrameId || null);
  }, [currentUser?.equippedFrameId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const computedBagItems = bagItems.map((item) => {
    const expMs = new Date(item.expiresAt).getTime();
    const remainingMs = Number.isFinite(expMs) ? Math.max(0, expMs - nowMs) : 0;
    const isActive = remainingMs > 0;
    const isEquipped = isActive && equippedFrameId === item.frameId;
    return {
      ...item,
      remainingMs,
      isActive,
      isExpired: !isActive,
      isEquipped,
    };
  });

  const activeBagCount = computedBagItems.filter((item) => item.isActive).length;

  const filteredCatalog = AVATAR_FRAMES_CATALOG.filter((f) =>
    categoryFilter === 'all' ? true : f.category === categoryFilter
  );

  const handlePurchaseFrame = async () => {
    if (!selectedFrame || isPurchasing) return;
    if (!currentUser) {
      showStatus(isAr ? 'يرجى تسجيل الدخول أولاً' : 'Please sign in first', 'error');
      return;
    }

    const totalCost = getFramePriceForDuration(selectedFrame, selectedDuration);
    if (coinsBalance < totalCost) {
      showStatus(
        isAr
          ? `رصيد الكوينز غير كافٍ (${coinsBalance.toLocaleString()} كوينز)`
          : `Insufficient Coins (${coinsBalance.toLocaleString()})`,
        'error'
      );
      return;
    }

    setIsPurchasing(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch('/api/store/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: currentUser.id,
          displayId: currentUser.displayId,
          email: currentUser.email,
          frameId: selectedFrame.id,
          durationKey: selectedDuration,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        showStatus(
          data?.message || (isAr ? 'تعذر إتمام عملية الشراء' : 'Purchase failed'),
          'error'
        );
        if (typeof data?.coinsBalance === 'number') {
          onCoinsBalanceSync(data.coinsBalance);
        }
        return;
      }

      if (typeof data.coinsBalance === 'number') {
        onCoinsBalanceSync(data.coinsBalance);
      }
      if (Array.isArray(data.items)) {
        setBagItems(data.items);
      } else {
        await fetchBag();
      }
      if (data.equippedFrameId !== undefined) {
        syncFrameLocally(data.equippedFrameId);
      }

      const boughtFrame = selectedFrame;
      setSelectedFrame(null);
      setMainTab('bag');
      showStatus(
        isAr
          ? `تم شراء "${boughtFrame.nameAr}" بنجاح وإضافته إلى حقيبتك`
          : `Purchased "${boughtFrame.nameEn}" and added to your bag`,
        'success'
      );
    } catch {
      showStatus(
        isAr ? 'حدث خطأ في الاتصال بالخادم' : 'Network error while purchasing',
        'error'
      );
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleEquipFrame = async (frameId: string) => {
    if (!currentUser || actionLoadingFrameId) return;
    setActionLoadingFrameId(frameId);
    try {
      const token = getStoredAuthToken();
      const res = await fetch('/api/store/equip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: currentUser.id,
          displayId: currentUser.displayId,
          email: currentUser.email,
          frameId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        showStatus(
          data?.message || (isAr ? 'تعذر تجهيز الإطار' : 'Failed to equip frame'),
          'error'
        );
        return;
      }
      if (Array.isArray(data.items)) {
        setBagItems(data.items);
      }
      syncFrameLocally(data.equippedFrameId || frameId);
      const def = getFrameById(frameId);
      showStatus(
        isAr
          ? `تم تجهيز إطار "${def?.nameAr || ''}" على صورتك الشخصية`
          : `Equipped "${def?.nameEn || ''}" frame`,
        'success'
      );
    } catch {
      showStatus(isAr ? 'تعذر تجهيز الإطار' : 'Error equipping frame', 'error');
    } finally {
      setActionLoadingFrameId(null);
    }
  };

  const handleUnequipFrame = async (frameId?: string) => {
    if (!currentUser || actionLoadingFrameId) return;
    setActionLoadingFrameId(frameId || 'unequip');
    try {
      const token = getStoredAuthToken();
      const res = await fetch('/api/store/unequip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: currentUser.id,
          displayId: currentUser.displayId,
          email: currentUser.email,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        showStatus(
          data?.message || (isAr ? 'تعذر إلغاء التجهيز' : 'Failed to unequip'),
          'error'
        );
        return;
      }
      if (Array.isArray(data.items)) {
        setBagItems(data.items);
      }
      syncFrameLocally(null);
      showStatus(
        isAr ? 'تم إلغاء تجهيز الإطار بنجاح' : 'Frame unequipped successfully',
        'success'
      );
    } catch {
      showStatus(isAr ? 'تعذر إلغاء التجهيز' : 'Error unequipping frame', 'error');
    } finally {
      setActionLoadingFrameId(null);
    }
  };

  const getCategoryLabel = (cat: FrameCategory) => {
    if (cat === 'colored') return isAr ? 'ملون' : 'Colored';
    if (cat === 'professional') return isAr ? 'احترافي' : 'Pro';
    return 'VIP';
  };

  const getCategoryBadgeStyle = (cat: FrameCategory) => {
    if (cat === 'colored') {
      return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25';
    }
    if (cat === 'professional') {
      return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25';
    }
    return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
  };

  return (
    <div
      className="w-full max-w-4xl mx-auto px-3 sm:px-6 pt-3 pb-24 flex-1 animate-in fade-in duration-300"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Feedback Toast */}
      {statusMessage && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-[150] px-4 py-2.5 rounded-2xl shadow-2xl border backdrop-blur-md text-xs sm:text-sm font-bold flex items-center gap-2 max-w-[92vw] animate-in fade-in slide-in-from-top-3 duration-200 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/95 text-white border-emerald-400'
              : 'bg-rose-500/95 text-white border-rose-400'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <X className="w-4 h-4 shrink-0" />
          )}
          <span className="truncate">{statusMessage.text}</span>
        </div>
      )}

      {/* Top Header Strip: Main Tabs (المتجر / حقيبتي) & Coins Balance */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="inline-flex p-1 rounded-2xl bg-neutral-200/80 dark:bg-neutral-900 border border-neutral-300/70 dark:border-neutral-800 shadow-xs">
          <button
            type="button"
            onClick={() => {
              playNavClick();
              setMainTab('store');
            }}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
              mainTab === 'store'
                ? 'bg-white dark:bg-neutral-800 text-amber-600 dark:text-amber-400 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{isAr ? 'المتجر' : 'Store'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playNavClick();
              setMainTab('bag');
              fetchBag();
            }}
            className={`px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer ${
              mainTab === 'bag'
                ? 'bg-white dark:bg-neutral-800 text-cyan-600 dark:text-cyan-400 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>{isAr ? 'حقيبتي' : 'My Bag'}</span>
            {activeBagCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-cyan-500 text-neutral-950 leading-none tabular-nums">
                {activeBagCount}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenWallet}
          className="px-3.5 py-2 rounded-2xl bg-white dark:bg-neutral-900 border border-amber-500/30 hover:border-amber-500/60 shadow-xs flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
          title={isAr ? 'شحن رصيد الكوينز' : 'Top up Coins'}
        >
          <CoinIcon className="w-4 h-4 shrink-0" />
          <span className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white tabular-nums">
            {coinsBalance.toLocaleString()}
          </span>
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
            {isAr ? '+ شحن' : '+ Top up'}
          </span>
        </button>
      </div>

      {/* ================================================= */}
      {/* TAB 1: المتجر (Store: داخلي + خارجي)              */}
      {/* ================================================= */}
      {mainTab === 'store' ? (
        <div className="space-y-4">
          {/* Sub-Tabs: داخلي vs خارجي */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                playNavClick();
                setStoreScope('internal');
              }}
              className={`p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                storeScope === 'internal'
                  ? 'bg-gradient-to-br from-amber-500/15 to-cyan-500/10 border-amber-500/50 text-neutral-900 dark:text-white shadow-sm'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    storeScope === 'internal'
                      ? 'bg-amber-500 text-neutral-950'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="text-start min-w-0">
                  <div className="text-xs sm:text-sm font-black truncate">
                    {isAr ? 'داخلي' : 'Internal'}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                    {isAr ? 'إطارات الملف الشخصي' : 'Profile Avatar Frames'}
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
                {isAr ? 'متاح' : 'Open'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                playNavClick();
                setStoreScope('external');
              }}
              className={`p-3 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                storeScope === 'external'
                  ? 'bg-neutral-200/80 dark:bg-neutral-800/90 border-neutral-400 dark:border-neutral-600 text-neutral-900 dark:text-white shadow-sm'
                  : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="text-start min-w-0">
                  <div className="text-xs sm:text-sm font-black truncate">
                    {isAr ? 'خارجي' : 'External'}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                    {isAr ? 'متوقف حالياً' : 'Currently Paused'}
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-300 dark:border-neutral-700 shrink-0">
                {isAr ? 'متوقف' : 'Paused'}
              </span>
            </button>
          </div>

          {storeScope === 'external' ? (
            /* External Store Section: Currently Paused Notice */
            <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-8 sm:p-12 text-center shadow-sm flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center text-neutral-500 dark:text-neutral-400">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white">
                {isAr ? 'المتجر الخارجي متوقف حالياً' : 'External Store is Currently Paused'}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-md leading-relaxed">
                {isAr
                  ? 'قسم المنتجات والخدمات الخارجية متوقف مؤقتاً في الوقت الحالي. يمكنك تصفح وشراء إطارات الصور الشخصية من القسم الداخلي.'
                  : 'External products and services are temporarily paused right now. You can browse and purchase profile avatar frames in the Internal store.'}
              </p>
              <button
                type="button"
                onClick={() => setStoreScope('internal')}
                className="mt-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs sm:text-sm cursor-pointer transition-transform active:scale-95"
              >
                {isAr ? 'الانتقال إلى المتجر الداخلي' : 'Go to Internal Store'}
              </button>
            </div>
          ) : (
            /* Internal Store Section: Avatar Frames Catalog */
            <div className="space-y-4">
              {/* Category Filter Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                {[
                  {
                    key: 'all' as const,
                    label: isAr ? 'الكل' : 'All',
                    count: AVATAR_FRAMES_CATALOG.length,
                    icon: Sparkles,
                  },
                  {
                    key: 'colored' as const,
                    label: isAr ? 'ملونة بجميع الألوان' : 'All Colors',
                    count: AVATAR_FRAMES_CATALOG.filter((f) => f.category === 'colored').length,
                    icon: Palette,
                  },
                  {
                    key: 'professional' as const,
                    label: isAr ? 'احترافية' : 'Professional',
                    count: AVATAR_FRAMES_CATALOG.filter((f) => f.category === 'professional').length,
                    icon: Award,
                  },
                  {
                    key: 'vip' as const,
                    label: isAr ? 'أشكال VIP' : 'VIP Shapes',
                    count: AVATAR_FRAMES_CATALOG.filter((f) => f.category === 'vip').length,
                    icon: Crown,
                  },
                ].map((cat) => {
                  const IconComp = cat.icon;
                  const active = categoryFilter === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => {
                        playNavClick();
                        setCategoryFilter(cat.key);
                      }}
                      className={`px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-all ${
                        active
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 border-neutral-900 dark:border-white shadow-sm'
                          : 'bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <IconComp className="w-3.5 h-3.5" />
                      <span>{cat.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${
                          active
                            ? 'bg-white/20 dark:bg-neutral-900/15'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500'
                        }`}
                      >
                        {cat.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Frames Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredCatalog.map((frame) => {
                  const ownedActive = computedBagItems.find(
                    (b) => b.frameId === frame.id && b.isActive
                  );
                  const isEquippedNow = ownedActive?.isEquipped;

                  return (
                    <button
                      key={frame.id}
                      type="button"
                      onClick={() => {
                        playNavClick();
                        setSelectedDuration('1m');
                        setSelectedFrame(frame);
                      }}
                      className={`group text-start rounded-2xl p-3.5 border bg-white dark:bg-neutral-900 flex flex-col items-center justify-between gap-3 transition-all cursor-pointer active:scale-[0.98] ${
                        isEquippedNow
                          ? 'border-cyan-500 ring-1 ring-cyan-500/40 shadow-md shadow-cyan-500/10'
                          : ownedActive
                          ? 'border-emerald-500/40 hover:border-emerald-500'
                          : 'border-neutral-200 dark:border-neutral-800 hover:border-amber-500/50 shadow-xs'
                      }`}
                    >
                      {/* Top Status & Category Tag */}
                      <div className="w-full flex items-center justify-between gap-1">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${getCategoryBadgeStyle(
                            frame.category
                          )}`}
                        >
                          {getCategoryLabel(frame.category)}
                        </span>
                        {isEquippedNow ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-cyan-500 text-neutral-950">
                            {isAr ? 'مُجهّز' : 'Equipped'}
                          </span>
                        ) : ownedActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            {isAr ? 'مملوك' : 'Owned'}
                          </span>
                        ) : null}
                      </div>

                      {/* Live Avatar Preview inside Frame */}
                      <div className="py-3 flex items-center justify-center">
                        <AvatarWithFrame
                          src={userAvatarSrc}
                          fallbackSrc={fallbackAvatarSrc}
                          alt={isAr ? frame.nameAr : frame.nameEn}
                          frameId={frame.id}
                          sizeClass="w-16 h-16 sm:w-20 sm:h-20 group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>

                      {/* Title + Daily Start Price */}
                      <div className="w-full text-center space-y-1.5">
                        <div className="text-xs font-black text-neutral-900 dark:text-white truncate">
                          {isAr ? frame.nameAr : frame.nameEn}
                        </div>
                        <div className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                          <CoinIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-[11px] font-black tabular-nums">
                            {frame.dailyPrice.toLocaleString()}
                          </span>
                          <span className="text-[9px] font-bold opacity-80">
                            /{isAr ? 'يوم' : 'day'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================================================= */
        /* TAB 2: حقيبتي (My Bag: Status + Remaining + Equip)*/
        /* ================================================= */
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                {isAr ? 'حقيبة الإطارات الخاصة بي' : 'My Avatar Frames Bag'}
              </h2>
              <p className="text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400">
                {isAr
                  ? 'يمكنك تجهيز إطار واحد على صورتك الشخصية أو إلغاء التجهيز في أي وقت.'
                  : 'Equip one active frame on your profile picture or unequip anytime.'}
              </p>
            </div>
            <button
              type="button"
              onClick={fetchBag}
              disabled={isLoadingBag}
              className="p-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 hover:text-cyan-500 cursor-pointer"
              title={isAr ? 'تحديث الحقيبة' : 'Refresh bag'}
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingBag ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {isLoadingBag && computedBagItems.length === 0 ? (
            <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-12 flex flex-col items-center justify-center gap-3 text-neutral-500">
              <Loader2 className="w-7 h-7 animate-spin text-cyan-500" />
              <span className="text-xs font-bold">
                {isAr ? 'جاري تحميل حقيبتك...' : 'Loading your bag...'}
              </span>
            </div>
          ) : computedBagItems.length === 0 ? (
            <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-10 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400">
                <Briefcase className="w-8 h-8" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                {isAr ? 'حقيبتك فارغة حالياً' : 'Your bag is empty'}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
                {isAr
                  ? 'اشترِ إطاراً من المتجر الداخلي (ملون، احترافي، أو VIP) لتظهر في حقيبتك وتتمكن من تجهيزها.'
                  : 'Purchase an avatar frame from the Internal store (Colored, Professional, or VIP) to equip it here.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setMainTab('store');
                  setStoreScope('internal');
                }}
                className="mt-1 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs sm:text-sm cursor-pointer transition-transform active:scale-95"
              >
                {isAr ? 'تصفح الإطارات في المتجر' : 'Browse Frames in Store'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {computedBagItems.map((item) => {
                const frame = getFrameById(item.frameId);
                if (!frame) return null;
                const isBusy = actionLoadingFrameId === item.frameId;

                return (
                  <div
                    key={item.frameId}
                    className={`rounded-2xl p-4 border bg-white dark:bg-neutral-900 flex items-center gap-4 transition-all ${
                      item.isEquipped
                        ? 'border-cyan-500 ring-1 ring-cyan-500/35 shadow-md shadow-cyan-500/10'
                        : item.isActive
                        ? 'border-neutral-200 dark:border-neutral-800'
                        : 'border-neutral-200/70 dark:border-neutral-800/70 opacity-75'
                    }`}
                  >
                    {/* Preview */}
                    <div className="shrink-0 p-2">
                      <AvatarWithFrame
                        src={userAvatarSrc}
                        fallbackSrc={fallbackAvatarSrc}
                        alt={isAr ? frame.nameAr : frame.nameEn}
                        frameId={frame.id}
                        sizeClass="w-16 h-16"
                      />
                    </div>

                    {/* Details + Status + Remaining Time + Actions */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-neutral-900 dark:text-white truncate">
                            {isAr ? frame.nameAr : frame.nameEn}
                          </h3>
                          <span
                            className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-black border ${getCategoryBadgeStyle(
                              frame.category
                            )}`}
                          >
                            {getCategoryLabel(frame.category)}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 inline-flex items-center gap-1 ${
                            item.isEquipped
                              ? 'bg-cyan-500 text-neutral-950'
                              : item.isActive
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                          }`}
                        >
                          {item.isEquipped && <ShieldCheck className="w-3 h-3" />}
                          <span>
                            {item.isEquipped
                              ? isAr
                                ? 'مُجهّز'
                                : 'Equipped'
                              : item.isActive
                              ? isAr
                                ? 'نشط · غير مُجهّز'
                                : 'Active'
                              : isAr
                              ? 'منتهي الصلاحية'
                              : 'Expired'}
                          </span>
                        </span>
                      </div>

                      {/* Remaining Time */}
                      <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-300">
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>
                          {isAr ? 'المدة المتبقية: ' : 'Remaining: '}
                          <strong className="text-neutral-900 dark:text-white tabular-nums">
                            {formatRemainingDuration(item.remainingMs, isAr)}
                          </strong>
                        </span>
                      </div>

                      {/* Equip / Unequip / Renew Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        {item.isEquipped ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleUnequipFrame(item.frameId)}
                            className="flex-1 py-2 px-3 rounded-xl bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95 disabled:opacity-60"
                          >
                            {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>{isAr ? 'إلغاء تجهيز' : 'Unequip'}</span>
                          </button>
                        ) : item.isActive ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleEquipFrame(item.frameId)}
                            className="flex-1 py-2 px-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95 disabled:opacity-60 shadow-sm shadow-cyan-500/20"
                          >
                            {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>{isAr ? 'تجهيز' : 'Equip'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDuration('1m');
                              setSelectedFrame(frame);
                              setMainTab('store');
                              setStoreScope('internal');
                            }}
                            className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95"
                          >
                            <span>{isAr ? 'تجديد المدة' : 'Renew'}</span>
                          </button>
                        )}

                        {item.isActive && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDuration('1m');
                              setSelectedFrame(frame);
                            }}
                            className="py-2 px-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-black cursor-pointer transition-colors"
                          >
                            {isAr ? 'تمديد' : 'Extend'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================= */}
      {/* PURCHASE / DURATION SELECTION MODAL               */}
      {/* ================================================= */}
      {selectedFrame && (
        <div
          className="fixed inset-0 z-[160] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={() => !isPurchasing && setSelectedFrame(null)}
        >
          <div
            className="w-full sm:max-w-md bg-white dark:bg-neutral-900 rounded-t-3xl sm:rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom-5 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border mb-1 ${getCategoryBadgeStyle(
                    selectedFrame.category
                  )}`}
                >
                  {getCategoryLabel(selectedFrame.category)}
                </span>
                <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                  {isAr ? selectedFrame.nameAr : selectedFrame.nameEn}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {isAr ? selectedFrame.descriptionAr : selectedFrame.descriptionEn}
                </p>
              </div>
              <button
                type="button"
                disabled={isPurchasing}
                onClick={() => setSelectedFrame(null)}
                className="p-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Large Preview */}
            <div className="py-5 rounded-2xl bg-neutral-100/80 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 flex flex-col items-center justify-center gap-2">
              <AvatarWithFrame
                src={userAvatarSrc}
                fallbackSrc={fallbackAvatarSrc}
                alt={isAr ? selectedFrame.nameAr : selectedFrame.nameEn}
                frameId={selectedFrame.id}
                sizeClass="w-24 h-24 sm:w-28 sm:h-28"
              />
              <span className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400 mt-1">
                {isAr ? 'معاينة مباشرة على صورتك الشخصية' : 'Live preview on your avatar'}
              </span>
            </div>

            {/* Duration Selector (1 يوم / 1 أسبوع / 1 شهر / 1 سنة) */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-neutral-700 dark:text-neutral-300">
                {isAr ? 'اختر مدة التفعيل' : 'Select Duration'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FRAME_DURATIONS.map((dur) => {
                  const price = getFramePriceForDuration(selectedFrame, dur.key);
                  const active = selectedDuration === dur.key;
                  return (
                    <button
                      key={dur.key}
                      type="button"
                      disabled={isPurchasing}
                      onClick={() => {
                        playNavClick();
                        setSelectedDuration(dur.key);
                      }}
                      className={`p-3 rounded-2xl border text-start flex flex-col justify-between gap-1 transition-all cursor-pointer ${
                        active
                          ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500 text-neutral-900 dark:text-white shadow-xs'
                          : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 w-full">
                        <span className="text-xs sm:text-sm font-black">
                          {isAr ? dur.labelAr : dur.labelEn}
                        </span>
                        {(dur.badgeAr || dur.badgeEn) && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            {isAr ? dur.badgeAr : dur.badgeEn}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <CoinIcon className="w-3.5 h-3.5 shrink-0" />
                        <span className="text-xs font-black tabular-nums">
                          {price.toLocaleString()}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Balance & Action Button */}
            {(() => {
              const finalPrice = getFramePriceForDuration(selectedFrame, selectedDuration);
              const canAfford = coinsBalance >= finalPrice;
              const alreadyOwnedActive = computedBagItems.some(
                (i) => i.frameId === selectedFrame.id && i.isActive
              );

              return (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-neutral-500 dark:text-neutral-400 font-bold">
                      {isAr ? 'رصيدك الحالي:' : 'Your balance:'}
                    </span>
                    <span
                      className={`font-black tabular-nums inline-flex items-center gap-1 ${
                        canAfford
                          ? 'text-neutral-900 dark:text-white'
                          : 'text-rose-500'
                      }`}
                    >
                      <CoinIcon className="w-3.5 h-3.5" />
                      {coinsBalance.toLocaleString()}
                    </span>
                  </div>

                  {canAfford ? (
                    <button
                      type="button"
                      disabled={isPurchasing}
                      onClick={handlePurchaseFrame}
                      className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-transform active:scale-98 disabled:opacity-60"
                    >
                      {isPurchasing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{isAr ? 'جاري الشراء...' : 'Purchasing...'}</span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-4 h-4" />
                          <span>
                            {alreadyOwnedActive
                              ? isAr
                                ? `تمديد المدة (${finalPrice.toLocaleString()} كوينز)`
                                : `Extend Duration (${finalPrice.toLocaleString()} Coins)`
                              : isAr
                              ? `شراء الآن (${finalPrice.toLocaleString()} كوينز)`
                              : `Purchase Now (${finalPrice.toLocaleString()} Coins)`}
                          </span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFrame(null);
                        onOpenWallet();
                      }}
                      className="w-full py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 cursor-pointer transition-transform active:scale-98"
                    >
                      <CoinIcon className="w-4 h-4" />
                      <span>
                        {isAr
                          ? 'رصيدك غير كافٍ · انتقل لشحن الكوينز'
                          : 'Insufficient Coins · Go to Wallet'}
                      </span>
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
