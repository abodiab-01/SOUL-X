import React, { useState, useEffect, useRef } from 'react';
import { X, Gift, Users, Crown, Check, AlertCircle, Wallet, Sparkles } from 'lucide-react';
import { Language, RoomOccupantInfo } from '../../types';
import { SOULX_GIFTS, GIFT_QUANTITIES, GiftItem, formatCompactGiftCost } from '../GiftModal';
import { GiftSvgIcon } from '../GiftIcons';
import { CoinIcon } from '../CurrencyIcons';
import { roomsApi } from '../../lib/roomsApi';
import { getEffectiveAvatar, getDefaultAvatar } from '../../lib/avatar';

interface RoomGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  roomCode: string;
  ownerId: string;
  ownerName: string;
  myUserId: string;
  coinsBalance: number;
  occupants: RoomOccupantInfo[];
  initialRecipientId?: string | null;
  onOpenWallet: () => void;
  onBalanceSync: (nextCoins: number) => void;
}

export const RoomGiftModal: React.FC<RoomGiftModalProps> = ({
  isOpen,
  onClose,
  lang,
  roomCode,
  ownerId,
  ownerName,
  myUserId,
  coinsBalance,
  occupants,
  initialRecipientId,
  onOpenWallet,
  onBalanceSync,
}) => {
  const isAr = lang === 'ar';
  const [selectedGift, setSelectedGift] = useState<GiftItem>(SOULX_GIFTS[0]);
  const [quantity, setQuantity] = useState<number>(1);
  const [recipientMode, setRecipientMode] = useState<'single' | 'selected' | 'all_seated' | 'owner'>('single');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const idempRef = useRef<string>('');

  const seatedOthers = occupants.filter((o) => o.seatNumber !== null && o.userId !== myUserId);
  const otherOccupants = occupants.filter((o) => o.userId !== myUserId);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setConfirmOpen(false);
    idempRef.current = `rgift-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    if (initialRecipientId && initialRecipientId !== myUserId) {
      setRecipientMode('single');
      setSelectedIds([initialRecipientId]);
    } else if (seatedOthers.length > 0) {
      setRecipientMode('single');
      setSelectedIds([seatedOthers[0].userId]);
    } else if (otherOccupants.length > 0) {
      setRecipientMode('single');
      setSelectedIds([otherOccupants[0].userId]);
    } else if (ownerId !== myUserId) {
      setRecipientMode('owner');
      setSelectedIds([ownerId]);
    } else {
      setSelectedIds([]);
    }
  }, [isOpen, initialRecipientId]);

  if (!isOpen) return null;

  const effectiveTargetsCount =
    recipientMode === 'all_seated'
      ? seatedOthers.length
      : recipientMode === 'owner'
      ? (ownerId !== myUserId ? 1 : 0)
      : selectedIds.length;

  const totalCost = selectedGift.cost * quantity * Math.max(0, effectiveTargetsCount);
  const canAfford = coinsBalance >= totalCost && effectiveTargetsCount > 0;

  const toggleUserSelection = (uid: string) => {
    idempRef.current = `rgift-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    if (recipientMode === 'single') {
      setSelectedIds([uid]);
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const executeSend = async () => {
    if (isSending || !canAfford) return;
    setErrorMsg(null);
    setIsSending(true);
    try {
      const key = idempRef.current || `rgift-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const res = await roomsApi.sendGift(roomCode, {
        giftId: selectedGift.id,
        quantity,
        recipientMode,
        recipientIds: recipientMode === 'owner' ? [ownerId] : selectedIds,
        idempotencyKey: key,
      });
      if (!res.success) {
        setErrorMsg(res.message || (isAr ? 'تعذر إرسال الهدية' : 'Failed to send gift'));
        setConfirmOpen(false);
        return;
      }
      if (typeof res.senderCoins === 'number') {
        onBalanceSync(res.senderCoins);
      }
      onClose();
    } catch {
      setErrorMsg(isAr ? 'خطأ في الاتصال بالخادم' : 'Network error');
      setConfirmOpen(false);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[115] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-neutral-950/75 backdrop-blur-md animate-in fade-in duration-200"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="w-full sm:max-w-lg max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-cyan-500" />
            <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
              {isAr ? 'إرسال هدية داخل الغرفة' : 'Send Room Gift'}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenWallet();
              }}
              className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-mono font-black flex items-center gap-1 cursor-pointer"
            >
              <CoinIcon className="w-3.5 h-3.5" />
              <span>{coinsBalance.toLocaleString()}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Recipient Mode */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
              {isAr ? 'إرسال إلى:' : 'Send to:'}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setRecipientMode('single');
                  if (selectedIds.length !== 1 && otherOccupants[0]) setSelectedIds([otherOccupants[0].userId]);
                }}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  recipientMode === 'single'
                    ? 'bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-300'
                    : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {isAr ? 'مستخدم محدد' : 'Single User'}
              </button>
              <button
                type="button"
                onClick={() => setRecipientMode('selected')}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  recipientMode === 'selected'
                    ? 'bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-300'
                    : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {isAr ? 'تحديد متعدد' : 'Multi-Select'}
              </button>
              <button
                type="button"
                onClick={() => setRecipientMode('all_seated')}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 cursor-pointer ${
                  recipientMode === 'all_seated'
                    ? 'bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300'
                    : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-600 dark:text-neutral-300'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{isAr ? `الجميع (${seatedOthers.length})` : `All Seated (${seatedOthers.length})`}</span>
              </button>
              <button
                type="button"
                onClick={() => setRecipientMode('owner')}
                disabled={ownerId === myUserId}
                className={`px-2.5 py-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 ${
                  recipientMode === 'owner'
                    ? 'bg-violet-500/15 border-violet-500 text-violet-700 dark:text-violet-300'
                    : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-600 dark:text-neutral-300'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                <span>{isAr ? 'المالك' : 'Owner'}</span>
              </button>
            </div>

            {(recipientMode === 'single' || recipientMode === 'selected') && (
              <div className="flex gap-2 overflow-x-auto pb-1 pt-1">
                {otherOccupants.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-1">
                    {isAr ? 'لا يوجد مستخدمون آخرون في الغرفة حالياً' : 'No other users in room right now'}
                  </p>
                ) : (
                  otherOccupants.map((occ) => {
                    const checked = selectedIds.includes(occ.userId);
                    return (
                      <button
                        key={occ.userId}
                        type="button"
                        onClick={() => toggleUserSelection(occ.userId)}
                        className={`shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                          checked
                            ? 'bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-300'
                            : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        <img
                          src={getEffectiveAvatar(occ.avatar)}
                          onError={(e) => {
                            e.currentTarget.src = getDefaultAvatar();
                          }}
                          alt={occ.name}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <span className="max-w-[90px] truncate">{occ.name}</span>
                        {occ.seatNumber && <span className="text-[10px] font-mono opacity-70">#{occ.seatNumber}</span>}
                        {checked && <Check className="w-3.5 h-3.5 text-cyan-500" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {recipientMode === 'owner' && (
              <div className="text-xs font-bold text-violet-600 dark:text-violet-400">
                {isAr ? `المستلم: ${ownerName} (مالك الغرفة)` : `Recipient: ${ownerName} (Owner)`}
              </div>
            )}
          </div>

          {/* Gift Grid */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {SOULX_GIFTS.map((gift) => {
              const active = selectedGift.id === gift.id;
              return (
                <button
                  key={gift.id}
                  type="button"
                  onClick={() => setSelectedGift(gift)}
                  className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                    active
                      ? 'bg-cyan-500/15 border-cyan-500 ring-1 ring-cyan-500/50'
                      : 'bg-neutral-50 dark:bg-neutral-800/70 border-neutral-200/80 dark:border-neutral-800 hover:border-cyan-500/40'
                  }`}
                >
                  <GiftSvgIcon giftId={gift.id} className="w-9 h-9" />
                  <span className="text-[11px] font-bold text-neutral-900 dark:text-white truncate max-w-full">
                    {isAr ? gift.nameAr : gift.nameEn}
                  </span>
                  <span className="text-[11px] font-mono font-black text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                    <CoinIcon className="w-3 h-3" />
                    {formatCompactGiftCost(gift.cost)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quantity */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
              {isAr ? 'الكمية لكل مستلم:' : 'Qty each:'}
            </span>
            <div className="flex items-center gap-1.5">
              {GIFT_QUANTITIES.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuantity(q)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-black border cursor-pointer ${
                    quantity === q
                      ? 'bg-cyan-500 text-neutral-950 border-cyan-500'
                      : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  ×{q}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950/60 space-y-2">
          {confirmOpen ? (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
              <div className="text-xs font-bold text-neutral-900 dark:text-white flex items-center justify-between">
                <span>
                  {isAr
                    ? `تأكيد إرسال ${selectedGift.icon} ${selectedGift.nameAr} ×${quantity} إلى ${effectiveTargetsCount} مستلم؟`
                    : `Confirm ${selectedGift.nameEn} ×${quantity} to ${effectiveTargetsCount} recipient(s)?`}
                </span>
                <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                  {totalCost.toLocaleString()} 🪙
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-neutral-200 dark:bg-neutral-800 text-xs font-bold cursor-pointer"
                >
                  {isAr ? 'تراجع' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={isSending}
                  onClick={executeSend}
                  className="flex-[2] py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-neutral-950 text-xs font-black cursor-pointer disabled:opacity-60"
                >
                  {isSending ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'تأكيد وإرسال الآن' : 'Confirm & Send')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-bold">
                  {isAr ? 'التكلفة الإجمالية:' : 'Total cost:'}
                </div>
                <div className="text-sm font-mono font-black text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <CoinIcon className="w-4 h-4" />
                  <span>{totalCost.toLocaleString()}</span>
                  {effectiveTargetsCount > 1 && (
                    <span className="text-[11px] opacity-75">
                      ({(selectedGift.cost * quantity).toLocaleString()} × {effectiveTargetsCount})
                    </span>
                  )}
                </div>
              </div>
              {coinsBalance < totalCost ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenWallet();
                  }}
                  className="px-4 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <Wallet className="w-4 h-4" />
                  <span>{isAr ? 'شحن الكوينز' : 'Top up Coins'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => setConfirmOpen(true)}
                  className="px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-45 text-neutral-950 text-xs sm:text-sm font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAr ? 'إرسال الهدية' : 'Send Gift'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
