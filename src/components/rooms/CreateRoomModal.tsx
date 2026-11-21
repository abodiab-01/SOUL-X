import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Globe, Lock, Sparkles, AlertCircle, Wallet } from 'lucide-react';
import { Language, RoomCategory, RoomDetail } from '../../types';
import { CoinIcon } from '../CurrencyIcons';
import { roomsApi } from '../../lib/roomsApi';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  coinsBalance: number;
  onOpenWallet: () => void;
  onCreated: (room: RoomDetail, newCoinsBalance: number) => void;
}

const CREATE_COST = 25000;

const CATEGORIES: Array<{ id: RoomCategory; ar: string; en: string }> = [
  { id: 'chat', ar: 'دردشة وسوالف', en: 'Chat & Talk' },
  { id: 'music', ar: 'موسيقى وطرب', en: 'Music & Chill' },
  { id: 'games', ar: 'ألعاب وتحديات', en: 'Games & Quiz' },
  { id: 'chill', ar: 'استرخاء وهدوء', en: 'Chill Lounge' },
  { id: 'culture', ar: 'ثقافة ومعرفة', en: 'Culture' },
  { id: 'vip', ar: 'مجلس VIP', en: 'VIP Lounge' },
];

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  lang,
  coinsBalance,
  onOpenWallet,
  onCreated,
}) => {
  const isAr = lang === 'ar';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RoomCategory>('chat');
  const [isPublic, setIsPublic] = useState(true);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const idempotencyRef = useRef<string>('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const hasEnoughCoins = coinsBalance >= CREATE_COST;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMsg(isAr ? 'يُسمح فقط بصور JPEG أو PNG أو WebP' : 'Only JPEG, PNG, or WebP images are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg(isAr ? 'الحد الأقصى لحجم الصورة 5 ميجابايت' : 'Max image size is 5MB');
      return;
    }
    setCoverFile(file);
    idempotencyRef.current = `create-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      setErrorMsg(isAr ? 'يرجى كتابة اسم للغرفة (من 2 إلى 60 حرفاً)' : 'Room name must be 2–60 characters');
      return;
    }
    if (!coverFile) {
      setErrorMsg(isAr ? 'يرجى اختيار صورة غلاف للغرفة' : 'Please upload a room cover image');
      return;
    }
    if (!hasEnoughCoins) {
      setErrorMsg(isAr ? `رصيدك الحالي غير كافٍ (${coinsBalance.toLocaleString()} كوينز)` : 'Insufficient coins balance');
      return;
    }

    if (!idempotencyRef.current) {
      idempotencyRef.current = `create-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('cover', coverFile);
      fd.append('name', trimmedName);
      fd.append('description', description.trim());
      fd.append('category', category);
      fd.append('isPublic', String(isPublic));
      fd.append('idempotencyKey', idempotencyRef.current);

      const res = await roomsApi.createRoom(fd);
      if (!res.success || !res.room) {
        setErrorMsg(res.message || (isAr ? 'تعذر إنشاء الغرفة' : 'Failed to create room'));
        return;
      }
      idempotencyRef.current = '';
      onCreated(res.room, typeof res.coinsBalance === 'number' ? res.coinsBalance : Math.max(0, coinsBalance - CREATE_COST));
      onClose();
    } catch {
      setErrorMsg(isAr ? 'حدث خطأ في الاتصال بالخادم' : 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-neutral-950/75 backdrop-blur-md animate-in fade-in duration-200"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                {isAr ? 'إنشاء غرفة صوتية جديدة' : 'Create New Voice Room'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {isAr ? 'غرفة بـ 15 مقعداً صوتياً ومعرّف ثابت' : '15 voice seats with permanent Room ID'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 flex items-center justify-center text-neutral-600 dark:text-neutral-300 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Fee & Balance Banner */}
        <div className={`rounded-2xl p-3.5 border flex items-center justify-between gap-3 ${
          hasEnoughCoins
            ? 'bg-amber-500/10 border-amber-500/25 text-amber-800 dark:text-amber-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
        }`}>
          <div className="space-y-0.5">
            <div className="text-xs font-bold flex items-center gap-1.5">
              <CoinIcon className="w-4 h-4" />
              <span>{isAr ? 'تكلفة إنشاء الغرفة:' : 'Creation Fee:'} {CREATE_COST.toLocaleString()} {isAr ? 'كوينز' : 'Coins'}</span>
            </div>
            <div className="text-[11px] opacity-85 font-mono">
              {isAr ? 'رصيدك الحالي:' : 'Your balance:'} {coinsBalance.toLocaleString()}
            </div>
          </div>
          {!hasEnoughCoins && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenWallet();
              }}
              className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>{isAr ? 'شحن' : 'Top up'}</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cover Upload + Preview */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
              {isAr ? 'صورة الغرفة *' : 'Room Cover Image *'}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full relative overflow-hidden rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-cyan-500 dark:hover:border-cyan-500 transition-colors cursor-pointer bg-neutral-50 dark:bg-neutral-950/60"
            >
              {coverPreview ? (
                <div className="relative aspect-video w-full">
                  <img src={coverPreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent flex items-end justify-between p-3 text-white">
                    <div className="text-start min-w-0">
                      <p className="text-sm font-black truncate">{name.trim() || (isAr ? 'اسم غرفتك هنا' : 'Your room name')}</p>
                      <p className="text-[11px] opacity-80 font-mono">SX-XXXXXX · 0/15</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-white/20 backdrop-blur-md text-[11px] font-bold flex items-center gap-1">
                      <Upload className="w-3 h-3" />
                      {isAr ? 'تغيير' : 'Change'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-neutral-500 dark:text-neutral-400">
                  <ImageIcon className="w-8 h-8 text-cyan-500" />
                  <span className="text-xs font-bold">{isAr ? 'اضغط لاختيار صورة الغلاف' : 'Tap to choose cover image'}</span>
                  <span className="text-[11px] opacity-75">JPEG · PNG · WebP (max 5MB)</span>
                </div>
              )}
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
              {isAr ? 'اسم الغرفة *' : 'Room Name *'}
            </label>
            <input
              type="text"
              required
              maxLength={60}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                idempotencyRef.current = `create-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
              }}
              placeholder={isAr ? 'مثال: سهرة الأصدقاء أو مجلس الطرب' : 'e.g., Night Lounge or Music Talks'}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
              {isAr ? 'وصف الغرفة (اختياري)' : 'Description (optional)'}
            </label>
            <textarea
              rows={2}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isAr ? 'نبذة قصيرة عن أجواء الغرفة...' : 'Short welcome message or topic...'}
              className="w-full px-3.5 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
              {isAr ? 'تصنيف الغرفة' : 'Category'}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`px-2.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    category === cat.id
                      ? 'bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-300'
                      : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
                  }`}
                >
                  {isAr ? cat.ar : cat.en}
                </button>
              ))}
            </div>
          </div>

          {/* Public vs Private */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setIsPublic(true)}
              className={`p-3 rounded-xl border text-start flex items-center gap-2.5 cursor-pointer transition-all ${
                isPublic
                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-700 dark:text-cyan-300'
                  : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-600 dark:text-neutral-300'
              }`}
            >
              <Globe className="w-4 h-4 shrink-0" />
              <div>
                <div className="text-xs font-black">{isAr ? 'غرفة عامة' : 'Public'}</div>
                <div className="text-[10px] opacity-75">{isAr ? 'تظهر للجميع' : 'Open discovery'}</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setIsPublic(false)}
              className={`p-3 rounded-xl border text-start flex items-center gap-2.5 cursor-pointer transition-all ${
                !isPublic
                  ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300'
                  : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-600 dark:text-neutral-300'
              }`}
            >
              <Lock className="w-4 h-4 shrink-0" />
              <div>
                <div className="text-xs font-black">{isAr ? 'غرفة خاصة' : 'Private'}</div>
                <div className="text-[10px] opacity-75">{isAr ? 'بالدعوة أو الرمز' : 'Invite or PIN'}</div>
              </div>
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-sm font-bold cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !hasEnoughCoins || !coverFile || name.trim().length < 2}
              className="flex-[2] py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99] shadow-lg shadow-cyan-500/25"
            >
              <CoinIcon className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? (isAr ? 'جاري الإنشاء...' : 'Creating...')
                  : isAr
                  ? `إنشاء وخصم ${CREATE_COST.toLocaleString()}`
                  : `Create (${CREATE_COST.toLocaleString()})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
