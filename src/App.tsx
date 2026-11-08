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
import { FriendSearchModal } from './components/FriendSearchModal';
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
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soulx_lang');
      if (saved === 'ar' || saved === 'en') return saved;
    }
    return 'ar';
  });
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soulx_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    }
    return 'light'; // الوضع الافتراضي هو الفاتح
  });
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [unreadChatsCount, setUnreadChatsCount] = useState(0);
  const [incomingMessageToast, setIncomingMessageToast] = useState<{
    senderName: string;
    senderAvatar: string;
    text: string;
    conversationId?: string;
  } | null>(null);

  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isInsideActiveChat, setIsInsideActiveChat] = useState(false);

  // Reset active chat view state when switching tabs
  useEffect(() => {
    if (activeTab !== 'chats') {
      setIsInsideActiveChat(false);
    }
  }, [activeTab]);

  // Listen for active chat changes from ChatsView
  useEffect(() => {
    const handleActiveChat = (e: any) => {
      if (activeTab === 'chats') {
        setIsInsideActiveChat(Boolean(e.detail?.isActive));
      }
    };
    window.addEventListener('soulx:active-chat-changed', handleActiveChat);
    return () => window.removeEventListener('soulx:active-chat-changed', handleActiveChat);
  }, [activeTab]);

  // Listen for open search event
  useEffect(() => {
    const handleOpenSearch = () => setIsSearchModalOpen(true);
    window.addEventListener('soulx:open-search', handleOpenSearch);
    return () => window.removeEventListener('soulx:open-search', handleOpenSearch);
  }, []);

  // Listen for profile bio updates
  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      const detail = e.detail;
      if (detail && detail.bio !== undefined) {
        setCurrentUser((prev) => (prev ? { ...prev, bio: detail.bio } : null));
      }
    };
    window.addEventListener('soulx:profile-updated', handleProfileUpdate);
    return () => window.removeEventListener('soulx:profile-updated', handleProfileUpdate);
  }, []);

  // Admin Control Panel states (protected by ADMIN_PIN)
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState(false);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  const handleOpenAdmin = () => {
    // When opening the admin panel, it MUST request the ADMIN_PIN configured in environment variables
    setIsAdminPinModalOpen(true);
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
  const [country, setCountry] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('soulx_country');
    }
    return null;
  });

  // Telegram container hook for viewport / tunnel status (preserves user-selected language)
  const auth = useTelegramAuth((newLang) => {
    if (typeof window !== 'undefined' && !localStorage.getItem('soulx_lang')) {
      setLang(newLang);
    }
  });

  // 1. Verify user authentication via token or 30-day refresh token on startup
  useEffect(() => {
    let isMounted = true;
    const token = getStoredAuthToken();
    const refreshToken = getStoredRefreshToken();
    const cachedUser = (() => {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('soulx_auth_user') : null;
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    if (!token && !refreshToken && !cachedUser) {
      // No token present -> Not authenticated -> Show login modal
      setCurrentUser(null);
      setBirthDate(null);
      setGender(null);
      setCountry(null);
      return;
    }

    // Verify token with backend session endpoint, providing refresh token and user hints for automatic sliding extension
    fetch('/api/auth/verify', {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
        ...(cachedUser?.id ? { 'X-User-Id': cachedUser.id } : {}),
        ...(cachedUser?.email ? { 'X-User-Email': cachedUser.email } : {}),
      },
    })
      .then((res) => res.json())
      .then(async (data) => {
        if (!isMounted) return;
        if (data.success && data.user) {
          const userWithAdmin: AuthUser = {
            ...data.user,
            isAdmin: Boolean(data.isAdmin ?? data.user.isAdmin),
          };
          setCurrentUser(userWithAdmin);
          if (data.token) {
            storeAuthTokens(
              data.token,
              data.refreshToken || refreshToken || undefined,
              data.expiresAt,
              data.refreshExpiresAt
            );
          }
          saveAccountToStorage(userWithAdmin, {
            token: data.token || token || undefined,
            refreshToken: data.refreshToken || refreshToken || undefined,
            refreshExpiresAt: data.refreshExpiresAt,
          });
          if (typeof window !== 'undefined') {
            localStorage.setItem('soulx_auth_user', JSON.stringify(userWithAdmin));
          }
          if (data.user.birthDate) {
            setBirthDate(data.user.birthDate);
            if (typeof window !== 'undefined') localStorage.setItem('soulx_birth_date', data.user.birthDate);
          }
          if (data.user.gender) {
            setGender(data.user.gender);
            if (typeof window !== 'undefined') localStorage.setItem('soulx_gender', data.user.gender);
          }
          if (data.user.country) {
            setCountry(data.user.country);
            if (typeof window !== 'undefined') localStorage.setItem('soulx_country', data.user.country);
          }
          if (typeof data.user.walletBalance === 'number') {
            setWalletBalance(data.user.walletBalance);
            if (typeof window !== 'undefined') localStorage.setItem('soulx_wallet_balance', data.user.walletBalance.toString());
          }
          if (typeof data.user.coinsBalance === 'number') {
            setCoinsBalance(data.user.coinsBalance);
            if (typeof window !== 'undefined') localStorage.setItem('soulx_coins_balance', data.user.coinsBalance.toString());
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
            const userWithAdmin: AuthUser = {
              ...refResult.user,
              isAdmin: Boolean(refResult.isAdmin ?? refResult.user.isAdmin),
            };
            setCurrentUser(userWithAdmin);
            if (refResult.user.birthDate) setBirthDate(refResult.user.birthDate);
            if (refResult.user.gender) setGender(refResult.user.gender);
            if (refResult.user.country) setCountry(refResult.user.country);
            if (typeof refResult.user.walletBalance === 'number') setWalletBalance(refResult.user.walletBalance);
            if (typeof refResult.user.coinsBalance === 'number') setCoinsBalance(refResult.user.coinsBalance);
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
              if (refResult.user.country) setCountry(refResult.user.country);
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
            const c = localStorage.getItem('soulx_country');
            if (b) setBirthDate(b);
            if (g) setGender(g);
            if (c) setCountry(c);
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

  // Listen for real-time profile picture/avatar updates across tabs
  useEffect(() => {
    const handleProfileUpdated = (e: any) => {
      const updated = e.detail?.user;
      if (updated) {
        setCurrentUser((prev) => (prev ? { ...prev, ...updated } : updated));
      }
    };
    window.addEventListener('soulx:user-profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('soulx:user-profile-updated', handleProfileUpdated);
  }, []);

  // Listen for real-time incoming chat messages to show instant notification banner & update unread badge
  useEffect(() => {
    const handleChatUpdated = (event: any) => {
      const data = event.detail;
      if (!data) return;

      const myId = currentUser?.id;
      const myDisplayId = currentUser?.displayId;
      const isSenderMe = (myId && data.senderId === myId) || (myDisplayId && data.senderId === myDisplayId);

      if (!isSenderMe && data.sender) {
        setUnreadChatsCount((prev) => prev + 1);

        if (activeTab !== 'chats') {
          setIncomingMessageToast({
            senderName: data.sender.name || (lang === 'ar' ? 'صديق' : 'Friend'),
            senderAvatar: data.sender.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            text: data.message?.text || '',
            conversationId: data.conversationId,
          });

          setTimeout(() => {
            setIncomingMessageToast((cur) => (cur?.text === data.message?.text ? null : cur));
          }, 5000);
        }
      }
    };

    const handleChatRead = (event: any) => {
      const convId = event.detail?.conversationId;
      if (incomingMessageToast && (!convId || incomingMessageToast.conversationId === convId)) {
        setIncomingMessageToast(null);
      }
      setUnreadChatsCount((prev) => Math.max(0, prev - 1));
    };

    const handleUserNotification = (event: any) => {
      const notif = event.detail;
      if (!notif) return;
      setUnreadChatsCount((prev) => prev + 1);

      if (activeTab !== 'chats') {
        const isBroadcast = notif.type === 'admin_broadcast';
        const isAdmin = notif.type === 'admin_message';
        const senderName = isBroadcast
          ? (lang === 'ar' ? '📢 إذاعة عامة (Soul-X)' : '📢 Public Broadcast (Soul-X)')
          : isAdmin
          ? (lang === 'ar' ? '🛡️ رسالة إدارية (Soul-X)' : '🛡️ Admin Notice (Soul-X)')
          : (lang === 'ar' ? '🔔 مركز الإشعارات' : '🔔 Notification Center');

        const toastText =
          (lang === 'ar' ? notif.titleAr : notif.titleEn) ||
          notif.messageAr ||
          notif.messageEn ||
          '';

        setIncomingMessageToast({
          senderName,
          senderAvatar:
            notif.metadata?.friendAvatar ||
            'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
          text: toastText,
          conversationId: 'official-notifications',
        });

        setTimeout(() => {
          setIncomingMessageToast((cur) =>
            cur?.conversationId === 'official-notifications' ? null : cur
          );
        }, 6000);
      }
    };

    window.addEventListener('soulx_chat_updated', handleChatUpdated);
    window.addEventListener('soulx:chat-read', handleChatRead);
    window.addEventListener('soulx_user_notification_received', handleUserNotification);
    return () => {
      window.removeEventListener('soulx_chat_updated', handleChatUpdated);
      window.removeEventListener('soulx:chat-read', handleChatRead);
      window.removeEventListener('soulx_user_notification_received', handleUserNotification);
    };
  }, [currentUser, activeTab, lang, incomingMessageToast]);

  // When opening chats tab, reset notification toast and badge
  useEffect(() => {
    if (activeTab === 'chats') {
      setIncomingMessageToast(null);
      setUnreadChatsCount(0);
    }
  }, [activeTab]);

  const wipeLocalSession = () => {
    setCurrentUser(null);
    setBirthDate(null);
    setGender(null);
    setCountry(null);
    if (typeof window !== 'undefined') localStorage.removeItem('soulx_country');
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

  // Persistent wallet balance (starts at 0 diamonds)
  const [walletBalance, setWalletBalance] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soulx_wallet_balance');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return 0;
  });

  // Persistent coins balance (starts at 0 coins)
  const [coinsBalance, setCoinsBalance] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soulx_coins_balance');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return 0;
  });

  // Track initial tab when opening wallet ('diamonds' | 'coins') - Coins is the primary currency
  const [walletInitialTab, setWalletInitialTab] = useState<'diamonds' | 'coins'>('coins');

  const handleUpdateCoins = (amount: number) => {
    setCoinsBalance((prev) => {
      const next = Math.max(0, prev + amount);
      if (typeof window !== 'undefined') {
        localStorage.setItem('soulx_coins_balance', next.toString());
      }
      if (currentUser) {
        setCurrentUser((u) => (u ? { ...u, coinsBalance: next } : null));
        fetch('/api/coins/update', {
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

  const handleDeductCoins = (amount: number) => {
    setCoinsBalance((prev) => {
      const next = Math.max(0, prev - amount);
      if (typeof window !== 'undefined') {
        localStorage.setItem('soulx_coins_balance', next.toString());
      }
      if (currentUser) {
        setCurrentUser((u) => (u ? { ...u, coinsBalance: next } : null));
        fetch('/api/coins/update', {
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

  // Synchronize document dir and lang attributes + persist to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('soulx_lang', lang);
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Synchronize dark mode class + persist to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('soulx_theme', theme);
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const isAccountTab = activeTab === 'account';


  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors flex flex-col selection:bg-cyan-500/20 selection:text-cyan-400">
      {/* البار العلوي / Top Bar */}
      <Navbar
        lang={lang}
        walletBalance={walletBalance}
        coinsBalance={coinsBalance}
        activeTab={activeTab}
        title={
          isWalletOpen
            ? (isAr ? 'المحفظة' : 'Wallet')
            : isSettingsOpen
            ? (isAr ? 'الإعدادات' : 'Settings')
            : isAdminPanelOpen
            ? (isAr ? 'لوحة الإدارة' : 'Admin Panel')
            : activeTab === 'home'
            ? (isAr ? 'الرئيسية' : 'Home')
            : activeTab === 'match'
            ? (isAr ? 'المطابقة' : 'Match')
            : activeTab === 'chats'
            ? (isAr ? 'الدردشات' : 'Chats')
            : activeTab === 'account'
            ? (isAr ? 'حسابي' : 'Account')
            : null
        }
        currentUser={currentUser}
        onOpenSettings={() => {
          setIsWalletOpen(false);
          setIsAdminPanelOpen(false);
          setIsSettingsOpen(true);
        }}
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
        onBack={
          isWalletOpen
            ? () => setIsWalletOpen(false)
            : isSettingsOpen
            ? () => setIsSettingsOpen(false)
            : isAdminPanelOpen
            ? handleAdminLock
            : null
        }
        backLabel={
          isWalletOpen
            ? (isAr ? 'العودة' : 'Back')
            : isSettingsOpen
            ? (isAr ? 'العودة للملف' : 'Back to Profile')
            : isAdminPanelOpen
            ? (isAr ? 'العودة' : 'Back')
            : null
        }
        onOpenSearch={
          activeTab === 'home' && !isWalletOpen && !isSettingsOpen && !isAdminPanelOpen
            ? () => setIsSearchModalOpen(true)
            : null
        }
        onOpenFriends={
          activeTab === 'chats' && !isWalletOpen && !isSettingsOpen && !isAdminPanelOpen && !isInsideActiveChat
            ? () => window.dispatchEvent(new CustomEvent('soulx:open-friends'))
            : null
        }
      />

      {/* المحتوى الرئيسي حسب التبويب أو شاشة المحفظة / الإعدادات / لوحة الإدارة ملء الشاشة */}
      <main
        className={`flex-1 flex flex-col min-w-0 max-w-full overflow-x-hidden ${
          activeTab === 'chats'
            ? 'w-full px-0 pt-0 pb-0 items-stretch justify-start'
            : isAccountTab || isWalletOpen || isSettingsOpen || isAdminPanelOpen
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
            onBack={handleAdminLock}
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
                onOpenSearch={() => setIsSearchModalOpen(true)}
              />
            )}

            {activeTab === 'match' && (
              <MatchingView
                lang={lang}
                onGoToChat={() => setActiveTab('chats')}
                currentUser={currentUser}
                walletBalance={walletBalance}
                coinsBalance={coinsBalance}
                onDeductDiamonds={handleWithdraw}
                onDeductCoins={handleDeductCoins}
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
                coinsBalance={coinsBalance}
                onDeductDiamonds={handleWithdraw}
                onDeductCoins={handleDeductCoins}
                onOpenWallet={() => {
                  setWalletInitialTab('coins');
                  setIsWalletOpen(true);
                }}
                onActiveChatChange={(isActive) => setIsInsideActiveChat(isActive)}
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
                country={country || currentUser?.country}
                onOpenEditProfile={() => setIsEditingProfile(true)}
                currentUser={currentUser}
                onLogout={handleLogout}
                onOpenAdminPanel={handleOpenAdmin}
              />
            )}
          </>
        )}
      </main>

      {/* إشعار رسالة واردة فورية عند التواجد في صفحة أخرى */}
      {incomingMessageToast && activeTab !== 'chats' && (
        <div
          onClick={() => {
            if (incomingMessageToast.conversationId) {
              if (typeof window !== 'undefined') {
                localStorage.setItem('soulx_open_conversation_id', incomingMessageToast.conversationId);
                window.dispatchEvent(
                  new CustomEvent('soulx:open-conversation', {
                    detail: { conversationId: incomingMessageToast.conversationId },
                  })
                );
              }
            }
            setActiveTab('chats');
            setIncomingMessageToast(null);
            setUnreadChatsCount(0);
          }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md z-[100] p-4 rounded-3xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-2 border-cyan-500 shadow-2xl shadow-cyan-500/30 flex items-center gap-3 cursor-pointer hover:scale-[1.02] transition-transform animate-in fade-in zoom-in-95 duration-300"
        >
          <img
            src={incomingMessageToast.senderAvatar}
            alt={incomingMessageToast.senderName}
            className="w-10 h-10 rounded-full object-cover border border-cyan-500/40 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate">
                {incomingMessageToast.senderName}
              </h4>
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold">
                {incomingMessageToast.conversationId === 'official-notifications'
                  ? (lang === 'ar' ? 'إشعار رسمي 📢' : 'Official Notice 📢')
                  : (lang === 'ar' ? 'رسالة جديدة ✨' : 'New Message ✨')}
              </span>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-300 truncate mt-0.5">
              {incomingMessageToast.text}
            </p>
          </div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-xl bg-cyan-400 text-neutral-950 font-bold text-xs shrink-0 cursor-pointer shadow-xs active:scale-95"
          >
            {lang === 'ar' ? 'عرض' : 'View'}
          </button>
        </div>
      )}

      {/* البار السفلي / Bottom Navigation Bar - يُخفى تلقائياً عند الدخول في محادثة نشطة لإظهار صندوق إدخال الرسائل بالكامل */}
      {!(activeTab === 'chats' && isInsideActiveChat) && (
        <BottomNav
          activeTab={
            isWalletOpen || isSettingsOpen || isAdminPanelOpen ? 'account' : activeTab
          }
          onChangeTab={(tab) => {
            setIsWalletOpen(false);
            setIsSettingsOpen(false);
            setIsAdminPanelOpen(false);
            setIsInsideActiveChat(false);
            setActiveTab(tab);
          }}
          lang={lang}
          unreadChatsCount={unreadChatsCount}
        />
      )}

      {/* نافذة تسجيل الدخول أو إنشاء الحساب بالبريد الإلكتروني عند الدخول */}
      <EmailAuthModal
        isOpen={!currentUser}
        lang={lang}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        onToggleLang={() => setLang((prev) => (prev === 'ar' ? 'en' : 'ar'))}
        onSuccess={(user) => {
          setCurrentUser(user);
          if (typeof window !== 'undefined') {
            localStorage.setItem('soulx_auth_user', JSON.stringify(user));
          }
          const initialDiamonds = typeof user.walletBalance === 'number' ? user.walletBalance : 0;
          const initialCoins = typeof user.coinsBalance === 'number' ? user.coinsBalance : 0;
          setWalletBalance(initialDiamonds);
          setCoinsBalance(initialCoins);
          if (typeof window !== 'undefined') {
            localStorage.setItem('soulx_wallet_balance', initialDiamonds.toString());
            localStorage.setItem('soulx_coins_balance', initialCoins.toString());
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

      {/* Modal: البحث عن صديق بالمعرف أو مسح رمز باركود */}
      <FriendSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        lang={lang}
        onNavigateToChats={(user) => {
          setIsSearchModalOpen(false);
          const targetId = typeof user === 'string' ? user : user?.id;
          if (targetId && typeof window !== 'undefined') {
            localStorage.setItem('soulx_open_conversation_id', targetId);
            window.dispatchEvent(
              new CustomEvent('soulx:open-conversation', { detail: { conversationId: targetId } })
            );
          }
          setActiveTab('chats');
        }}
      />
    </div>
  );
}
