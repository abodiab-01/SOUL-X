import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Sun,
  Moon,
  Globe,
  Check,
  AlertCircle,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Language, Theme, AuthUser } from '../types';
import { getStoredAuthToken, getStoredRefreshToken } from '../lib/authStorage';

interface SettingsViewProps {
  lang: Language;
  setLang: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  onBack: () => void;
  onLogout?: () => void;
  currentUser?: AuthUser | null;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  lang,
  setLang,
  theme,
  setTheme,
  onBack,
  onLogout: _onLogout,
  currentUser,
}) => {
  const isAr = lang === 'ar';


  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [isChangingPass, setIsChangingPass] = useState(false);
  const [changePassError, setChangePassError] = useState<string | null>(null);
  const [changePassSuccess, setChangePassSuccess] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePassError(null);
    setChangePassSuccess(null);

    if (!currentPassword) {
      setChangePassError(isAr ? 'يرجى إدخال كلمة المرور الحالية' : 'Please enter your current password');
      return;
    }

    if (!newPassword || newPassword.trim().length < 4) {
      setChangePassError(
        isAr
          ? 'كلمة المرور الجديدة يجب أن تكون 4 أحرف أو أرقام على الأقل'
          : 'New password must be at least 4 characters'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setChangePassError(
        isAr ? 'كلمة المرور الجديدة وتأكيدها غير متطابقين' : 'New password and confirmation do not match'
      );
      return;
    }

    if (currentPassword === newPassword) {
      setChangePassError(
        isAr
          ? 'كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية'
          : 'New password must be different from current password'
      );
      return;
    }

    const token = getStoredAuthToken();
    const refreshToken = getStoredRefreshToken();

    setIsChangingPass(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setChangePassSuccess(
          data.message || (isAr ? 'تم تغيير كلمة المرور بنجاح وبشكل فوري!' : 'Password changed successfully!')
        );
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setChangePassError(
          data.message || (isAr ? 'فشل تغيير كلمة المرور، يرجى المحاولة ثانية' : 'Failed to change password')
        );
      }
    } catch (err: any) {
      setChangePassError(
        err?.message || (isAr ? 'حدث خطأ في الاتصال بالخادم أثناء تغيير كلمة المرور' : 'Connection error occurred')
      );
    } finally {
      setIsChangingPass(false);
    }
  };

  const selectLanguage = (newLang: Language) => {
    setLang(newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  const selectTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col bg-neutral-50 dark:bg-neutral-950 animate-in fade-in duration-200">
      {/* Top Header with Back Button (شريط علوي مع زر عودة) */}
      <div className="sticky top-16 z-30 w-full bg-white/90 dark:bg-neutral-950/90 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-800 transition-colors">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors cursor-pointer group"
          >
            {isAr ? (
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            ) : (
              <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            )}
            <span>{isAr ? 'العودة للملف الشخصي' : 'Back to Profile'}</span>
          </button>

          <div className="flex items-center gap-2 text-xs font-mono text-neutral-500">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>SOUL-X // SETTINGS</span>
          </div>
        </div>
      </div>

      {/* Main Content: اللغة والمظهر فقط */}
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8 flex-1">
        {/* Title */}
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-5">
          <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">
            {isAr ? 'الإعدادات' : 'Settings'}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {isAr ? 'تخصيص لغة التطبيق ومظهر الواجهة' : 'Customize application language and appearance'}
          </p>
        </div>

        {/* 1. خيار اللغة (Language Option) */}
        <div className="bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Globe className="w-4.5 h-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                {isAr ? 'لغة التطبيق' : 'Language'}
              </h2>
              <p className="text-[11px] text-neutral-500">
                {isAr ? 'اختر لغة العرض المفضلة' : 'Select your display language'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* العربية */}
            <button
              type="button"
              onClick={() => selectLanguage('ar')}
              className={`p-4 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between group ${
                lang === 'ar'
                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold shadow-xs'
                  : 'bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950/60 dark:hover:bg-neutral-800/80 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div>
                <div className="text-sm font-bold">العربية</div>
                <div className="text-[10px] text-neutral-400 font-mono mt-0.5">Arabic</div>
              </div>
              {lang === 'ar' && (
                <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </button>

            {/* English */}
            <button
              type="button"
              onClick={() => selectLanguage('en')}
              className={`p-4 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between group ${
                lang === 'en'
                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold shadow-xs'
                  : 'bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950/60 dark:hover:bg-neutral-800/80 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div>
                <div className="text-sm font-bold font-mono">English</div>
                <div className="text-[10px] text-neutral-400 mt-0.5">الإنجليزية</div>
              </div>
              {lang === 'en' && (
                <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* 2. خيار المظهر (Theme / Appearance Option) */}
        <div className="bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              {theme === 'dark' ? <Moon className="w-4.5 h-4.5" /> : <Sun className="w-4.5 h-4.5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                {isAr ? 'مظهر الواجهة' : 'Appearance'}
              </h2>
              <p className="text-[11px] text-neutral-500">
                {isAr ? 'التبديل بين الوضع الداكن والفاتح' : 'Switch between Dark and Light mode'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            {/* الداكن (Dark Mode) */}
            <button
              type="button"
              onClick={() => selectTheme('dark')}
              className={`p-4 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between group ${
                theme === 'dark'
                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold shadow-xs'
                  : 'bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950/60 dark:hover:bg-neutral-800/80 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center border border-neutral-800">
                  <Moon className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm font-bold">{isAr ? 'الوضع الداكن' : 'Dark Mode'}</div>
                  <div className="text-[10px] text-neutral-400 font-mono">Dark</div>
                </div>
              </div>
              {theme === 'dark' && (
                <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </button>

            {/* الفاتح (Light Mode) */}
            <button
              type="button"
              onClick={() => selectTheme('light')}
              className={`p-4 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between group ${
                theme === 'light'
                  ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold shadow-xs'
                  : 'bg-neutral-50 hover:bg-neutral-100 dark:bg-neutral-950/60 dark:hover:bg-neutral-800/80 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                  <Sun className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <div className="text-sm font-bold">{isAr ? 'الوضع الفاتح' : 'Light Mode'}</div>
                  <div className="text-[10px] text-neutral-400 font-mono">Light</div>
                </div>
              </div>
              {theme === 'light' && (
                <div className="w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* 3. خيار تغيير كلمة المرور بطلب الكلمة الحالية (Change Password) */}
        <div className="bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <KeyRound className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <span>{isAr ? 'تغيير كلمة المرور' : 'Change Password'}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                    {isAr ? 'فوري وفعلي' : 'Instant & Real'}
                  </span>
                </h2>
                <p className="text-[11px] text-neutral-500">
                  {isAr
                    ? 'يتم طلب كلمة المرور الحالية لتأكيد الهوية وتحديث الحساب فوراً'
                    : 'Requires current password verification with immediate effect'}
                </p>
              </div>
            </div>

            {currentUser?.email && (
              <span className="inline-flex items-center self-start sm:self-auto px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700/60">
                {currentUser.email}
              </span>
            )}
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 pt-1">
            {/* رسالة الخطأ */}
            {changePassError && (
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="leading-relaxed font-medium">{changePassError}</span>
              </div>
            )}

            {/* رسالة النجاح الفوري */}
            {changePassSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="leading-relaxed font-medium">{changePassSuccess}</span>
              </div>
            )}

            {/* حقل كلمة المرور الحالية */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                <span>{isAr ? 'كلمة المرور الحالية' : 'Current Password'}</span>
                <span className="text-[10px] text-neutral-400 font-normal">{isAr ? 'مطلوبة للتأكيد' : 'Required'}</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (changePassError) setChangePassError(null);
                  }}
                  placeholder={isAr ? 'أدخل كلمة المرور الحالية لحسابك...' : 'Enter your current password...'}
                  className="w-full ps-10 pe-10 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 text-xs sm:text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute inset-y-0 end-0 pe-3.5 flex items-center text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* حقل كلمة المرور الجديدة */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                <span>{isAr ? 'كلمة المرور الجديدة' : 'New Password'}</span>
                <span className="text-[10px] text-neutral-400 font-normal">{isAr ? '4 خانات على الأقل' : 'Min 4 characters'}</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-neutral-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (changePassError) setChangePassError(null);
                  }}
                  placeholder={isAr ? 'أدخل كلمة المرور الجديدة...' : 'Enter new password...'}
                  className="w-full ps-10 pe-10 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 text-xs sm:text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute inset-y-0 end-0 pe-3.5 flex items-center text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* حقل تأكيد كلمة المرور الجديدة */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                <span>{isAr ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-neutral-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (changePassError) setChangePassError(null);
                  }}
                  placeholder={isAr ? 'أعد كتابة كلمة المرور الجديدة للتأكيد...' : 'Re-enter new password to confirm...'}
                  className="w-full ps-10 pe-10 py-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 text-xs sm:text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute inset-y-0 end-0 pe-3.5 flex items-center text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* زر الحفظ والتطبيق الفوري */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isChangingPass || !currentPassword || !newPassword || !confirmPassword}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
              >
                {isChangingPass ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isAr ? 'جاري التحقق وتغيير كلمة المرور...' : 'Updating password...'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{isAr ? 'حفظ وتغيير كلمة المرور فوراً' : 'Save & Update Password Immediately'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
