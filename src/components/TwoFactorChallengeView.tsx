import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheck, LogOut, Loader2, AlertCircle, KeyRound, Sparkles, Smartphone } from 'lucide-react';
import { Language, AuthUser } from '../types';
import { storeAuthTokens } from '../lib/authStorage';

interface TwoFactorChallengeViewProps {
  tempToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    displayId?: string;
    avatar?: string;
  };
  lang: Language;
  onSuccess: (result: { user: AuthUser; token?: string; refreshToken?: string }) => void;
  onLogout: () => void;
}

export const TwoFactorChallengeView: React.FC<TwoFactorChallengeViewProps> = ({
  tempToken,
  user,
  lang,
  onSuccess,
  onLogout,
}) => {
  const isAr = lang === 'ar';
  const [code, setCode] = useState('');
  const [isBackupMode, setIsBackupMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [isBackupMode]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = code.trim();
    if (!cleanCode) {
      setError(
        isAr
          ? isBackupMode
            ? 'يرجى إدخال الرمز الاحتياطي'
            : 'يرجى إدخال كود المصادقة المكون من 6 أرقام'
          : isBackupMode
          ? 'Please enter the backup code'
          : 'Please enter the 6-digit code'
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempToken,
          code: cleanCode,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.message ||
            (isAr
              ? 'رمز التحقق غير صحيح أو انتهت صلاحيته'
              : 'Invalid or expired 2FA code')
        );
      }

      // Save tokens
      if (data.token) {
        storeAuthTokens(data.token, data.refreshToken);
      }

      onSuccess({
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken,
      });
    } catch (err: any) {
      setError(
        err?.message ||
          (isAr
            ? 'فشل التحقق من رمز المصادقة الثنائية'
            : 'Failed to verify two-factor authentication')
      );
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isBackupMode) {
      setCode(val.toUpperCase());
    } else {
      const numbersOnly = val.replace(/\D/g, '').slice(0, 6);
      setCode(numbersOnly);
      // Auto-submit when 6 digits are reached
      if (numbersOnly.length === 6 && !isLoading) {
        setTimeout(() => {
          handleSubmit();
        }, 80);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-neutral-950 flex flex-col items-center justify-between p-4 sm:p-8 text-white select-none overflow-y-auto"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      {/* Top Header bar with logout button */}
      <div className="relative w-full max-w-md flex items-center justify-between z-10 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="text-xs font-black tracking-wide text-neutral-300">
            {isAr ? 'حماية الحساب المشددة' : 'Secure Account Verification'}
          </span>
        </div>

        {/* Top-corner Logout button as requested */}
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900/80 hover:bg-rose-500/15 text-neutral-400 hover:text-rose-400 border border-neutral-800 hover:border-rose-500/30 text-xs font-bold transition-all cursor-pointer shadow-xs"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>{isAr ? 'تسجيل خروج' : 'Log out'}</span>
        </button>
      </div>

      {/* Main Card */}
      <div className="relative w-full max-w-md bg-neutral-900/90 border border-neutral-800/80 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-auto z-10">
        {/* Brand visual header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-b from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              {isBackupMode ? (
                <KeyRound className="w-8 h-8 text-amber-400" />
              ) : (
                <Smartphone className="w-8 h-8 text-cyan-400" />
              )}
            </div>
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500"></span>
            </span>
          </div>

          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {isAr ? 'المصادقة الثنائية' : 'Two-Factor Authentication'}
            </h2>
            <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
              {isBackupMode
                ? isAr
                  ? 'أدخل أحد الرموز الاحتياطية المكونة من 8 خانات لتسجيل الدخول.'
                  : 'Enter one of your 8-character backup recovery codes.'
                : isAr
                ? 'أدخل الرمز المكون من 6 أرقام من تطبيق Google Authenticator على هاتفك للمتابعة.'
                : 'Enter the 6-digit verification code generated by Google Authenticator.'}
            </p>
          </div>

          {/* User info pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-950/70 border border-neutral-800 text-[11px] text-neutral-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <span className="font-bold">{user.name}</span>
            <span className="text-neutral-500 font-mono" dir="ltr">({user.email || user.displayId})</span>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="leading-relaxed font-medium">{error}</span>
          </div>
        )}

        {/* Verification Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-bold text-neutral-300">
                {isBackupMode
                  ? isAr
                    ? 'الرمز الاحتياطي:'
                    : 'Backup Code:'
                  : isAr
                  ? 'رمز المصادقة (6 أرقام):'
                  : 'Authenticator Code (6 digits):'}
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsBackupMode(!isBackupMode);
                  setCode('');
                  setError(null);
                }}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold transition-colors cursor-pointer"
              >
                {isBackupMode
                  ? isAr
                    ? 'الرجوع لرمز Authenticator'
                    : 'Use Authenticator Code'
                  : isAr
                  ? 'استخدام رمز احتياطي؟'
                  : 'Use a backup code?'}
              </button>
            </div>

            <input
              ref={inputRef}
              type="text"
              autoFocus
              inputMode={isBackupMode ? 'text' : 'numeric'}
              autoComplete="one-time-code"
              placeholder={isBackupMode ? 'XXXX-XXXX' : '••••••'}
              value={code}
              onChange={handleInputChange}
              dir="ltr"
              className={`w-full h-14 text-center font-mono rounded-2xl bg-neutral-950 border text-white transition-all outline-none ${
                isBackupMode
                  ? 'text-lg font-bold tracking-widest border-amber-500/40 focus:border-amber-400'
                  : 'text-2xl font-black tracking-[0.45em] border-neutral-700 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20'
              }`}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !code.trim() || (!isBackupMode && code.trim().length < 6)}
            className="w-full py-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-sm transition-all cursor-pointer shadow-lg shadow-cyan-500/25 active:scale-98 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isAr ? 'جاري التحقق...' : 'Verifying...'}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                <span>{isAr ? 'تأكيد ودخول الحساب' : 'Verify & Log In'}</span>
              </>
            )}
          </button>
        </form>

        {/* Secondary Logout button below the form */}
        <div className="pt-2 text-center border-t border-neutral-800/80">
          <button
            type="button"
            onClick={onLogout}
            className="w-full py-2.5 rounded-xl hover:bg-neutral-800/60 text-neutral-400 hover:text-rose-400 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isAr ? 'إلغاء وتسجيل الخروج' : 'Cancel and Log out'}</span>
          </button>
        </div>
      </div>

      {/* Footer note */}
      <div className="relative z-10 text-center text-[11px] text-neutral-500 pb-2">
        <span>{isAr ? 'محمي بواسطة Google Authenticator (RFC 6238 TOTP)' : 'Secured via Google Authenticator (RFC 6238)'}</span>
      </div>
    </div>
  );
};
