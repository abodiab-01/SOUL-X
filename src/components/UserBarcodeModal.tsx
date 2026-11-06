import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import QRCode from 'qrcode';
import { Language } from '../types';

interface UserBarcodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName?: string;
  lang?: Language;
}

export const UserBarcodeModal: React.FC<UserBarcodeModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  lang = 'ar',
}) => {
  const isAr = lang === 'ar';
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;

    QRCode.toDataURL(userId, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0a0a0a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => {
        console.error('Failed to generate QR code:', err);
      });
  }, [isOpen, userId]);

  if (!isOpen) return null;

  // Generate stylized barcode lines based on userId hash
  const barcodePattern = Array.from(userId).map((char, index) => {
    const code = char.charCodeAt(0);
    const width = (code % 3) + 1.5;
    const isDark = (code + index) % 2 === 0;
    return { width, isDark };
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5 text-center animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800">
          <h3 className="text-base font-black text-neutral-900 dark:text-white">
            {isAr ? 'رمز الباركود الخاص بك' : 'Your Barcode'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barcode & QR Code Card */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-inner flex flex-col items-center justify-center space-y-4">
          {/* QR Code image */}
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code for ${userId}`}
              className="w-52 h-52 object-contain rounded-xl"
            />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center bg-neutral-100 rounded-xl text-xs text-neutral-400">
              {isAr ? 'جاري تجهيز الباركود...' : 'Generating barcode...'}
            </div>
          )}

          {/* Stylized Linear Barcode */}
          <div className="w-full flex items-center justify-center gap-0.5 h-10 px-4 bg-white overflow-hidden" dir="ltr">
            {barcodePattern.concat(barcodePattern).slice(0, 48).map((bar, i) => (
              <div
                key={i}
                className="h-full bg-neutral-950"
                style={{
                  width: `${bar.width}px`,
                  opacity: bar.isDark ? 1 : 0.15,
                }}
              />
            ))}
          </div>

          {/* User ID text */}
          <div className="font-mono text-sm font-black text-neutral-900 tracking-wider">
            {userId}
          </div>
          {userName && (
            <div className="text-xs text-neutral-500 font-medium">
              {userName}
            </div>
          )}
        </div>

        {/* زر إغلاق فقط */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-black text-xs sm:text-sm transition-all cursor-pointer shadow-xs active:scale-98"
        >
          {isAr ? 'إغلاق' : 'Close'}
        </button>
      </div>
    </div>
  );
};
