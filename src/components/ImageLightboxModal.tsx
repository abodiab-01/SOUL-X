import React from 'react';
import { X, Download } from 'lucide-react';
import { Language } from '../types';

interface ImageLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  caption?: string;
  lang: Language;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  caption,
  lang,
}) => {
  const isAr = lang === 'ar';
  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-neutral-950/95 backdrop-blur-xl animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* Top action buttons */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10">
        <span className="text-xs font-bold text-neutral-400">
          {caption ? caption : isAr ? 'عرض الصورة' : 'Photo Viewer'}
        </span>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <a
            href={imageUrl}
            download="soulx-chat-photo.jpg"
            className="p-2 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white transition-colors cursor-pointer"
            title={isAr ? 'تحميل الصورة' : 'Download Photo'}
          >
            <Download className="w-5 h-5" />
          </a>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white transition-colors cursor-pointer"
            title={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div
        className="max-w-4xl max-h-[85vh] flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt="Chat Fullscreen"
          className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl"
        />
        {caption && (
          <p className="mt-3 text-sm text-neutral-200 text-center bg-neutral-900/80 px-4 py-1.5 rounded-full backdrop-blur-md">
            {caption}
          </p>
        )}
      </div>
    </div>
  );
};
