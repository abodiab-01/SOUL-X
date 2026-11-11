import React, { useState } from 'react';
import {
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
  ShieldAlert,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  UserX,
  UserCheck,
} from 'lucide-react';
import { Language, Theme, AuthUser, BlockedUserRecord } from '../types';
import { getStoredAuthToken, getStoredRefreshToken } from '../lib/authStorage';
import { TwoFactorSetupModal } from './TwoFactorSetupModal';
import { fetchBlockedUsers, unblockUserApi } from '../lib/blockUtils';
import { getEffectiveAvatar, getDefaultAvatar } from '../lib/avatar';
import { formatLocalDate } from '../lib/dateUtils';

interface SettingsViewProps {
  lang: Language;
  setLang: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  onBack: () => void;
  onLogout?: () => void;
  currentUser?: AuthUser | null;
  initialSection?: 'blocked' | 'general' | 'password';
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  lang,
  setLang,
  theme,
  setTheme,
  onBack,
  onLogout: _onLogout,
  currentUser,
  initialSection,
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

  // 2FA Google Authenticator state
  const [is2FAEnabled, setIs2FAEnabled] = useState<boolean>(() => Boolean(currentUser?.twoFactorEnabled));
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [twoFAMode, setTwoFAMode] = useState<'enable' | 'disable'>('enable');
  const [isLoading2FAStatus, setIsLoading2FAStatus] = useState(false);

  // Fetch real-time 2FA status from server
  React.useEffect(() => {
    const token = getStoredAuthToken();
    const refreshToken = getStoredRefreshToken();
    if (!token && !refreshToken) return;

    setIsLoading2FAStatus(true);
    fetch('/api/2fa/status', {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && typeof data.twoFactorEnabled === 'boolean') {
          setIs2FAEnabled(data.twoFactorEnabled);
        }
      })
      .catch(() => {})
      .finally(() => {
        setIsLoading2FAStatus(false);
      });
  }, []);

  // ----------------------------------------------------
  // Blocked Users Management (قائمة المحظورين وإلغاء الحظر)
  // ----------------------------------------------------
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserRecord[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const [blockedToast, setBlockedToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadBlockedUsers = () => {
    if (!currentUser?.id && !currentUser?.displayId && !currentUser?.email) return;
    setIsLoadingBlocked(true);
    fetchBlockedUsers(currentUser?.id, currentUser?.displayId, currentUser?.email)
      .then((list) => {
        setBlockedUsers(list);
      })
      .catch(() => {})
      .finally(() => {
        setIsLoadingBlocked(false);
      });
  };

  React.useEffect(() => {
    loadBlockedUsers();
    const handleBlockUpdate = () => loadBlockedUsers();
    window.addEventListener('soulx:blocks-updated', handleBlockUpdate);
    return () => window.removeEventListener('soulx:blocks-updated', handleBlockUpdate);
  }, [currentUser?.id, currentUser?.displayId, currentUser?.email]);

  React.useEffect(() => {
    if (initialSection === 'blocked') {
      const timer = setTimeout(() => {
        const el = document.getElementById('blocked-users-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [initialSection]);

  const handleUnblock = async (targetUserId: string, targetName: string) => {
    const myUid = currentUser?.id || currentUser?.displayId;
    if (!myUid) return;
    setUnblockingUserId(targetUserId);
    try {
      const res = await unblockUserApi({
        userId: myUid,
        targetUserId,
      });
      if (res.success) {
        setBlockedUsers((prev) =>
          prev.filter(
            (u) =>
              u.blockedId !== targetUserId &&
              u.blockedDisplayId !== targetUserId &&
              u.id !== targetUserId
          )
        );
        setBlockedToast({
          message: isAr ? `تم فك الحظر عن ${targetName} بنجاح` : `Unblocked ${targetName} successfully`,
          type: 'success',
        });
        setTimeout(() => setBlockedToast(null), 3500);
      } else {
        setBlockedToast({
          message: res.message || (isAr ? 'تعذر فك الحظر، يرجى المحاولة ثانية' : 'Failed to unblock user'),
          type: 'error',
        });
        setTimeout(() => setBlockedToast(null), 3500);
      }
    } catch {
      setBlockedToast({
        message: isAr ? 'حدث خطأ في الاتصال أثناء فك الحظر' : 'Connection error while unblocking',
        type: 'error',
      });
      setTimeout(() => setBlockedToast(null), 3500);
    } finally {
      setUnblockingUserId(null);
    }
  };

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
      {/* Main Content: اللغة والمظهر فقط */}
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 flex-1">
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

        {/* 4. خيار المصادقة الثنائية Google Authenticator (Two-Factor Authentication) */}
        <div className="bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                  is2FAEnabled
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    : 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                }`}
              >
                {is2FAEnabled ? <ShieldCheck className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'المصادقة الثنائية (Google Authenticator)' : 'Two-Factor Authentication (Google Authenticator)'}
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      is2FAEnabled
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        is2FAEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'
                      }`}
                    />
                    <span>{is2FAEnabled ? (isAr ? 'مفعلة' : 'Enabled') : (isAr ? 'معطلة' : 'Disabled')}</span>
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
                  {is2FAEnabled
                    ? isAr
                      ? 'حسابك محمي برمز أمان يتجدد كل 30 ثانية. يتطلب تسجيل الدخول أو إلغاء التفعيل إدخال كود المصادقة.'
                      : 'Your account is secured with rotating 30-sec codes. Login or deactivation requires verification.'
                    : isAr
                    ? 'ربط حسابك بتطبيق Google Authenticator لطلب كود تحقق إضافي عند تسجيل الدخول لحماية أقصى.'
                    : 'Link your account to Google Authenticator to require a verification code upon login.'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-neutral-600 dark:text-neutral-400">
              {is2FAEnabled ? (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    {isAr
                      ? 'المصادقة نشطة ومفعلة. لا يمكن تعطيلها إلا بإدخال كود التحقق من تطبيقك.'
                      : '2FA is active. Deactivation requires entering your authenticator code.'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-neutral-500">
                  <Lock className="w-4 h-4 shrink-0 text-cyan-500" />
                  <span>
                    {isAr
                      ? 'عند التفعيل، ستحصل على رمز QR ومفتاح يدوي مع 8 رموز احتياطية للطوارئ.'
                      : 'Enabling provides a QR code, secret key, and 8 backup emergency codes.'}
                  </span>
                </div>
              )}
            </div>

            <div className="shrink-0">
              {is2FAEnabled ? (
                <button
                  type="button"
                  onClick={() => {
                    setTwoFAMode('disable');
                    setIs2FAModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>{isAr ? 'تعطيل المصادقة الثنائية' : 'Disable 2FA'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTwoFAMode('enable');
                    setIs2FAModalOpen(true);
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs transition-all cursor-pointer shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2 active:scale-98"
                >
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>{isAr ? 'تفعيل المصادقة الثنائية' : 'Enable 2FA'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 5. قائمة المحظورين مع إمكانية فك الحظر (Blocked Users List & Unblock) */}
        <div id="blocked-users-section" className="bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                <UserX className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                    {isAr ? 'قائمة المحظورين' : 'Blocked Users'}
                  </h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                    {blockedUsers.length} {isAr ? 'محظور' : 'blocked'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
                  {isAr
                    ? 'المستخدمون المحظورون لا يمكنهم مراسلتك ولن تظهر رسائلهم لك. يمكنك فك الحظر في أي وقت.'
                    : 'Blocked users cannot send you messages. You can unblock them at any time.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadBlockedUsers}
              disabled={isLoadingBlocked}
              className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title={isAr ? 'تحديث القائمة' : 'Refresh list'}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBlocked ? 'animate-spin' : ''}`} />
              <span className="text-[11px]">{isAr ? 'تحديث' : 'Refresh'}</span>
            </button>
          </div>

          {/* Feedback Toast */}
          {blockedToast && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in ${
                blockedToast.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
              }`}
            >
              {blockedToast.type === 'success' ? (
                <ShieldCheck className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span className="leading-relaxed font-medium">{blockedToast.message}</span>
            </div>
          )}

          {/* List Content */}
          {isLoadingBlocked && blockedUsers.length === 0 ? (
            <div className="py-8 text-center flex flex-col items-center justify-center gap-2 text-neutral-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-cyan-500" />
              <span>{isAr ? 'جاري تحميل قائمة المحظورين...' : 'Loading blocked users...'}</span>
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="py-8 px-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/40 border border-dashed border-neutral-200 dark:border-neutral-800 text-center flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1">
                <UserCheck className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                {isAr ? 'لا يوجد أي مستخدم محظور في حسابك' : 'No blocked users'}
              </p>
              <p className="text-[11px] text-neutral-400 max-w-sm">
                {isAr
                  ? 'عند قيامك بحظر أي مستخدم من داخل المحادثات، سيتم منعه من مراسلتك وستجده مدرجاً هنا مع خيار فك الحظر.'
                  : 'When you block a user from chat, they will be prevented from messaging you and listed here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 pt-1">
              {blockedUsers.map((user) => {
                const targetKey = user.blockedId || user.blockedDisplayId || user.id;
                const isUnblocking =
                  unblockingUserId === targetKey ||
                  unblockingUserId === user.blockedId ||
                  unblockingUserId === user.blockedDisplayId;
                const avatarSrc = getEffectiveAvatar(user.photoUrl, user.gender);

                return (
                  <div
                    key={user.id}
                    className="p-3.5 sm:p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 flex items-center justify-between gap-3 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={avatarSrc}
                          alt={user.name}
                          className="w-11 h-11 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-800"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = getDefaultAvatar(user.gender);
                          }}
                        />
                        <div className="absolute -bottom-1 -end-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center border-2 border-white dark:border-neutral-900">
                          <UserX className="w-2.5 h-2.5" />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-neutral-900 dark:text-white truncate">
                            {user.name}
                          </h4>
                          {user.country && (
                            <span className="text-[10px] text-neutral-400 truncate hidden sm:inline">
                              • {user.country}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold" dir="ltr">
                            {user.displayId || user.blockedDisplayId || user.blockedId}
                          </span>
                          {user.blockedAt && (
                            <span className="text-[10px] text-neutral-400">
                              {isAr ? 'محظور منذ:' : 'Blocked:'} {formatLocalDate(user.blockedAt, lang)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUnblock(targetKey, user.name)}
                      disabled={isUnblocking}
                      className="px-3.5 sm:px-4 py-2 rounded-xl bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700 font-bold text-xs shadow-xs hover:border-cyan-500 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 disabled:opacity-50"
                      title={isAr ? 'إلغاء الحظر' : 'Unblock'}
                    >
                      {isUnblocking ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-500" />
                          <span>{isAr ? 'جاري الفك...' : 'Unblocking...'}</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{isAr ? 'فك الحظر' : 'Unblock'}</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Two-Factor Authentication Setup & Disable Modal */}
      <TwoFactorSetupModal
        isOpen={is2FAModalOpen}
        onClose={() => setIs2FAModalOpen(false)}
        lang={lang}
        currentUser={currentUser}
        mode={twoFAMode}
        onStatusChanged={(enabled) => {
          setIs2FAEnabled(enabled);
          if (currentUser) {
            currentUser.twoFactorEnabled = enabled;
            try {
              localStorage.setItem('soulx_auth_user', JSON.stringify(currentUser));
            } catch {}
          }
        }}
      />
    </div>
  );
};
