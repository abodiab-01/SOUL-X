import React, { useState } from 'react';
import { Lock, Eye, EyeOff, X, AlertCircle, ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import { Language } from '../types';
import { getStoredAuthToken, getStoredRefreshToken } from '../lib/authStorage';

interface SupremeUnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onSuccess: (supremeToken: string) => void;
}

export const SupremeUnlockModal: React.FC<SupremeUnlockModalProps> = ({
  isOpen,
  onClose,
  lang,
  onSuccess,
}) => {
  const isAr = lang === 'ar';
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setPassword('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = getStoredAuthToken();
      const refreshToken = getStoredRefreshToken();
      const res = await fetch('/api/supreme/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
        },
        body: JSON.stringify({
          password,
        }),
      });

      if (res.status === 404) {
        handleClose();
        return;
      }

      const data = await res.json();
      if (res.ok && data.success && data.supremeToken) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('soulx_supreme_token', data.supremeToken);
        }
        const tok = data.supremeToken;
        setPassword('');
        setError(null);
        onSuccess(tok);
      } else {
        setError(data.message || (isAr ? 'كلمة مرور لوحة الإدارة العليا غير صحيحة' : 'Verification failed'));
      }
    } catch {
      setError(isAr ? 'تعذر الاتصال بالخادم' : 'Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/90 backdrop-blur-md animate-in fade-in duration-200"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 left-4 rtl:left-4 rtl:right-auto ltr:right-4 ltr:left-auto p-2 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-2 pt-1">
          <div className="w-14 h-14 rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-500/30 flex items-center justify-center mx-auto shadow-xs">
            <ShieldCheck className="w-7 h-7" />
          </div>

          <h2 className="text-lg font-extrabold text-neutral-900 dark:text-white">
            {isAr ? 'لوحة الإدارة العليا' : 'Supreme Admin Panel'}
          </h2>

          <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed px-2">
            {isAr
              ? 'أدخل كلمة مرور لوحة الإدارة العليا المضبوطة في متغير البيئة (AAPANEL)'
              : 'Enter the Supreme Admin Panel password configured in AAPANEL'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              {isAr ? 'كلمة مرور لوحة الإدارة العليا (AAPANEL):' : 'AAPANEL Password:'}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-400 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder={isAr ? 'أدخل كلمة مرور AAPANEL...' : 'Enter AAPANEL password...'}
                className="w-full py-2.5 ps-10 pe-10 text-sm rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 text-neutral-900 dark:text-white focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute end-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
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
              onClick={handleClose}
              className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>

            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isAr ? 'فتح اللوحة' : 'Unlock'}</span>
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
