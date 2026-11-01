import React, { useState } from 'react';
import { Lock, Key, X, ShieldAlert, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { Language, AuthUser } from '../types';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentUser: AuthUser | null;
  onSuccess: (token: string) => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({
  isOpen,
  onClose,
  lang,
  currentUser,
  onSuccess,
}) => {
  const isAr = lang === 'ar';
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim() || !currentUser?.email) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email,
          pin: pin.trim(),
        }),
      });

      const data = await res.json();
      if (data.success && data.token) {
        sessionStorage.setItem('soulx_admin_token', data.token);
        onSuccess(data.token);
        setPin('');
      } else {
        setError(data.message || (isAr ? 'رمز PIN غير صحيح' : 'Invalid PIN'));
      }
    } catch (err: any) {
      setError(err.message || (isAr ? 'خطأ في الاتصال بالخادم' : 'Server connection error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon & Title */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-7 h-7" />
          </div>

          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
            {isAr ? 'التحقق من رمز PIN الإداري' : 'Admin PIN Verification'}
          </h2>

          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed px-2">
            {isAr
              ? 'لوحة تحكم Soul-X محمية برمز الأمان ADMIN_PIN المخصص للمديرين.'
              : 'Soul-X Admin Control Panel is protected by the ADMIN_PIN security key.'}
          </p>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono text-neutral-600 dark:text-neutral-300">
            <span>Admin:</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">
              {currentUser?.email}
            </span>
          </div>
        </div>

        {/* PIN Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              {isAr ? 'أدخل رمز PIN الإداري:' : 'Enter Admin PIN:'}
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-neutral-400 absolute right-3.5 top-1/2 -translate-y-1/2 rtl:right-3.5 rtl:left-auto ltr:left-3.5 ltr:right-auto pointer-events-none" />
              <input
                type="password"
                autoFocus
                maxLength={8}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(null);
                }}
                placeholder="••••"
                className="w-full py-3 px-10 text-center font-mono text-xl tracking-widest rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 text-neutral-900 dark:text-white focus:outline-none transition-all"
              />
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={isLoading || !pin.trim()}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-all shadow-md hover:shadow-amber-500/20 active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isAr ? 'دخول اللوحة' : 'Enter Panel'}</span>
                  {isAr ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
