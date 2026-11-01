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
import { EmailAuthModal } from './components/EmailAuthModal';
import { AdminPinModal } from './components/AdminPinModal';
import { AdminPanelView } from './components/AdminPanelView';
import { useTelegramAuth } from './hooks/useTelegramAuth';
import { Language, Theme, Gender, AuthUser } from './types';
import { Send, Sparkles, Mail } from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [theme, setTheme] = useState<Theme>('dark');
  const [activeTab, setActiveTab] = useState<TabType>('match');
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Admin Control Panel states (protected by ADMIN_PIN)
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('soulx_admin_token');
    }
    return null;
  });

  const handleOpenAdmin = () => {
    if (adminToken) {
      setIsAdminPanelOpen(true);
    } else {
      setIsAdminPinModalOpen(true);
    }
  };

  const handleAdminPinSuccess = (token: string) => {
    setAdminToken(token);
    setIsAdminPinModalOpen(false);
    setIsAdminPanelOpen(true);
  };

  const handleAdminLock = () => {
    setAdminToken(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('soulx_admin_token');
    }
    setIsAdminPanelOpen(false);
  };

  // Authenticated user via Email
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soulx_auth_user');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore parse error
        }
      }
    }
    return null;
  });

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

  // Telegram container hook for viewport / tunnel status
  const auth = useTelegramAuth((newLang) => setLang(newLang));

  // Determine if onboarding is needed for newly logged-in user
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (currentUser) {
      if (!birthDate || !gender) {
        setIsOnboardingOpen(true);
      }
    }
  }, [currentUser, birthDate, gender]);

  const handleCompleteOnboarding = (data: { birthDate: string; gender: Gender }) => {
    setBirthDate(data.birthDate);
    setGender(data.gender);
    if (typeof window !== 'undefined') {
      localStorage.setItem('soulx_birth_date', data.birthDate);
      localStorage.setItem('soulx_gender', data.gender);
      localStorage.setItem('soulx_onboarding_completed', 'true');
    }

    if (currentUser) {
      const updatedUser: AuthUser = {
        ...currentUser,
        birthDate: data.birthDate,
        gender: data.gender,
      };
      setCurrentUser(updatedUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('soulx_auth_user', JSON.stringify(updatedUser));
      }

      // Sync with backend
      fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          birthDate: data.birthDate,
          gender: data.gender,
        }),
      }).catch(() => {});
    }

    setIsOnboardingOpen(false);
    setIsEditingProfile(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setBirthDate(null);
    setGender(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('soulx_auth_user');
      localStorage.removeItem('soulx_birth_date');
      localStorage.removeItem('soulx_gender');
      localStorage.removeItem('soulx_onboarding_completed');
    }
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
          setIsAdminPanelOpen(false);
          setIsWalletOpen(true);
        }}
        onBrandClick={() => {
          setIsWalletOpen(false);
          setIsSettingsOpen(false);
          setIsAdminPanelOpen(false);
          setActiveTab('match');
        }}
        onNavigateToChats={() => {
          setIsWalletOpen(false);
          setIsSettingsOpen(false);
          setIsAdminPanelOpen(false);
          setActiveTab('chats');
        }}
      />

      {/* المحتوى الرئيسي حسب التبويب أو شاشة المحفظة / الإعدادات / لوحة الإدارة ملء الشاشة */}
      <main
        className={`flex-1 flex flex-col ${
          isAccountTab || isWalletOpen || isSettingsOpen || isAdminPanelOpen
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
        ) : isAdminPanelOpen ? (
          /* لوحة تحكم الإدارة (محمية بـ ADMIN_PIN ومخصصة لـ ADMIN1 و ADMIN2) */
          <AdminPanelView
            lang={lang}
            currentUser={currentUser}
            adminToken={adminToken || ''}
            onBack={() => setIsAdminPanelOpen(false)}
            onLock={handleAdminLock}
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

                  {/* Logged in User Chip */}
                  {currentUser && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 text-xs font-medium mb-3">
                      <Sparkles className="w-3 h-3 text-cyan-500" />
                      <span>
                        {isAr ? 'مرحباً، ' : 'Welcome, '}
                        {currentUser.name}
                      </span>
                      <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500">
                        ({currentUser.email})
                      </span>
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
                currentUser={currentUser}
                onLogout={handleLogout}
                onOpenAdminPanel={handleOpenAdmin}
              />
            )}
          </>
        )}
      </main>

      {/* البار السفلي / Bottom Navigation Bar */}
      <BottomNav
        activeTab={
          isWalletOpen || isSettingsOpen || isAdminPanelOpen ? 'account' : activeTab
        }
        onChangeTab={(tab) => {
          setIsWalletOpen(false);
          setIsSettingsOpen(false);
          setIsAdminPanelOpen(false);
          setActiveTab(tab);
        }}
        lang={lang}
      />

      {/* نافذة تسجيل الدخول أو إنشاء الحساب بالبريد الإلكتروني عند الدخول */}
      <EmailAuthModal
        isOpen={!currentUser}
        lang={lang}
        onSuccess={(user) => {
          setCurrentUser(user);
          if (typeof window !== 'undefined') {
            localStorage.setItem('soulx_auth_user', JSON.stringify(user));
          }
          if (user.birthDate && user.gender) {
            setBirthDate(user.birthDate);
            setGender(user.gender);
          } else {
            setIsOnboardingOpen(true);
          }
        }}
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

      {/* Modal: التحقق من رمز PIN الإداري للوصول للوحة التحكم */}
      <AdminPinModal
        isOpen={isAdminPinModalOpen}
        onClose={() => setIsAdminPinModalOpen(false)}
        lang={lang}
        currentUser={currentUser}
        onSuccess={handleAdminPinSuccess}
      />
    </div>
  );
}
