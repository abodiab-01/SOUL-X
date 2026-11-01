import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { BottomNav, TabType } from './components/BottomNav';
import { AccountView } from './components/AccountView';
import { ChatsView } from './components/ChatsView';
import { MatchingView } from './components/MatchingView';
import { WalletView } from './components/WalletView';
import { SettingsView } from './components/SettingsView';
import { TelegramBotModal } from './components/TelegramBotModal';
import { OnboardingModal } from './components/OnboardingModal';
import { useTelegramAuth } from './hooks/useTelegramAuth';
import { Language, Theme, Gender } from './types';
import { Send, ShieldCheck, Sparkles } from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [theme, setTheme] = useState<Theme>('dark');
  const [activeTab, setActiveTab] = useState<TabType>('match');
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Persistent user profile details (Date of birth & Gender)
  const [birthDate, setBirthDate] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('soulx_birth_date');
    }
    return null;
  });

  const [gender, setGender] = useState<Gender | null>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('soulx_gender') as Gender) || null;
    }
    return null;
  });

  // Telegram WebApp Authentication hook
  const auth = useTelegramAuth((newLang) => setLang(newLang));

  // Determine if this is a first-time login for the user
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (auth.telegramUser) {
      // If Telegram user, check specific onboarding state for this Telegram ID
      const userKey = `soulx_onboarded_${auth.telegramUser.id}`;
      const isUserOnboarded = localStorage.getItem(userKey);
      if (!isUserOnboarded) {
        setIsOnboardingOpen(true);
      }
    } else {
      // General new web visitor
      const completed = localStorage.getItem('soulx_onboarding_completed');
      if (!completed && (!birthDate || !gender)) {
        setIsOnboardingOpen(true);
      }
    }
  }, [auth.telegramUser]);

  const handleCompleteOnboarding = (data: { birthDate: string; gender: Gender }) => {
    setBirthDate(data.birthDate);
    setGender(data.gender);
    if (typeof window !== 'undefined') {
      localStorage.setItem('soulx_birth_date', data.birthDate);
      localStorage.setItem('soulx_gender', data.gender);
      localStorage.setItem('soulx_onboarding_completed', 'true');
      if (auth.telegramUser) {
        localStorage.setItem(`soulx_onboarded_${auth.telegramUser.id}`, 'true');
      }
    }
    setIsOnboardingOpen(false);
    setIsEditingProfile(false);
  };

  // Persistent wallet balance (starts at 1,250 diamonds)
  const [walletBalance, setWalletBalance] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soulx_wallet_balance');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return 1250;
  });

  const handleRecharge = (amount: number) => {
    setWalletBalance((prev) => {
      const next = prev + amount;
      if (typeof window !== 'undefined') {
        localStorage.setItem('soulx_wallet_balance', next.toString());
      }
      return next;
    });
  };

  const isAr = lang === 'ar';

  // Synchronize document dir and lang attributes
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Synchronize dark mode class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const isAccountTab = activeTab === 'account';

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors flex flex-col selection:bg-cyan-500/20 selection:text-cyan-400">
      {/* البار العلوي / Top Bar */}
      <Navbar
        lang={lang}
        walletBalance={walletBalance}
        onOpenWallet={() => {
          setIsSettingsOpen(false);
          setIsWalletOpen(true);
        }}
        onBrandClick={() => {
          setIsWalletOpen(false);
          setIsSettingsOpen(false);
          setActiveTab('match');
        }}
      />

      {/* المحتوى الرئيسي حسب التبويب أو شاشة المحفظة / الإعدادات ملء الشاشة */}
      <main
        className={`flex-1 flex flex-col ${
          isAccountTab || isWalletOpen || isSettingsOpen
            ? 'w-full px-0 pt-0 pb-20 items-stretch justify-start'
            : activeTab === 'chats'
            ? 'w-full px-2 sm:px-4 pt-1 sm:pt-3 pb-20 items-stretch justify-start'
            : 'items-center justify-center px-4 sm:px-6 pb-24 pt-6'
        }`}
      >
        {isWalletOpen ? (
          /* شاشة المحفظة كصفحة منفصلة ملء الشاشة مع زر عودة */
          <WalletView
            lang={lang}
            walletBalance={walletBalance}
            onRecharge={handleRecharge}
            onBack={() => setIsWalletOpen(false)}
          />
        ) : isSettingsOpen ? (
          /* شاشة الإعدادات كصفحة منفصلة ملء الشاشة مع زر عودة */
          <SettingsView
            lang={lang}
            setLang={setLang}
            theme={theme}
            setTheme={setTheme}
            onBack={() => setIsSettingsOpen(false)}
          />
        ) : (
          <>
            {activeTab === 'home' && (
              <div className="w-full max-w-xl text-center flex flex-col items-center justify-center py-20 animate-in fade-in duration-300">
                {/* Subtle atmospheric glow */}
                <div className="w-64 h-64 bg-cyan-500/10 dark:bg-cyan-500/5 blur-3xl rounded-full absolute pointer-events-none" />

                <div className="relative">
                  {/* Soul-X Minimal Brand Emblem */}
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                    <span className="font-mono text-xl font-bold tracking-tighter">
                      S<span className="text-cyan-500">X</span>
                    </span>
                  </div>

                  {/* Telegram Verified Chip if logged in via Telegram */}
                  {auth.telegramUser && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#24A1DE]/10 border border-[#24A1DE]/30 text-[#24A1DE] text-xs font-medium mb-3">
                      <Send className="w-3 h-3 -rotate-45" />
                      <span>
                        {isAr ? 'مرحباً، ' : 'Welcome, '}
                        {auth.telegramUser.first_name}
                      </span>
                      {auth.isVerified && (
                        <span title={isAr ? 'تم التحقق المشفر بالسيرفر' : 'Server Verified'}>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        </span>
                      )}
                    </div>
                  )}

                  <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-white mb-3">
                    SOUL<span className="text-neutral-400 dark:text-neutral-600 font-light">—</span>X
                  </h1>

                  <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto leading-relaxed mb-6">
                    {isAr
                      ? 'منصة الشات والتعارف وتوافق الأرواح — تواصل حقيقي ولقاءات صادقة.'
                      : 'Where souls meet — genuine chat, matchmaking, and meaningful connection.'}
                  </p>

                  {/* Quick Action Shortcuts to Match & Chat */}
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab('match')}
                      className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-semibold text-xs transition-colors cursor-pointer shadow-md"
                    >
                      {isAr ? 'ابدأ المطابقة الآن' : 'Start Matching'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('chats')}
                      className="px-5 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-medium text-xs transition-colors cursor-pointer border border-neutral-200 dark:border-neutral-700/60"
                    >
                      {isAr ? 'فتح المحادثات' : 'Open Chats'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsTelegramModalOpen(true)}
                      className="px-3.5 py-2.5 rounded-xl bg-[#24A1DE]/10 hover:bg-[#24A1DE]/20 text-[#24A1DE] font-semibold text-xs transition-colors cursor-pointer border border-[#24A1DE]/30 flex items-center gap-1.5"
                      title={isAr ? 'بوت تلغرام' : 'Telegram Bot'}
                    >
                      <Send className="w-3.5 h-3.5 -rotate-45" />
                      <span>{isAr ? 'بوت Telegram' : 'Telegram'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'match' && (
              <MatchingView
                lang={lang}
                onGoToChat={() => setActiveTab('chats')}
              />
            )}

            {activeTab === 'chats' && <ChatsView lang={lang} />}

            {activeTab === 'account' && (
              <AccountView
                lang={lang}
                walletBalance={walletBalance}
                onOpenWallet={() => setIsWalletOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                auth={auth}
                onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
                birthDate={birthDate}
                gender={gender}
                onOpenEditProfile={() => setIsEditingProfile(true)}
              />
            )}
          </>
        )}
      </main>

      {/* البار السفلي / Bottom Navigation Bar */}
      <BottomNav
        activeTab={isWalletOpen || isSettingsOpen ? 'account' : activeTab}
        onChangeTab={(tab) => {
          setIsWalletOpen(false);
          setIsSettingsOpen(false);
          setActiveTab(tab);
        }}
        lang={lang}
      />

      {/* Modal: ربط وضبط بوت Telegram و Web App */}
      <TelegramBotModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        lang={lang}
        auth={auth}
      />

      {/* Modal: طلب تاريخ الميلاد والجنس عند الدخول الأول للمستخدم الجديد أو تعديلهما */}
      <OnboardingModal
        isOpen={isOnboardingOpen || isEditingProfile}
        isFirstLogin={!isEditingProfile && isOnboardingOpen}
        onClose={isEditingProfile ? () => setIsEditingProfile(false) : undefined}
        onComplete={handleCompleteOnboarding}
        lang={lang}
        telegramUser={auth.telegramUser}
        initialBirthDate={birthDate}
        initialGender={gender}
      />
    </div>
  );
}
