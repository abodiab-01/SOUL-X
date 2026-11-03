import React, { useState, useEffect } from 'react';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Calendar,
  Check,
  Trash2,
  Zap,
  KeyRound,
  Fingerprint,
  Sun,
  Moon,
  Globe,
} from 'lucide-react';
import { Language, AuthUser, Gender, SavedAccount, Theme } from '../types';
import {
  getSavedAccounts,
  saveAccountToStorage,
  removeSavedAccountFromStorage,
  storeAuthTokens,
  performTokenRefresh,
} from '../lib/authStorage';

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface EmailAuthModalProps {
  isOpen: boolean;
  lang: Language;
  onSuccess: (user: AuthUser) => void;
  theme?: Theme;
  onToggleTheme?: () => void;
  onToggleLang?: () => void;
}

export const EmailAuthModal: React.FC<EmailAuthModalProps> = ({
  isOpen,
  lang,
  onSuccess,
  theme,
  onToggleTheme,
  onToggleLang,
}) => {
  const isAr = lang === 'ar';

  const [step, setStep] = useState<'email' | 'password' | 'register'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saved accounts & persistent 30-day token support
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [rememberDevice, setRememberDevice] = useState(true);
  const [quickLoginLoadingId, setQuickLoginLoadingId] = useState<string | null>(null);

  // Mandatory fields for registration: Gender & Date of Birth
  const [gender, setGender] = useState<Gender | null>(null);
  const [birthYear, setBirthYear] = useState<number>(1998);
  const [birthMonth, setBirthMonth] = useState<number>(9); // 0-indexed (October)
  const [birthDay, setBirthDay] = useState<number>(14);

  // Admin detection state
  const [isAdminAccount, setIsAdminAccount] = useState(false);
  const [adminHasPin, setAdminHasPin] = useState(false);
  const [adminLabel, setAdminLabel] = useState<string | null>(null);

  // Generate Year options (Age 18 to 85)
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear - 18;
  const minYear = currentYear - 85;
  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) {
    years.push(y);
  }

  // Days in selected month
  const daysInMonth = new Date(birthYear, birthMonth + 1, 0).getDate();
  const validDay = Math.min(birthDay, daysInMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Calculate user age
  const birthDateObj = new Date(birthYear, birthMonth, validDay);
  const today = new Date();
  let calculatedAge = today.getFullYear() - birthDateObj.getFullYear();
  const mDiff = today.getMonth() - birthDateObj.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDateObj.getDate())) {
    calculatedAge--;
  }

  // Reset form inputs whenever the modal opens and refresh saved accounts list
  useEffect(() => {
    if (isOpen) {
      setStep('email');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setName('');
      setError(null);
      setIsLoading(false);
      setIsAdminAccount(false);
      setAdminHasPin(false);
      setAdminLabel(null);
      setGender(null);
      setBirthYear(1998);
      setBirthMonth(9);
      setBirthDay(14);
      setSavedAccounts(getSavedAccounts());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Quick 1-Click login using saved 30-day refresh token
  const handleQuickLogin = async (acc: SavedAccount) => {
    if (!acc.refreshToken && !acc.token) {
      setEmail(acc.email);
      setStep('password');
      return;
    }

    setQuickLoginLoadingId(acc.id);
    setError(null);

    try {
      const result = await performTokenRefresh(acc.refreshToken);
      if (result.success && result.user) {
        if (result.user.birthDate) {
          localStorage.setItem('soulx_birth_date', result.user.birthDate);
        }
        if (result.user.gender) {
          localStorage.setItem('soulx_gender', result.user.gender);
        }
        localStorage.setItem('soulx_onboarding_completed', 'true');
        onSuccess(result.user);
        return;
      }

      // If token expired, fall back to email & password
      setEmail(acc.email);
      setStep('password');
      setError(
        isAr
          ? 'انتهت صلاحية جلسة 30 يوماً لهذا الحساب، يرجى كتابة كلمة المرور لتجديد الجلسة'
          : '30-day session expired. Please enter password to renew'
      );
    } catch {
      setEmail(acc.email);
      setStep('password');
    } finally {
      setQuickLoginLoadingId(null);
    }
  };

  const handleRemoveSavedAccount = (e: React.MouseEvent, accId: string) => {
    e.stopPropagation();
    const updated = removeSavedAccountFromStorage(accId);
    setSavedAccounts(updated);
  };

  // Step 1: Check Email
  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError(isAr ? 'يرجى إدخال عنوان بريد إلكتروني صحيح' : 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });
      const data = await res.json();

      if (data.isAdmin) {
        setIsAdminAccount(true);
        setAdminHasPin(Boolean(data.hasAdminPin));
        setAdminLabel(data.name || null);
      } else {
        setIsAdminAccount(false);
        setAdminHasPin(false);
        setAdminLabel(null);
      }

      if (data.exists) {
        // User exists -> Ask for password
        setStep('password');
      } else {
        // User doesn't exist -> Ask for name and password to register
        setStep('register');
      }
    } catch {
      setError(isAr ? 'تعذر الاتصال بالخادم، يرجى المحاولة ثانية' : 'Network error, please try again');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2A: Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError(isAr ? 'يرجى إدخال كلمة المرور' : 'Please enter your password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.token) {
          storeAuthTokens(
            data.token,
            data.refreshToken,
            data.expiresAt,
            data.refreshExpiresAt
          );
        }
        if (rememberDevice && data.user) {
          saveAccountToStorage(data.user, {
            token: data.token,
            refreshToken: data.refreshToken,
            refreshExpiresAt: data.refreshExpiresAt,
          });
        }
        if (data.isAdmin && data.token) {
          sessionStorage.setItem('soulx_admin_token', data.token);
        }
        if (data.user?.birthDate) {
          localStorage.setItem('soulx_birth_date', data.user.birthDate);
        }
        if (data.user?.gender) {
          localStorage.setItem('soulx_gender', data.user.gender);
        }
        localStorage.setItem('soulx_onboarding_completed', 'true');
        onSuccess(data.user);
      } else {
        setError(data.message || (isAr ? 'كلمة المرور غير صحيحة' : 'Incorrect password'));
      }
    } catch {
      setError(isAr ? 'حدث خطأ أثناء تسجيل الدخول' : 'Error logging in');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2B: Register with mandatory Gender and Birth Date
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError(isAr ? 'يرجى كتابة الاسم للمتابعة' : 'Please enter your name');
      return;
    }

    // Enforce mandatory Gender selection
    if (!gender) {
      setError(isAr ? 'تحديد الجنس (ذكر / أنثى) خطوة إجبارية لإتمام إنشاء الحساب' : 'Please select your gender (Required)');
      return;
    }

    // Enforce mandatory Age verification
    if (calculatedAge < 18) {
      setError(isAr ? 'يجب أن يكون عمرك 18 عاماً أو أكثر للتسجيل في Soul-X' : 'You must be at least 18 years old to register');
      return;
    }

    if (!password || password.length < 4) {
      setError(isAr ? 'كلمة المرور يجب أن لا تقل عن 4 خانات' : 'Password must be at least 4 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError(null);

    const formattedBirthDate = `${birthYear}-${String(birthMonth + 1).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: cleanName,
          gender,
          birthDate: formattedBirthDate,
          password,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.token) {
          storeAuthTokens(
            data.token,
            data.refreshToken,
            data.expiresAt,
            data.refreshExpiresAt
          );
        }
        if (rememberDevice && data.user) {
          saveAccountToStorage(data.user, {
            token: data.token,
            refreshToken: data.refreshToken,
            refreshExpiresAt: data.refreshExpiresAt,
          });
        }
        if (data.isAdmin && data.token) {
          sessionStorage.setItem('soulx_admin_token', data.token);
        }
        if (data.user?.birthDate) {
          localStorage.setItem('soulx_birth_date', data.user.birthDate);
        }
        if (data.user?.gender) {
          localStorage.setItem('soulx_gender', data.user.gender);
        }
        localStorage.setItem('soulx_onboarding_completed', 'true');
        onSuccess(data.user);
      } else {
        setError(data.message || (isAr ? 'فشل إنشاء الحساب' : 'Failed to create account'));
      }
    } catch {
      setError(isAr ? 'حدث خطأ أثناء إنشاء الحساب' : 'Error creating account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setPassword('');
    setConfirmPassword('');
    setGender(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 w-full min-h-screen h-full bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-y-auto flex flex-col justify-between animate-in fade-in duration-300">
      {/* Top Bar Actions: Theme & Language Toggles */}
      <div className="absolute top-4 start-4 sm:top-6 sm:start-6 z-20 flex items-center gap-2">
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            title={theme === 'dark' ? (isAr ? 'التبديل إلى الوضع الفاتح' : 'Switch to Light Mode') : (isAr ? 'التبديل إلى الوضع الداكن' : 'Switch to Dark Mode')}
            className="px-3 py-2 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:text-cyan-500 dark:hover:text-cyan-400 shadow-sm transition-all cursor-pointer flex items-center gap-2 text-xs font-bold"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-cyan-600" />}
            <span className="hidden sm:inline">{theme === 'dark' ? (isAr ? 'الوضع الفاتح' : 'Light') : (isAr ? 'الوضع الداكن' : 'Dark')}</span>
          </button>
        )}

        {onToggleLang && (
          <button
            type="button"
            onClick={onToggleLang}
            title={isAr ? 'Switch language to English' : 'تغيير اللغة إلى العربية'}
            className="px-3 py-2 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 text-neutral-800 dark:text-neutral-200 hover:text-cyan-500 dark:hover:text-cyan-400 shadow-sm transition-all cursor-pointer flex items-center gap-2 text-xs font-bold"
          >
            <Globe className="w-4 h-4 text-cyan-500" />
            <span>{isAr ? 'English' : 'العربية'}</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <main className="relative flex-1 w-full max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col justify-center z-10">
        {/* Brand Hero Greeting */}
        <div className="flex flex-col items-center text-center mb-6 relative">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-800 shadow-md flex items-center justify-center text-cyan-600 dark:text-cyan-400 mb-3.5 transition-transform hover:scale-105">
            <span className="font-mono text-2xl font-black tracking-tighter">
              S<span className="text-cyan-500">X</span>
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
            SOUL<span className="text-cyan-500 font-light">—</span>X
          </h2>

          <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mt-1.5 max-w-sm leading-relaxed [text-wrap:balance] font-medium">
            {isAr
              ? 'منصة الشات والتعارف وتوافق الأرواح — تواصل حقيقي ولقاءات صادقة'
              : 'Soul-X — where souls meet for genuine connections'}
          </p>
        </div>

        {/* Content Body: Solid High-Contrast Card */}
        <div className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-7 shadow-xl">

        {/* STEP 1: Email Form */}
        {step === 'email' && (
          <form onSubmit={handleCheckEmail} className="space-y-4 relative">
            <div className="text-center sm:text-start">
              <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white">
                {isAr ? 'تسجيل الدخول أو إنشاء حساب' : 'Sign In or Create Account'}
              </h3>
              <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 font-medium">
                {isAr
                  ? 'أدخل بريدك الإلكتروني للمتابعة'
                  : 'Enter your email to continue'}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block">
                {isAr ? 'البريد الإلكتروني' : 'Email Address'}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-3 flex items-center text-neutral-400 pointer-events-none">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  required
                  autoFocus
                  dir="ltr"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="name@example.com"
                  className="w-full ps-10 pe-3 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all font-medium"
                />
              </div>
            </div>

            {/* Remember account option */}
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950/70 border border-neutral-200 dark:border-neutral-800 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(e) => setRememberDevice(e.target.checked)}
                className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-400 border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 cursor-pointer"
              />
              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
                {isAr ? 'حفظ بيانات الحساب وتسهيل الدخول' : 'Save account & enable easy login'}
              </span>
            </label>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full py-3.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 active:scale-99"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{isAr ? 'متابعة' : 'Continue'}</span>
                  {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </>
              )}
            </button>

            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 text-center leading-relaxed pt-1 font-medium">
              {isAr
                ? 'إذا كان بريدك مسجلاً مسبقاً سيطلب منك كلمة المرور، وإن لم يكن مسجلاً ستنشئ حسابك في ثوانٍ.'
                : 'Existing accounts will be prompted for password; new users will create an account immediately.'}
            </p>
          </form>
        )}

        {/* STEP 2A: Password for Existing User */}
        {step === 'password' && (
          <form onSubmit={handleLogin} className="space-y-4 relative">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <span>{isAr ? 'مرحباً بعودتك! 👋' : 'Welcome back! 👋'}</span>
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 font-medium">
                  {isAdminAccount
                    ? isAr
                      ? 'حساب إدارة معتمد — تسجيل الدخول بكلمة مرور الحساب الفعلية'
                      : 'Authorized Admin Account — Sign in with account password'
                    : isAr
                    ? 'أدخل كلمة المرور لتسجيل الدخول'
                    : 'Enter your password to sign in'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleBackToEmail}
                className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer font-bold"
              >
                {isAr ? 'تغيير البريد' : 'Change email'}
              </button>
            </div>

            {/* Email chip with admin indicator */}
            <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-xs font-mono text-neutral-800 dark:text-neutral-200 font-semibold flex items-center justify-between gap-2 truncate" dir="ltr">
              <div className="flex items-center gap-2 truncate">
                <Mail className="w-4 h-4 text-cyan-500 shrink-0" />
                <span className="truncate">{email}</span>
              </div>
              {isAdminAccount && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-sans font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                  {isAr ? 'مدير النظام' : 'ADMIN'}
                </span>
              )}
            </div>

            {isAdminAccount && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2.5 animate-in fade-in font-medium">
                <ShieldCheck className="w-4 h-4 shrink-0 text-amber-500" />
                <span className="leading-relaxed">
                  {isAr
                    ? 'تم التعرف على حسابك كمدير للنظام (Admin). تسجيل الدخول يتم حصراً عبر كلمة مرور الحساب الفعلية.'
                    : 'Recognized as Administrator. Login is strictly authenticated via your account password.'}
                </span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block">
                {isAr ? 'كلمة المرور' : 'Password'}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-3 flex items-center text-neutral-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={
                    isAdminAccount && adminHasPin
                      ? isAr
                        ? 'أدخل كلمة المرور أو رمز PIN'
                        : 'Enter password or PIN'
                      : '••••••••'
                  }
                  className="w-full ps-10 pe-10 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 end-3 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full py-3.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 active:scale-99"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <span>{isAr ? 'تسجيل الدخول' : 'Sign In'}</span>
              )}
            </button>
          </form>
        )}

        {/* STEP 2B: Register for New User */}
        {step === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4 relative">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h3 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-500" />
                  <span>{isAr ? 'إنشاء حساب جديد' : 'Create New Account'}</span>
                </h3>
                <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5 font-medium">
                  {isAr ? 'بريدك غير مسجل، أدخل اسمك وكلمة مرورك' : 'Email not found, set up your profile'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleBackToEmail}
                className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer font-bold"
              >
                {isAr ? 'تغيير البريد' : 'Change email'}
              </button>
            </div>

            {/* Email chip */}
            <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-xs font-mono text-neutral-800 dark:text-neutral-200 font-semibold flex items-center gap-2 truncate" dir="ltr">
              <Mail className="w-4 h-4 text-cyan-500 shrink-0" />
              <span className="truncate">{email}</span>
            </div>

            {/* Name Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block">
                {isAr ? 'الاسم (الكامل أو المستعار)' : 'Display Name'}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-3 flex items-center text-neutral-400 pointer-events-none">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder={isAr ? 'سلطان الناصر' : 'Alex Rivers'}
                  className="w-full ps-10 pe-3 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all font-medium"
                />
              </div>
            </div>

            {/* Gender Selection (Mandatory) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-cyan-500" />
                  <span>{isAr ? 'الجنس' : 'Gender'}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20">
                    {isAr ? 'إجباري' : 'Required'}
                  </span>
                </label>
                {gender && (
                  <span className="text-[11px] text-cyan-600 dark:text-cyan-400 font-bold">
                    {gender === 'male' ? (isAr ? 'تم اختيار: ذكر' : 'Selected: Male') : (isAr ? 'تم اختيار: أنثى' : 'Selected: Female')}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setGender('male');
                    if (error) setError(null);
                  }}
                  className={`py-3 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    gender === 'male'
                      ? 'bg-cyan-500/15 border-cyan-500 text-cyan-700 dark:text-cyan-300 font-bold shadow-xs'
                      : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:border-neutral-400 dark:hover:border-neutral-600 font-semibold'
                  }`}
                >
                  <span className="text-base">👨</span>
                  <span className="text-xs sm:text-sm">{isAr ? 'ذكر' : 'Male'}</span>
                  {gender === 'male' && <Check className="w-3.5 h-3.5 ms-1" />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setGender('female');
                    if (error) setError(null);
                  }}
                  className={`py-3 px-3 rounded-xl border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    gender === 'female'
                      ? 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300 font-bold shadow-xs'
                      : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-300 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 hover:border-neutral-400 dark:hover:border-neutral-600 font-semibold'
                  }`}
                >
                  <span className="text-base">👩</span>
                  <span className="text-xs sm:text-sm">{isAr ? 'أنثى' : 'Female'}</span>
                  {gender === 'female' && <Check className="w-3.5 h-3.5 ms-1" />}
                </button>
              </div>
            </div>

            {/* Date of Birth Selection (Mandatory) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                  <span>{isAr ? 'تاريخ الميلاد' : 'Date of Birth'}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/20">
                    {isAr ? 'إجباري' : 'Required'}
                  </span>
                </label>

                {calculatedAge > 0 && (
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${
                      calculatedAge >= 18
                        ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                    }`}
                  >
                    {isAr ? `العمر: ${calculatedAge} عاماً` : `Age: ${calculatedAge} y/o`}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Day */}
                <div>
                  <label className="block text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5 font-medium">{isAr ? 'اليوم' : 'Day'}</label>
                  <select
                    value={validDay}
                    onChange={(e) => {
                      setBirthDay(parseInt(e.target.value, 10));
                      if (error) setError(null);
                    }}
                    className="w-full py-2.5 px-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 cursor-pointer"
                  >
                    {days.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Month */}
                <div>
                  <label className="block text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5 font-medium">{isAr ? 'الشهر' : 'Month'}</label>
                  <select
                    value={birthMonth}
                    onChange={(e) => {
                      setBirthMonth(parseInt(e.target.value, 10));
                      if (error) setError(null);
                    }}
                    className="w-full py-2.5 px-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 cursor-pointer"
                  >
                    {(isAr ? MONTHS_AR : MONTHS_EN).map((m, idx) => (
                      <option key={idx} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Year */}
                <div>
                  <label className="block text-[10px] text-neutral-500 dark:text-neutral-400 mb-0.5 font-medium">{isAr ? 'السنة' : 'Year'}</label>
                  <select
                    value={birthYear}
                    onChange={(e) => {
                      setBirthYear(parseInt(e.target.value, 10));
                      if (error) setError(null);
                    }}
                    className="w-full py-2.5 px-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-xs font-semibold text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 cursor-pointer"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-medium">
                {isAr
                  ? 'يُطلب تاريخ الميلاد والجنس لمرة واحدة فقط عند إنشاء الحساب ويتم حفظهما مع اسمك.'
                  : 'Requested once strictly during account creation and saved with your profile.'}
              </p>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block">
                {isAr ? 'كلمة المرور الجديدة' : 'Create Password'}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-3 flex items-center text-neutral-400 pointer-events-none">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full ps-10 pe-10 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 end-3 flex items-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block">
                {isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 start-3 flex items-center text-neutral-400 pointer-events-none">
                  <CheckCircle2 className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full ps-10 pe-3 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-700 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 transition-all font-medium"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !name.trim() || !gender || calculatedAge < 18 || !password || !confirmPassword}
              className="w-full py-3.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 active:scale-99"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <span>{isAr ? 'إنشاء حساب جديد والبدء' : 'Create Account & Begin'}</span>
              )}
            </button>
          </form>
        )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative w-full py-4 px-6 text-center text-xs text-neutral-600 dark:text-neutral-400 border-t border-neutral-200 dark:border-neutral-800 z-10 shrink-0 bg-neutral-100 dark:bg-neutral-950">
        <p className="font-medium">
          {isAr
            ? '© Soul-X Studio — جميع الحقوق محفوظة • منصة الشات والتعارف وتوافق الأرواح'
            : '© Soul-X Studio — All rights reserved • Authentic Connections'}
        </p>
      </footer>
    </div>
  );
};
