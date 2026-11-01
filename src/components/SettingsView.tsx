import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Sun,
  Moon,
  Globe,
  Check,
  LogOut,
  AlertTriangle,
  Database,
  RefreshCw,
} from 'lucide-react';
import { Language, Theme } from '../types';

interface SettingsViewProps {
  lang: Language;
  setLang: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  onBack: () => void;
  onLogout?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  lang,
  setLang,
  theme,
  setTheme,
  onBack,
  onLogout,
}) => {
  const isAr = lang === 'ar';
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [isCheckingDb, setIsCheckingDb] = useState(false);

  const checkSupabase = () => {
    setIsCheckingDb(true);
    fetch('/api/supabase/status')
      .then((res) => res.json())
      .then((data) => setSupabaseStatus(data))
      .catch(() => setSupabaseStatus({ configured: false, databaseConnected: false }))
      .finally(() => setIsCheckingDb(false));
  };

  React.useEffect(() => {
    checkSupabase();
  }, []);

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

        {/* 3. حالة قاعدة بيانات Supabase (Database Connection Status) */}
        <div className="bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Database className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                  <span>{isAr ? 'قاعدة بيانات Supabase' : 'Supabase Database'}</span>
                  {supabaseStatus?.configured ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                      {supabaseStatus?.databaseConnected
                        ? (isAr ? 'متصلة وفعلية' : 'Connected & Live')
                        : (isAr ? 'مضبوطة في البيئة' : 'Configured')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      {isAr ? 'وضع التخزين الاحتياطي' : 'Local Fallback'}
                    </span>
                  )}
                </h2>
                <p className="text-[11px] text-neutral-500">
                  {isAr
                    ? 'التحقق من اتصال قاعدة البيانات والمتغيرات البيئية الفعالة'
                    : 'Real-time database connection status'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={checkSupabase}
              disabled={isCheckingDb}
              className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-cyan-500 transition-colors cursor-pointer"
              title={isAr ? 'إعادة فحص الاتصال' : 'Refresh Connection'}
            >
              <RefreshCw className={`w-4 h-4 ${isCheckingDb ? 'animate-spin text-cyan-500' : ''}`} />
            </button>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/80 dark:border-neutral-800/80 space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-neutral-700 dark:text-neutral-300">
              <span className="text-neutral-500">{isAr ? 'حالة الضبط بالبيئة:' : 'Env Configuration:'}</span>
              <span className="font-mono font-medium">
                {supabaseStatus?.configured ? 'SUPABASE_URL & KEYS DETECTED' : 'NOT DETECTED (Fallback Active)'}
              </span>
            </div>

            {supabaseStatus?.configured && (
              <>
                <div className="flex items-center justify-between text-neutral-700 dark:text-neutral-300">
                  <span className="text-neutral-500">{isAr ? 'جدول المستخدمين (profiles):' : 'Profiles Table:'}</span>
                  <span className={supabaseStatus.profilesTableReady ? 'text-emerald-500 font-bold' : 'text-amber-500'}>
                    {supabaseStatus.profilesTableReady
                      ? (isAr ? `جاهز (${supabaseStatus.profilesCount} مستخدم)` : `Ready (${supabaseStatus.profilesCount} users)`)
                      : (isAr ? 'قيد الانتظار أو الهجرة' : 'Pending migration')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-neutral-700 dark:text-neutral-300">
                  <span className="text-neutral-500">{isAr ? 'مستودع الصور (soul-x):' : 'Storage Bucket (soul-x):'}</span>
                  <span className={supabaseStatus.storageBucketReady ? 'text-emerald-500 font-bold' : 'text-cyan-500'}>
                    {supabaseStatus.storageBucketReady
                      ? (isAr ? 'جاهز ونشط' : 'Ready & Public')
                      : (isAr ? 'يتم الإنشاء تلقائياً' : 'Auto-provisioning')}
                  </span>
                </div>
              </>
            )}

            <div className="pt-1 text-[11px] text-neutral-500 leading-relaxed">
              {supabaseStatus?.message || (isAr ? 'جاري فحص الاتصال...' : 'Checking connection...')}
            </div>
          </div>
        </div>

        {/* 4. خيار تسجيل الخروج وحذف الجلسة (Logout & Clear Session) */}
        {onLogout && (
          <div className="bg-white dark:bg-neutral-900/70 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <LogOut className="w-4.5 h-4.5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'جلسة الحساب وتفريغ البيانات' : 'Account Session'}
                </h2>
                <p className="text-[11px] text-neutral-500">
                  {isAr ? 'إنهاء جلسة التوكن الحالية والعودة لشاشة البداية' : 'End current session and return to start'}
                </p>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full py-3.5 px-4 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-bold text-xs sm:text-sm border border-red-200 dark:border-red-900/40 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
              >
                <LogOut className="w-4 h-4" />
                <span>{isAr ? 'تسجيل الخروج وحذف الجلسة بالكامل' : 'Log Out & Delete Session'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logout Confirmation Modal in Settings */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
              {isAr ? 'تأكيد تسجيل الخروج' : 'Confirm Logout'}
            </h3>

            <p className="text-xs text-neutral-500 leading-relaxed">
              {isAr
                ? 'سيتم حذف جلسة التوكن بالكامل وتفريغ كافة البيانات المحفوظة محلياً والعودة لشاشة البداية.'
                : 'Your session token will be completely revoked and all local data cleared.'}
            </p>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  if (onLogout) onLogout();
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors shadow-sm cursor-pointer"
              >
                {isAr ? 'تأكيد الخروج' : 'Log Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
