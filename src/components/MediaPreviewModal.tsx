import React, { useState } from 'react';
import { X, Send, Image as ImageIcon, Music, Loader2, Sparkles } from 'lucide-react';
import { Language } from '../types';
import { AudioMessagePlayer } from './AudioMessagePlayer';

interface MediaPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (caption?: string) => void;
  mediaType: 'image' | 'audio';
  mediaUrl: string;
  audioDuration?: number;
  isLoading?: boolean;
  lang: Language;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  isOpen,
  onClose,
  onSend,
  mediaType,
  mediaUrl,
  audioDuration,
  isLoading = false,
  lang,
}) => {
  const isAr = lang === 'ar';
  const [caption, setCaption] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSend(caption.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 left-4 rtl:left-4 rtl:right-auto ltr:right-4 ltr:left-auto p-1.5 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          aria-label={isAr ? 'إلغاء' : 'Close'}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20">
            {mediaType === 'image' ? <ImageIcon className="w-4.5 h-4.5" /> : <Music className="w-4.5 h-4.5" />}
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
              {mediaType === 'image'
                ? isAr
                  ? 'مشاركة صورة'
                  : 'Share Photo'
                : isAr
                ? 'مشاركة مقطع صوتي'
                : 'Share Audio Note'}
            </h3>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              {isAr ? 'معاينة الوسائط قبل الإرسال' : 'Preview media before sending'}
            </p>
          </div>
        </div>

        {/* Media Preview Box */}
        <div className="rounded-2xl overflow-hidden bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center min-h-[140px] max-h-[380px] p-2">
          {mediaType === 'image' ? (
            <img
              src={mediaUrl}
              alt="Preview"
              className="w-full h-auto max-h-[360px] object-contain rounded-xl"
            />
          ) : (
            <div className="w-full p-4 flex flex-col items-center justify-center gap-2">
              <AudioMessagePlayer src={mediaUrl} duration={audioDuration} />
            </div>
          )}
        </div>

        {/* Form with Caption & Send */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder={
                mediaType === 'image'
                  ? isAr
                    ? 'إضافة تعليق اختياري على الصورة...'
                    : 'Add an optional caption...'
                  : isAr
                  ? 'إضافة ملاحظة صوتية اختيارية...'
                  : 'Add optional note...'
              }
              className="w-full py-2.5 px-4 text-xs sm:text-sm rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-all cursor-pointer shadow-md shadow-emerald-600/25 active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{isAr ? 'إرسال الآن' : 'Send Now'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
