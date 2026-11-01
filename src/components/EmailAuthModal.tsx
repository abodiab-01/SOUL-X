import React, { useState } from 'react';
import { Mail, Lock, User, ArrowRight, ArrowLeft, Eye, EyeOff, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Language, AuthUser } from '../types';

interface EmailAuthModalProps {
  isOpen: boolean;
  lang: Language;
  onSuccess: (user: AuthUser) => void;
}

export const EmailAuthModal: React.FC<EmailAuthModalProps> = ({
  isOpen,
  lang,
  onSuccess,
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

  // Admin accounts from environment variables
  const [admin1, setAdmin1] = useState('lasmr.ok9900@gmail.com');
  const [admin2, setAdmin2] = useState('admin@soulx.app');

  React.useEffect(() => {
    fetch('/api/admin/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.admin1) setAdmin1(data.admin1);
          if (data.admin2) setAdmin2(data.admin2);
        }
      })
      .catch(() => {});
  }, []);

  // Reset form inputs whenever the modal opens (e.g. after logout)
  React.useEffect(() => {
    if (isOpen) {
      setStep('email');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setName('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

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
          localStorage.setItem('soulx_auth_token', data.token);
        }
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

  // Step 2B: Register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError(isAr ? 'يرجى كتابة الاسم للمتابعة' : 'Please enter your name');
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

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: cleanName,
          password,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.token) {
          localStorage.setItem('soulx_auth_token', data.token);
        }
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
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="w-56 h-56 bg-cyan-500/10 dark:bg-cyan-500/15 blur-3xl rounded-full absolute -top-10 -right-10 pointer-events-none" />

        {/* Brand Emblem */}
        <div className="flex flex-col items-center text-center mb-6 relative">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700/80 shadow-sm flex items-center justify-center text-cyan-600 dark:text-cyan-400 mb-3">
            <span className="font-mono text-xl font-bold tracking-tighter">
              S<span className="text-cyan-500">X</span>
            </span>
          </div>

          <h2 className="text-xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
            SOUL<span className="text-neutral-400 dark:text-neutral-600 font-light">—</span>X
          </h2>

          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xs leading-relaxed">
            {isAr
              ? 'منصة الشات والتعارف وتوافق الأرواح — تواصل حقيقي ولقاءات صادقة'
              : 'Soul-X — where souls meet for genuine connections'}
          </p>
        </div>

        {/* STEP 1: Email Form */}
        {step === 'email' && (
          <form onSubmit={handleCheckEmail} className="space-y-4 relative">
            <div className="text-center sm:text-start">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                {isAr ? 'تسجيل الدخول أو إنشاء حساب' : 'Sign In or Create Account'}
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                {isAr
                  ? 'أدخل بريدك الإلكتروني للبدء فوراً'
                  : 'Enter your email address to get started'}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
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
                  className="w-full ps-10 pe-3 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !email.trim()}
              className="w-full py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
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

            {/* Quick selector for ADMIN1 and ADMIN2 accounts */}
            <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 space-y-1.5">
              <span className="text-[11px] text-neutral-500 font-semibold block text-start">
                {isAr ? 'حسابات الإدارة المعتمدة (ADMIN1 / ADMIN2):' : 'Authorized Admin Accounts:'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEmail(admin1);
                    setError(null);
                  }}
                  className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-mono flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    ADMIN 1
                  </span>
                  <span className="truncate ps-1 font-sans">{admin1}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail(admin2);
                    setError(null);
                  }}
                  className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-mono flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="font-bold text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    ADMIN 2
                  </span>
                  <span className="truncate ps-1 font-sans">{admin2}</span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 text-center leading-relaxed pt-1">
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
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <span>{isAr ? 'مرحباً بعودتك! 👋' : 'Welcome back! 👋'}</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {isAr ? 'أدخل كلمة المرور لتسجيل الدخول' : 'Enter your password to sign in'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleBackToEmail}
                className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer font-medium"
              >
                {isAr ? 'تغيير البريد' : 'Change email'}
              </button>
            </div>

            {/* Email chip */}
            <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-600 dark:text-neutral-300 flex items-center gap-2 truncate" dir="ltr">
              <Mail className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
              <span className="truncate">{email}</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
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
                  placeholder="••••••••"
                  className="w-full ps-10 pe-10 py-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors"
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
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
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
          <form onSubmit={handleRegister} className="space-y-3.5 relative">
            <div className="flex items-center justify-between pb-1">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-500" />
                  <span>{isAr ? 'إنشاء حساب جديد' : 'Create New Account'}</span>
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {isAr ? 'بريدك غير مسجل، أدخل اسمك وكلمة مرورك' : 'Email not found, set up your profile'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleBackToEmail}
                className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer font-medium"
              >
                {isAr ? 'تغيير البريد' : 'Change email'}
              </button>
            </div>

            {/* Email chip */}
            <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-600 dark:text-neutral-300 flex items-center gap-2 truncate" dir="ltr">
              <Mail className="w-3.5 h-3.5 text-cyan-500 shrink-0" />
              <span className="truncate">{email}</span>
            </div>

            {/* Name Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
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
                  className="w-full ps-10 pe-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500">
                {isAr ? '✓ لا مشكلة من تكرار الأسماء، اختر الاسم المفضل لك.' : '✓ Duplicate names are allowed.'}
              </p>
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
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
                  className="w-full ps-10 pe-10 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors"
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
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
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
                  className="w-full ps-10 pe-3 py-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-300 dark:border-neutral-800 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !name.trim() || !password || !confirmPassword}
              className="w-full py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50"
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
    </div>
  );
};
