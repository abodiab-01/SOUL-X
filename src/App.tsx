import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { BottomNav, TabType } from './components/BottomNav';
import { AccountView } from './components/AccountView';
import { ChatsView } from './components/ChatsView';
import { MatchingView } from './components/MatchingView';
import { HomeView } from './components/HomeView';
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
import {
  getStoredAuthToken,
  getStoredRefreshToken,
  storeAuthTokens,
  saveAccountToStorage,
  clearCurrentSession,
  performTokenRefresh,
} from './lib/authStorage';

export default function App() {
  const [lang, setLang] = useState<Language>('ar');
  const [theme, setTheme] = useState<Theme>('dark');
  const [activeTab, setActiveTab] = useState<TabType>('home');
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

  // Authenticated user via Email & verified session Token (initialized synchronously to avoid any splash/landing delay)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soulx_auth_user');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {}
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
      return localStorage.getItem('soulx_gender') as Gender | null;
    }
    return null;
  });

  // Telegram container hook for viewport / tunnel status
  const auth = useTelegramAuth((newLang) => setLang(newLang));

  // 1. Verify user authentication via token or 30-day refresh token on startup
  useEffect(() => {
    let isMounted = true;
    const token = getStoredAuthToken();
    const refreshToken = getStoredRefreshToken();

    if (!token && !refreshToken) {
      // No token present -> Not authenticated -> Show login modal
      setCurrentUser(null);
      setBirthDate(null);
      setGender(null);
      return;
    }

    // Verify token with backend session endpoint, providing refresh token for automatic sliding extension
    fetch('/api/auth/verify', {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
      },
    })
      .then((res) => res.json())
      .then(async (data) => {
        if (!isMounted) return;
        if (data.success && data.user) {
          setCurrentUser(data.user);
          if (data.token) {
            storeAuthTokens(
              data.token,
              data.refreshToken || refreshToken || undefined,
              data.expiresAt,
              data.refreshExpiresAt
            );
          }
          saveAccountToStorage(data.user, {
            token: data.token || token || undefined,
            refreshToken: data.refreshToken || refreshToken || undefined,
            refreshExpiresAt: data.refreshExpiresAt,
          });
          if (typeof window !== 'undefined') {
            localStorage.setItem('soulx_auth_user', JSON.stringify(data.user));
          }
          if (data.user.birthDate) {
            setBirthDate(data.user.birthDate);
            if (typeof window !== 'undefined') localStorage.setItem('soulx_birth_date', data.user.birthDate);
          }
          if (data.user.gender) {
            setGender(data.user.gender);
            if (typeof window !== 'undefined') localStorage.setItem('soulx_gender', data.user.gender);
          }
          if (typeof data.user.walletBalance === 'number') {
            setWalletBalance(data.user.walletBalance);
            if (typeof window !== 'undefined') localStorage.setItem('soulx_wallet_balance', data.user.walletBalance.toString());
          }
          if (data.isAdmin) {
            setAdminToken(data.token || token);
            if (typeof window !== 'undefined') sessionStorage.setItem('soulx_admin_token', data.token || token);
          }
        } else if (refreshToken) {
          // Token invalid/expired -> Attempt 30-day token refresh
          const refResult = await performTokenRefresh(refreshToken);
          if (!isMounted) return;
          if (refResult.success && refResult.user) {
            setCurrentUser(refResult.user);
            if (refResult.user.birthDate) setBirthDate(refResult.user.birthDate);
            if (refResult.user.gender) setGender(refResult.user.gender);
            if (typeof refResult.user.walletBalance === 'number') setWalletBalance(refResult.user.walletBalance);
            if (refResult.isAdmin && refResult.token) setAdminToken(refResult.token);
          } else {
            wipeLocalSession();
          }
        } else {
          wipeLocalSession();
        }
      })
      .catch(async () => {
        if (!isMounted) return;
        // On network error, attempt cached 30-day token refresh or offline fallback
        if (refreshToken) {
          try {
            const refResult = await performTokenRefresh(refreshToken);
            if (isMounted && refResult.success && refResult.user) {
              setCurrentUser(refResult.user);
              return;
            }
          } catch {}
        }
        const saved = typeof window !== 'undefined' ? localStorage.getItem('soulx_auth_user') : null;
        if (saved) {
          try {
            setCurrentUser(JSON.parse(saved));
            const b = localStorage.getItem('soulx_birth_date');
            const g = localStorage.getItem('soulx_gender') as Gender;
            if (b) setBirthDate(b);
            if (g) setGender(g);
          } catch {
            wipeLocalSession();
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 1.1 Silent background session refresher: refresh token every 6 hours to keep the 30-day window active
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      const rf = getStoredRefreshToken();
      if (rf) {
        performTokenRefresh(rf).catch(() => {});
      }
    }, 6 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, [currentUser]);

  const wipeLocalSession = () => {
    setCurrentUser(null);
    setBirthDate(null);
    setGender(null);
    setAdminToken(null);
    clearCurrentSession(true); // Preserve saved accounts list for easy 1-click re-entry!
  };

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
      saveAccountToStorage(updatedUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('soulx_auth_user', JSON.stringify(updatedUser));
      }

      // Sync with backend
      const authToken = getStoredAuthToken();
      fetch('/api/auth/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
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

  // 2. Full logout: Invalidate token on server, clear session tokens, but save account details for 1-click easy re-entry
  const handleLogout = async (purgeAllSavedAccounts = false) => {
    const token = getStoredAuthToken();
    const refreshToken = getStoredRefreshToken();

    // A. Inform backend to delete/revoke the session tokens
    if (token || refreshToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
          },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Proceed with client purge
      }
    }

    // B. Clear Telegram session
    auth.logoutTelegram();

    // C. Wipe session while preserving saved accounts for easy re-entry unless requested
    clearCurrentSession(!purgeAllSavedAccounts);

    // D. Reset all React states and return to the initial starting screen
    setCurrentUser(null);
    setBirthDate(null);
    setGender(null);
    setAdminToken(null);
    setIsAdminPanelOpen(false);
    setIsAdminPinModalOpen(false);
    setIsWalletOpen(false);
    setIsSettingsOpen(false);
    setIsTelegramModalOpen(false);
    setIsOnboardingOpen(false);
    setIsEditingProfile(false);
    setActiveTab('home');
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

  // Persistent coins balance (starts at 25,000 coins)
  const [coinsBalance, setCoinsBalance] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soulx_coins_balance');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return 25000;
  });

  // Track initial tab when opening wallet ('diamonds' | 'coins') - Coins is the primary currency
  const [walletInitialTab, setWalletInitialTab] = useState<'diamonds' | 'coins'>('coins');

  const handleUpdateCoins = (amount: number) => {
    setCoinsBalance((prev) => {
      const next = Math.max(0, prev + amount);
      if (typeof window !== 'undefined') {
        localStorage.setItem('soulx_coins_balance', next.toString());
      }
      return next;
    });
  };

  const handleRecharge = (amount: number) => {
    setWalletBalance((prev) => {
      const next = prev + amount;
      if (typeof window !== 'undefined') {
        localStorage.setItem('soulx_wallet_balance', next.toString());
      }
      if (currentUser) {
        setCurrentUser((u) => (u ? { ...u, walletBalance: next } : null));
        fetch('/api/wallet/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            displayId: currentUser.displayId,
            email: currentUser.email,
            balance: next,
          }),
        }).catch(() => {});
      }
      return next;
    });
  };

  const handleWithdraw = (amount: number) => {
    setWalletBalance((prev) => {
      const next = Math.max(0, prev - amount);
      if (typeof window !== 'undefined') {
        localStorage.setItem('soulx_wallet_balance', next.toString());
      }
      if (currentUser) {
        setCurrentUser((u) => (u ? { ...u, walletBalance: next } : null));
        fetch('/api/wallet/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            displayId: currentUser.displayId,
            email: currentUser.email,
            balance: next,
          }),
        }).catch(() => {});
      }
      return next;
    });
  };

  // Sync real wallet balance directly from backend database
  useEffect(() => {
    if (!currentUser) return;
    const lookupParam = currentUser.id || currentUser.email || '';
    if (!lookupParam) return;
    fetch(`/api/wallet/balance?userId=${encodeURIComponent(currentUser.id)}&email=${encodeURIComponent(currentUser.email || '')}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && typeof data.balance === 'number') {
          setWalletBalance(data.balance);
          setCurrentUser((prev) => (prev ? { ...prev, walletBalance: data.balance } : null));
          if (typeof window !== 'undefined') {
            localStorage.setItem('soulx_wallet_balance', data.balance.toString());
          }
        }
      })
      .catch(() => {});
  }, [currentUser?.id, currentUser?.email]);

  // Listen to real-time balance updates dispatched from Admin Panel or Wallet actions
  useEffect(() => {
    const handleBalanceUpdated = (event: any) => {
      const detail = event?.detail;
      if (!detail || typeof detail.balance !== 'number') return;
      const isMatch =
        !detail.userId ||
        !currentUser ||
        detail.userId === currentUser.id ||
        (currentUser.displayId && detail.displayId === currentUser.displayId) ||
        (currentUser.email && detail.email && detail.email.toLowerCase() === currentUser.email.toLowerCase());

      if (isMatch) {
        if (detail.currency === 'coins') {
          setCoinsBalance(detail.balance);
          if (typeof window !== 'undefined') {
            localStorage.setItem('soulx_coins_balance', detail.balance.toString());
          }
          setCurrentUser((prev) => (prev ? { ...prev, coinsBalance: detail.balance } : null));
        } else {
          setWalletBalance(detail.balance);
          if (typeof window !== 'undefined') {
            localStorage.setItem('soulx_wallet_balance', detail.balance.toString());
          }
          setCurrentUser((prev) => (prev ? { ...prev, walletBalance: detail.balance } : null));
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('soulx:balance-updated', handleBalanceUpdated);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('soulx:balance-updated', handleBalanceUpdated);
      }
    };
  }, [currentUser]);

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
        coinsBalance={coinsBalance}
        currentUser={currentUser}
        onOpenAdmin={handleOpenAdmin}
        onOpenWallet={(tab) => {
          setIsSettingsOpen(false);
          setIsAdminPanelOpen(false);
          setWalletInitialTab(tab || 'diamonds');
          setIsWalletOpen(true);
        }}
        onBrandClick={() => {
          setIsWalletOpen(false);
          setIsSettingsOpen(false);
          setIsAdminPanelOpen(false);
          setActiveTab('home');
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
          isAccountTab || isWalletOpen || isSettingsOpen || isAdminPanelOpen || activeTab === 'chats'
            ? 'w-full px-0 pt-0 pb-20 items-stretch justify-start'
            : 'items-center justify-start px-2 sm:px-6 pb-24 pt-4'
        }`}
      >
        {isWalletOpen ? (
          /* شاشة المحفظة كصفحة منفصلة ملء الشاشة مع تبويبي Diamonds و Coins */
          <WalletView
            lang={lang}
            walletBalance={walletBalance}
            coinsBalance={coinsBalance}
            initialTab={walletInitialTab}
            onRecharge={handleRecharge}
            onWithdraw={handleWithdraw}
            onUpdateCoins={handleUpdateCoins}
            onBack={() => setIsWalletOpen(false)}
            currentUser={currentUser}
          />
        ) : isSettingsOpen ? (
          /* شاشة الإعدادات كصفحة منفصلة ملء الشاشة مع زر عودة */
          <SettingsView
            lang={lang}
            setLang={setLang}
            theme={theme}
            setTheme={setTheme}
            onBack={() => setIsSettingsOpen(false)}
            onLogout={handleLogout}
            currentUser={currentUser}
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
              <HomeView
                lang={lang}
                currentUser={currentUser}
                onNavigateToTab={(tab) => {
                  setIsWalletOpen(false);
                  setIsSettingsOpen(false);
                  setIsAdminPanelOpen(false);
                  setActiveTab(tab);
                }}
                onGoToChat={(friendName) => {
                  setIsWalletOpen(false);
                  setIsSettingsOpen(false);
                  setIsAdminPanelOpen(false);
                  setActiveTab('chats');
                }}
                onOpenWallet={() => {
                  setIsSettingsOpen(false);
                  setIsAdminPanelOpen(false);
                  setWalletInitialTab('coins');
                  setIsWalletOpen(true);
                }}
              />
            )}

            {activeTab === 'match' && (
              <MatchingView
                lang={lang}
                onGoToChat={() => setActiveTab('chats')}
                currentUser={currentUser}
                walletBalance={walletBalance}
                onDeductDiamonds={handleWithdraw}
                onOpenWallet={() => {
                  setWalletInitialTab('coins');
                  setIsWalletOpen(true);
                }}
              />
            )}

            {activeTab === 'chats' && (
              <ChatsView
                lang={lang}
                currentUser={currentUser}
                walletBalance={walletBalance}
                onDeductDiamonds={handleWithdraw}
                onOpenWallet={() => {
                  setWalletInitialTab('coins');
                  setIsWalletOpen(true);
                }}
              />
            )}

            {activeTab === 'account' && (
              <AccountView
                lang={lang}
                walletBalance={walletBalance}
                coinsBalance={coinsBalance}
                onOpenWallet={(tab) => {
                  setWalletInitialTab(tab || 'coins');
                  setIsWalletOpen(true);
                }}
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
        currentUser={currentUser}
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
