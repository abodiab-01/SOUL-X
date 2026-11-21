import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { BottomNav, TabType } from './components/BottomNav';
import { AccountView } from './components/AccountView';
import { ChatsView } from './components/ChatsView';
import { MatchingView } from './components/MatchingView';
import { HomeView } from './components/HomeView';
import { GamesView, ActiveGameId } from './components/GamesView';
import { StoreView } from './components/StoreView';
import { WalletView } from './components/WalletView';
import { SettingsView } from './components/SettingsView';
import { BlockedUsersView } from './components/BlockedUsersView';
import { TelegramBotModal } from './components/TelegramBotModal';
import { OnboardingModal } from './components/OnboardingModal';
import { EmailAuthModal } from './components/EmailAuthModal';
import { AdminPinModal } from './components/AdminPinModal';
import { AdminPanelView } from './components/AdminPanelView';
import { SupremeUnlockModal } from './components/SupremeUnlockModal';
import { SupremeAdminPanelView } from './components/SupremeAdminPanelView';
import { FriendSearchModal } from './components/FriendSearchModal';
import { FriendSearchView } from './components/FriendSearchView';
import { OtherUserProfileModal } from './components/OtherUserProfileModal';
import { AccountRestrictionModal } from './components/AccountRestrictionModal';
import { AdminAccountSwitcherModal, AccountSwitchResult } from './components/AdminAccountSwitcherModal';
import { VerifiedBadge } from './components/VerifiedBadge';
import { RoomsHubView } from './components/rooms/RoomsHubView';
import { VoiceRoomView } from './components/rooms/VoiceRoomView';
import { OpenUserProfilePayload } from './lib/profileModal';
import { useTelegramAuth } from './hooks/useTelegramAuth';
import { Language, Theme, Gender, AuthUser, AccountRestrictionInfo } from './types';
import { Send, Sparkles, Mail } from 'lucide-react';
import {
  getStoredAuthToken,
  getStoredRefreshToken,
  storeAuthTokens,
  saveAccountToStorage,
  clearCurrentSession,
  performTokenRefresh,
  getAdminSwitchOriginToken,
  setAdminSwitchOriginToken,
  clearAdminSwitchOriginToken,
} from './lib/authStorage';
import { initUiAudio, playIncomingMessageChime, playNavClick } from './lib/uiAudio';

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
    senderIsVerified?: boolean;
    text: string;
    conversationId?: string;
  } | null>(null);

  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isGamesOpen, setIsGamesOpen] = useState(false);
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [isRoomsOpen, setIsRoomsOpen] = useState(false);
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [activeRoomInvite, setActiveRoomInvite] = useState<string | null>(null);
  const [activeGame, setActiveGame] = useState<ActiveGameId>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBlockedUsersOpen, setIsBlockedUsersOpen] = useState(false);
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSearchPageOpen, setIsSearchPageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isInsideActiveChat, setIsInsideActiveChat] = useState(false);
  const [inspectedUserProfile, setInspectedUserProfile] = useState<OpenUserProfilePayload | null>(null);
  const [isAdminRefreshing, setIsAdminRefreshing] = useState(false);

  const [activeChatDetail, setActiveChatDetail] = useState<{
    isActive: boolean;
    chatId: string | null;
    partnerId?: string;
    conversationId?: string;
  } | null>(null);

  useEffect(() => {
    initUiAudio();
  }, []);

  // Reset active chat and full-screen search view state when switching tabs
  useEffect(() => {
    if (activeTab !== 'chats' && activeTab !== 'match') {
      setIsInsideActiveChat(false);
      setActiveChatDetail(null);
    }
    if (activeTab !== 'home') {
      setIsSearchPageOpen(false);
      setSearchQuery('');
      setIsScannerOpen(false);
      setIsGamesOpen(false);
      setIsStoreOpen(false);
      setActiveGame(null);
    }
    if (activeTab !== 'rooms') {
      setIsRoomsOpen(false);
      setActiveRoomCode(null);
      setActiveRoomInvite(null);
    }
  }, [activeTab]);

  // Listen for active chat changes from ChatsView and MatchingView
  useEffect(() => {
    const handleActiveChat = (e: any) => {
      const isActive = Boolean(e.detail?.isActive);
      setIsInsideActiveChat(isActive);
      setActiveChatDetail(isActive ? e.detail : null);
    };
    window.addEventListener('soulx:active-chat-changed', handleActiveChat);
    return () => window.removeEventListener('soulx:active-chat-changed', handleActiveChat);
  }, []);


  // Listen for open search event - opens full screen search page
  useEffect(() => {
    const handleOpenSearch = () => {
      setIsSearchPageOpen(true);
      setIsSearchModalOpen(false);
    };
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

  // Listen for equipped avatar frame updates from Store / Bag
  useEffect(() => {
    const handleFrameUpdated = (e: any) => {
      const nextFrameId = e?.detail?.equippedFrameId ?? null;
      setCurrentUser((prev) => {
        if (!prev) return null;
        const updated = { ...prev, equippedFrameId: nextFrameId };
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('soulx_auth_user', JSON.stringify(updated));
          } catch {}
        }
        return updated;
      });
    };
    window.addEventListener('soulx:frame-updated', handleFrameUpdated);
    return () => window.removeEventListener('soulx:frame-updated', handleFrameUpdated);
  }, []);

  // Listen for open other user profile event from anywhere in the app
  useEffect(() => {
    const handleOpenProfile = (e: any) => {
      if (e.detail && (e.detail.id || e.detail.displayId)) {
        setInspectedUserProfile(e.detail);
      }
    };
    window.addEventListener('soulx:open-user-profile', handleOpenProfile);
    return () => window.removeEventListener('soulx:open-user-profile', handleOpenProfile);
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

  // Supreme Admin Panel states (isolated exclusively for ADMIN1)
  const [isSupremePanelOpen, setIsSupremePanelOpen] = useState(false);
  const [isSupremeUnlockOpen, setIsSupremeUnlockOpen] = useState(false);
  const [supremeToken, setSupremeToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('soulx_supreme_token');
    }
    return null;
  });

  // Admin Quick Account Switcher states
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);
  const [adminSwitchOriginToken, setAdminSwitchOriginTokenState] = useState<string | null>(() => {
    return getAdminSwitchOriginToken();
  });

  const handleOpenSupremePanel = () => {
    const existing =
      supremeToken ||
      (typeof window !== 'undefined' ? sessionStorage.getItem('soulx_supreme_token') : null);
    if (existing) {
      setSupremeToken(existing);
      setIsWalletOpen(false);
      setIsGamesOpen(false);
      setIsStoreOpen(false);
      setIsRoomsOpen(false);
      setActiveRoomCode(null);
      setActiveRoomInvite(null);
      setActiveGame(null);
      setIsSettingsOpen(false);
      setIsBlockedUsersOpen(false);
      setIsAdminPanelOpen(false);
      setIsSearchPageOpen(false);
      setIsSupremePanelOpen(true);
    } else {
      setIsSupremeUnlockOpen(true);
    }
  };

  const handleSupremeUnlockSuccess = (token: string) => {
    setSupremeToken(token);
    setIsSupremeUnlockOpen(false);
    setIsWalletOpen(false);
    setIsGamesOpen(false);
    setIsStoreOpen(false);
    setIsRoomsOpen(false);
    setActiveRoomCode(null);
    setActiveRoomInvite(null);
    setActiveGame(null);
    setIsSettingsOpen(false);
    setIsBlockedUsersOpen(false);
    setIsAdminPanelOpen(false);
    setIsSearchPageOpen(false);
    setIsSupremePanelOpen(true);
  };

  const handleSupremeLock = () => {
    const tok = supremeToken;
    if (tok) {
      fetch('/api/supreme/lock', {
        method: 'POST',
        headers: { 'x-supreme-token': tok },
      }).catch(() => {});
    }
    setSupremeToken(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('soulx_supreme_token');
    }
    setIsSupremePanelOpen(false);
    setIsSupremeUnlockOpen(false);
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

  const [sectionsSettings, setSectionsSettings] = useState<{
    gamesEnabled: boolean;
    storeEnabled: boolean;
  }>({
    gamesEnabled: true,
    storeEnabled: true,
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
          checkAccountRestriction(userWithAdmin);
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
            walletBalanceRef.current = data.user.walletBalance;
            setWalletBalance(data.user.walletBalance);
            if (typeof window !== 'undefined') localStorage.setItem('soulx_wallet_balance', data.user.walletBalance.toString());
          }
          if (typeof data.user.coinsBalance === 'number') {
            coinsBalanceRef.current = data.user.coinsBalance;
            setCoinsBalance(data.user.coinsBalance);
            if (typeof window !== 'undefined') localStorage.setItem('soulx_coins_balance', data.user.coinsBalance.toString());
          }
          if (data.isAdmin) {
            setAdminToken(data.token || token);
            if (typeof window !== 'undefined') sessionStorage.setItem('soulx_admin_token', data.token || token);
            clearAdminSwitchOriginToken();
            setAdminSwitchOriginTokenState(null);
          } else {
            const originTok = getAdminSwitchOriginToken();
            if (originTok) {
              fetch('/api/admin-switcher/status', {
                headers: {
                  ...(data.token || token ? { Authorization: `Bearer ${data.token || token}` } : {}),
                  'X-Admin-Switch-Origin': originTok,
                },
              })
                .then((r) => r.json())
                .then((st) => {
                  if (!isMounted) return;
                  if (!st?.eligible) {
                    clearAdminSwitchOriginToken();
                    setAdminSwitchOriginTokenState(null);
                  }
                })
                .catch(() => {});
            }
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
            checkAccountRestriction(userWithAdmin);
            if (refResult.user.birthDate) setBirthDate(refResult.user.birthDate);
            if (refResult.user.gender) setGender(refResult.user.gender);
            if (refResult.user.country) setCountry(refResult.user.country);
            if (typeof refResult.user.walletBalance === 'number') {
              walletBalanceRef.current = refResult.user.walletBalance;
              setWalletBalance(refResult.user.walletBalance);
              if (typeof window !== 'undefined') localStorage.setItem('soulx_wallet_balance', refResult.user.walletBalance.toString());
            }
            if (typeof refResult.user.coinsBalance === 'number') {
              coinsBalanceRef.current = refResult.user.coinsBalance;
              setCoinsBalance(refResult.user.coinsBalance);
              if (typeof window !== 'undefined') localStorage.setItem('soulx_coins_balance', refResult.user.coinsBalance.toString());
            }
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
        setCurrentUser((prev) => {
          if (!prev) return updated;
          const merged = { ...prev, ...updated };
          if ('photoUrl' in updated && !updated.photoUrl) {
            delete merged.photoUrl;
          }
          return merged;
        });
      }
    };
    window.addEventListener('soulx:user-profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('soulx:user-profile-updated', handleProfileUpdated);
  }, []);

  // Fetch real unread messages count on startup/login
  useEffect(() => {
    if (!currentUser?.id && !currentUser?.displayId && !currentUser?.email) return;

    const query = new URLSearchParams({
      userId: currentUser.id || '',
      ...(currentUser.displayId ? { displayId: currentUser.displayId } : {}),
      ...(currentUser.email ? { email: currentUser.email } : {}),
    });

    fetch(`/api/conversations/list?${query.toString()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.conversations)) {
          const totalUnread = data.conversations.reduce(
            (sum: number, c: any) => sum + (c.unreadCount || 0),
            0
          );
          setUnreadChatsCount(totalUnread);
        }
      })
      .catch(() => {});
  }, [currentUser?.id, currentUser?.displayId, currentUser?.email]);

  // Listen for real-time incoming chat messages to show instant notification banner & update unread badge
  useEffect(() => {
    const handleChatUpdated = (event: any) => {
      const data = event.detail;
      if (!data) return;

      const myId = currentUser?.id;
      const myDisplayId = currentUser?.displayId;
      const isSenderMe = (myId && data.senderId === myId) || (myDisplayId && data.senderId === myDisplayId);
      if (isSenderMe) return;

      playIncomingMessageChime();

      // فحص ما إذا كان المستخدم حالياً داخل مراسلة هذا الشخص بالذات
      const isCurrentlyViewingThisChat = Boolean(
        data.isCurrentActive ||
        (
          activeTab === 'chats' &&
          isInsideActiveChat &&
          activeChatDetail &&
          (
            (data.conversationId && (activeChatDetail.chatId === data.conversationId || activeChatDetail.conversationId === data.conversationId)) ||
            (data.senderId && (activeChatDetail.chatId === data.senderId || activeChatDetail.partnerId === data.senderId)) ||
            (data.sender?.id && (activeChatDetail.chatId === data.sender.id || activeChatDetail.partnerId === data.sender.id)) ||
            (data.sender?.displayId && (activeChatDetail.chatId === data.sender.displayId || activeChatDetail.partnerId === data.sender.displayId))
          )
        )
      );

      // إذا كان المستخدم حالياً داخل مراسلة هذا الشخص: لا تقم بزيادة عداد الرسائل في الدردشات!
      if (isCurrentlyViewingThisChat) {
        return;
      }

      // زيادة العداد فقط للرسائل غير المقروءة الواردة من محادثات أخرى لم يفتحها المستخدم
      setUnreadChatsCount((prev) => prev + 1);

      if (activeTab !== 'chats') {
        setIncomingMessageToast({
          senderName: data.sender?.name || (lang === 'ar' ? 'صديق' : 'Friend'),
          senderAvatar: data.sender?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
          senderIsVerified: Boolean(data.sender?.isVerified),
          text: data.message?.text || '',
          conversationId: data.conversationId,
        });

        setTimeout(() => {
          setIncomingMessageToast((cur) => (cur?.text === data.message?.text ? null : cur));
        }, 5000);
      }
    };

    const handleChatRead = (event: any) => {
      const convId = event.detail?.conversationId;
      if (incomingMessageToast && (!convId || incomingMessageToast.conversationId === convId)) {
        setIncomingMessageToast(null);
      }
      const cleared = typeof event.detail?.unreadCleared === 'number' ? event.detail.unreadCleared : 1;
      setUnreadChatsCount((prev) => Math.max(0, prev - cleared));
    };

    const handleUnreadCountSync = (event: any) => {
      if (typeof event.detail?.unreadCount === 'number') {
        setUnreadChatsCount(event.detail.unreadCount);
      }
    };

    const handleUserNotification = (event: any) => {
      const notif = event.detail;
      if (!notif) return;
      playIncomingMessageChime();
      setUnreadChatsCount((prev) => prev + 1);

      if (activeTab !== 'chats') {
        const isBroadcast = notif.type === 'admin_broadcast';
        const isAdmin = notif.type === 'admin_message';
        const senderName = lang === 'ar' ? 'مركز الإشعارات' : 'Notification Center';

        const toastText = isBroadcast
          ? (lang === 'ar' ? notif.messageAr : notif.messageEn) || ''
          : isAdmin
          ? `${lang === 'ar' ? 'رسالة من الإدارة:' : 'Message from Administration:'} ${(lang === 'ar' ? notif.messageAr : notif.messageEn) || ''}`
          : (lang === 'ar' ? notif.messageAr : notif.messageEn) || '';

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
    window.addEventListener('soulx:unread-messages-count', handleUnreadCountSync);
    window.addEventListener('soulx_user_notification_received', handleUserNotification);
    return () => {
      window.removeEventListener('soulx_chat_updated', handleChatUpdated);
      window.removeEventListener('soulx:chat-read', handleChatRead);
      window.removeEventListener('soulx:unread-messages-count', handleUnreadCountSync);
      window.removeEventListener('soulx_user_notification_received', handleUserNotification);
    };
  }, [currentUser, activeTab, lang, incomingMessageToast, isInsideActiveChat, activeChatDetail]);

  // When opening chats tab, reset notification toast
  useEffect(() => {
    if (activeTab === 'chats') {
      setIncomingMessageToast(null);
    }
  }, [activeTab]);

  const wipeLocalSession = () => {
    setCurrentUser(null);
    setBirthDate(null);
    setGender(null);
    setCountry(null);
    walletBalanceRef.current = 0;
    coinsBalanceRef.current = 0;
    setWalletBalance(0);
    setCoinsBalance(0);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('soulx_country');
      localStorage.removeItem('soulx_wallet_balance');
      localStorage.removeItem('soulx_coins_balance');
    }
    setAdminToken(null);
    setSupremeToken(null);
    setIsSupremePanelOpen(false);
    setIsSupremeUnlockOpen(false);
    setIsAccountSwitcherOpen(false);
    setAdminSwitchOriginTokenState(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('soulx_supreme_token');
    }
    clearAdminSwitchOriginToken();
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
    walletBalanceRef.current = 0;
    coinsBalanceRef.current = 0;
    setWalletBalance(0);
    setCoinsBalance(0);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('soulx_wallet_balance');
      localStorage.removeItem('soulx_coins_balance');
    }
    setAdminToken(null);
    setIsAdminPanelOpen(false);
    setIsAdminPinModalOpen(false);
    setSupremeToken(null);
    setIsSupremePanelOpen(false);
    setIsSupremeUnlockOpen(false);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('soulx_supreme_token');
    }
    setIsWalletOpen(false);
    setIsGamesOpen(false);
    setIsStoreOpen(false);
    setIsRoomsOpen(false);
    setActiveRoomCode(null);
    setActiveRoomInvite(null);
    setActiveGame(null);
    setIsSettingsOpen(false);
    setIsBlockedUsersOpen(false);
    setIsTelegramModalOpen(false);
    setIsOnboardingOpen(false);
    setIsEditingProfile(false);
    setIsAccountSwitcherOpen(false);
    clearAdminSwitchOriginToken();
    setAdminSwitchOriginTokenState(null);
    setActiveTab('home');
  };

  const handleAccountSwitched = (result: AccountSwitchResult) => {
    const { token, refreshToken, expiresAt, refreshExpiresAt, isAdmin: switchedIsAdmin, user: switchedUser, adminSwitchOriginToken: nextOrigin } = result;
    const finalUser: AuthUser = { ...switchedUser, isAdmin: Boolean(switchedIsAdmin ?? switchedUser.isAdmin) };

    storeAuthTokens(token, refreshToken, expiresAt, refreshExpiresAt);
    setAdminSwitchOriginToken(nextOrigin || null);
    setAdminSwitchOriginTokenState(nextOrigin || null);

    if (typeof window !== 'undefined') {
      localStorage.setItem('soulx_auth_user', JSON.stringify(finalUser));
      if (switchedIsAdmin) {
        sessionStorage.setItem('soulx_admin_token', token);
      } else {
        sessionStorage.removeItem('soulx_admin_token');
      }
      sessionStorage.removeItem('soulx_supreme_token');
      if (finalUser.birthDate) localStorage.setItem('soulx_birth_date', finalUser.birthDate);
      else localStorage.removeItem('soulx_birth_date');
      if (finalUser.gender) localStorage.setItem('soulx_gender', finalUser.gender);
      else localStorage.removeItem('soulx_gender');
      if (finalUser.country) localStorage.setItem('soulx_country', finalUser.country);
      else localStorage.removeItem('soulx_country');
    }

    setAdminToken(switchedIsAdmin ? token : null);
    setSupremeToken(null);
    setIsAdminPanelOpen(false);
    setIsAdminPinModalOpen(false);
    setIsSupremePanelOpen(false);
    setIsSupremeUnlockOpen(false);
    setIsWalletOpen(false);
    setIsGamesOpen(false);
    setIsStoreOpen(false);
    setIsRoomsOpen(false);
    setActiveRoomCode(null);
    setActiveRoomInvite(null);
    setActiveGame(null);
    setIsSettingsOpen(false);
    setIsBlockedUsersOpen(false);
    setIsSearchPageOpen(false);
    setIsSearchModalOpen(false);
    setIsInsideActiveChat(false);
    setActiveChatDetail(null);
    setUnreadChatsCount(0);
    setIncomingMessageToast(null);
    setInspectedUserProfile(null);

    const nextDiamonds = typeof finalUser.walletBalance === 'number' ? finalUser.walletBalance : 0;
    const nextCoins = typeof finalUser.coinsBalance === 'number' ? finalUser.coinsBalance : 0;
    walletBalanceRef.current = nextDiamonds;
    coinsBalanceRef.current = nextCoins;
    setWalletBalance(nextDiamonds);
    setCoinsBalance(nextCoins);
    syncAuthUserStorageBalances({ walletBalance: nextDiamonds, coinsBalance: nextCoins });

    setBirthDate(finalUser.birthDate || null);
    setGender((finalUser.gender as Gender) || null);
    setCountry(finalUser.country || null);
    setCurrentUser(finalUser);
    checkAccountRestriction(finalUser, true);
    setActiveTab('account');
  };

  // User restriction status (تجميد أو حظر الحساب)
  const [accountRestriction, setAccountRestriction] = useState<AccountRestrictionInfo | null>(null);
  const lastRestrictionCheckRef = React.useRef<number>(0);
  const isCheckingRestrictionRef = React.useRef<boolean>(false);

  const checkAccountRestriction = async (targetUser?: AuthUser | null, force = false): Promise<boolean> => {
    const u = targetUser !== undefined ? targetUser : currentUser;
    if (!u?.id && !u?.email) {
      setAccountRestriction(null);
      return false;
    }

    const now = Date.now();
    if (!force && isCheckingRestrictionRef.current) return Boolean(accountRestriction);
    if (!force && now - lastRestrictionCheckRef.current < 1500) return Boolean(accountRestriction);

    lastRestrictionCheckRef.current = now;
    isCheckingRestrictionRef.current = true;

    try {
      const q = new URLSearchParams();
      if (u.id) q.set('userId', u.id);
      if (u.email) q.set('email', u.email);
      const res = await fetch(`/api/users/account-status?${q.toString()}`, {
        cache: 'no-store',
      });
      const receivedAt = Date.now();
      const data = await res.json();
      if (data && data.success) {
        if (typeof data.isVerified === 'boolean' && u && Boolean(u.isVerified) !== data.isVerified) {
          const updatedVerified = data.isVerified;
          setCurrentUser((prev) => {
            if (!prev) return prev;
            const updated = { ...prev, isVerified: updatedVerified };
            try {
              localStorage.setItem('soulx_auth_user', JSON.stringify(updated));
            } catch {}
            return updated;
          });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('soulx:user-profile-updated'));
          }
        }
        const isBanned = Boolean(data.isBanned || data.accountState === 'banned' || data.status?.isBanned);
        const rawFrozen = Boolean(data.isFrozen || data.accountState === 'frozen' || data.status?.isFrozen);
        const serverRemainingMs =
          typeof data.remainingMs === 'number'
            ? data.remainingMs
            : typeof data.status?.remainingMs === 'number'
            ? data.status.remainingMs
            : 0;
        const isFrozen = rawFrozen && serverRemainingMs > 0;

        if (isBanned || isFrozen) {
          const restInfo: AccountRestrictionInfo = {
            status: isBanned ? 'banned' : 'frozen',
            isBanned,
            bannedAt: data.bannedAt || data.status?.bannedAt || null,
            banReason: data.banReason || data.status?.banReason || null,
            isFrozen,
            frozenAt: data.frozenAt || data.status?.frozenAt || null,
            freezeDurationMinutes: data.freezeDurationMinutes ?? data.status?.freezeDurationMinutes ?? null,
            freezeExpiresAt: data.freezeExpiresAt || data.status?.freezeExpiresAt || null,
            freezeReason: data.freezeReason || data.status?.freezeReason || null,
            remainingMs: serverRemainingMs,
            serverNow: data.serverNow ?? data.status?.serverNow,
            receivedAt,
          };
          setAccountRestriction(restInfo);
          return true;
        } else {
          setAccountRestriction(null);
          return false;
        }
      }
      return Boolean(accountRestriction);
    } catch (e) {
      console.warn('Failed to check account restriction status:', e);
      return Boolean(accountRestriction);
    } finally {
      isCheckingRestrictionRef.current = false;
    }
  };

  const handleAccountUnfrozen = async () => {
    const stillRestricted = await checkAccountRestriction(currentUser, true);
    if (!stillRestricted) {
      setCurrentUser((prev) =>
        prev
          ? {
              ...prev,
              isFrozen: false,
              freezeDurationMinutes: null,
              freezeExpiresAt: null,
              frozenAt: null,
              freezeReason: null,
            }
          : null
      );
      setAccountRestriction(null);
    }
  };

  const handleRestrictedLogout = () => {
    setAccountRestriction(null);
    handleLogout();
  };

  // 1. التحقق الفوري من التجميد أو الحظر عند أي تنقل في الموقع أو تغيير التبويب
  useEffect(() => {
    if (currentUser) {
      checkAccountRestriction(currentUser, true);
    }
  }, [activeTab]);

  // 2. التحقق الفوري عند فتح أو إغلاق أي نافذة أو قسم (المحفظة، الإعدادات، البحث، الدردشة، الملف الشخصي)
  useEffect(() => {
    if (currentUser) {
      checkAccountRestriction(currentUser, true);
    }
  }, [isWalletOpen, isGamesOpen, activeGame, isSettingsOpen, isBlockedUsersOpen, isSearchPageOpen, isInsideActiveChat, inspectedUserProfile]);

  // 3. التحقق عند أي تفاعل أو نقرة أو حركة للمستخدم في الموقع
  useEffect(() => {
    const handleUserActivity = () => {
      if (currentUser) {
        checkAccountRestriction(currentUser);
      }
    };

    window.addEventListener('click', handleUserActivity, { capture: true, passive: true });
    window.addEventListener('touchstart', handleUserActivity, { capture: true, passive: true });
    window.addEventListener('keydown', handleUserActivity, { capture: true, passive: true });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && currentUser) {
        checkAccountRestriction(currentUser, true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      window.removeEventListener('click', handleUserActivity, { capture: true });
      window.removeEventListener('touchstart', handleUserActivity, { capture: true });
      window.removeEventListener('keydown', handleUserActivity, { capture: true });
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [currentUser?.id, currentUser?.email]);

  // 4. مؤقت فحص دوري سريع كل 3 ثوانٍ للكشف الفوري عن أي حظر أو تجميد من الإدارة
  useEffect(() => {
    if (!currentUser) return;
    checkAccountRestriction(currentUser);
    const interval = setInterval(() => {
      checkAccountRestriction(currentUser);
    }, 3000);
    return () => clearInterval(interval);
  }, [currentUser?.id, currentUser?.email]);

  // 5. استقبال أحداث الحظر والتجميد الفورية عبر نافذة المتصفح
  useEffect(() => {
    const handleRestrictedEvent = (e: any) => {
      if (e.detail && (e.detail.isFrozen || e.detail.isBanned)) {
        setAccountRestriction(e.detail);
      } else if (currentUser) {
        checkAccountRestriction(currentUser, true);
      }
    };
    const handleCheckAccountStatus = () => {
      if (currentUser) checkAccountRestriction(currentUser, true);
    };
    window.addEventListener('soulx:account-restricted', handleRestrictedEvent);
    window.addEventListener('soulx:check-account-status', handleCheckAccountStatus);
    return () => {
      window.removeEventListener('soulx:account-restricted', handleRestrictedEvent);
      window.removeEventListener('soulx:check-account-status', handleCheckAccountStatus);
    };
  }, [currentUser]);

  // 6. Sync Store & Games section enable/disable state from backend
  useEffect(() => {
    const fetchSections = async () => {
      try {
        const res = await fetch('/api/settings/sections', { cache: 'no-store' });
        const data = await res.json();
        if (data?.success) {
          const nextGames = data.gamesEnabled !== false;
          const nextStore = data.storeEnabled !== false;
          setSectionsSettings({ gamesEnabled: nextGames, storeEnabled: nextStore });
          if (!nextGames) {
            setIsGamesOpen(false);
            setActiveGame(null);
          }
          if (!nextStore) {
            setIsStoreOpen(false);
          }
        }
      } catch {}
    };

    fetchSections();

    const handleSectionsUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail && typeof detail.gamesEnabled === 'boolean' && typeof detail.storeEnabled === 'boolean') {
        setSectionsSettings({
          gamesEnabled: detail.gamesEnabled,
          storeEnabled: detail.storeEnabled,
        });
        if (!detail.gamesEnabled) {
          setIsGamesOpen(false);
          setActiveGame(null);
        }
        if (!detail.storeEnabled) {
          setIsStoreOpen(false);
        }
      } else {
        fetchSections();
      }
    };

    window.addEventListener('soulx:sections-updated', handleSectionsUpdated);
    window.addEventListener('focus', fetchSections);
    return () => {
      window.removeEventListener('soulx:sections-updated', handleSectionsUpdated);
      window.removeEventListener('focus', fetchSections);
    };
  }, []);

  // Persistent wallet balance (starts at 0 diamonds)
  const [walletBalance, setWalletBalance] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soulx_wallet_balance');
      if (saved) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return 0;
  });

  // Persistent coins balance (starts at 0 coins)
  const [coinsBalance, setCoinsBalance] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('soulx_coins_balance');
      if (saved) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return 0;
  });

  const walletBalanceRef = useRef<number>(walletBalance);
  const coinsBalanceRef = useRef<number>(coinsBalance);

  useEffect(() => {
    walletBalanceRef.current = walletBalance;
  }, [walletBalance]);

  useEffect(() => {
    coinsBalanceRef.current = coinsBalance;
  }, [coinsBalance]);

  const syncAuthUserStorageBalances = (patch: { walletBalance?: number; coinsBalance?: number }) => {
    if (typeof window === 'undefined') return;
    if (typeof patch.walletBalance === 'number') {
      localStorage.setItem('soulx_wallet_balance', String(patch.walletBalance));
    }
    if (typeof patch.coinsBalance === 'number') {
      localStorage.setItem('soulx_coins_balance', String(patch.coinsBalance));
    }
    try {
      const raw = localStorage.getItem('soulx_auth_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (typeof patch.walletBalance === 'number') parsed.walletBalance = patch.walletBalance;
          if (typeof patch.coinsBalance === 'number') parsed.coinsBalance = patch.coinsBalance;
          localStorage.setItem('soulx_auth_user', JSON.stringify(parsed));
        }
      }
    } catch {}
  };

  // Track initial tab when opening wallet ('diamonds' | 'coins') - Coins is the primary currency
  const [walletInitialTab, setWalletInitialTab] = useState<'diamonds' | 'coins'>('coins');

  const persistCoinsAbsolute = (next: number) => {
    const clamped = Math.max(0, next);
    coinsBalanceRef.current = clamped;
    setCoinsBalance(clamped);
    syncAuthUserStorageBalances({ coinsBalance: clamped });
    if (currentUser) {
      setCurrentUser((u) => (u ? { ...u, coinsBalance: clamped } : null));
      const token = getStoredAuthToken();
      fetch('/api/coins/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: currentUser.id,
          displayId: currentUser.displayId,
          email: currentUser.email,
          balance: clamped,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.success && typeof data.balance === 'number') {
            coinsBalanceRef.current = data.balance;
            setCoinsBalance(data.balance);
            syncAuthUserStorageBalances({ coinsBalance: data.balance });
            setCurrentUser((u) => (u ? { ...u, coinsBalance: data.balance } : null));
          }
        })
        .catch(() => {});
    }
  };

  const persistDiamondsAbsolute = (next: number) => {
    const clamped = Math.max(0, next);
    walletBalanceRef.current = clamped;
    setWalletBalance(clamped);
    syncAuthUserStorageBalances({ walletBalance: clamped });
    if (currentUser) {
      setCurrentUser((u) => (u ? { ...u, walletBalance: clamped } : null));
      const token = getStoredAuthToken();
      fetch('/api/wallet/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: currentUser.id,
          displayId: currentUser.displayId,
          email: currentUser.email,
          balance: clamped,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.success && typeof data.balance === 'number') {
            walletBalanceRef.current = data.balance;
            setWalletBalance(data.balance);
            syncAuthUserStorageBalances({ walletBalance: data.balance });
            setCurrentUser((u) => (u ? { ...u, walletBalance: data.balance } : null));
          }
        })
        .catch(() => {});
    }
  };

  const handleUpdateCoins = (amount: number) => {
    persistCoinsAbsolute(coinsBalanceRef.current + amount);
  };

  const handleDeductCoins = (amount: number) => {
    persistCoinsAbsolute(coinsBalanceRef.current - amount);
  };

  const handleRecharge = (amount: number) => {
    persistDiamondsAbsolute(walletBalanceRef.current + amount);
  };

  const handleWithdraw = (amount: number) => {
    persistDiamondsAbsolute(walletBalanceRef.current - amount);
  };

  // Sync real wallet balance directly from backend database
  useEffect(() => {
    if (!currentUser) return;
    const lookupParam = currentUser.id || currentUser.email || '';
    if (!lookupParam) return;
    const token = getStoredAuthToken();
    fetch(
      `/api/wallet/balance?userId=${encodeURIComponent(currentUser.id)}&email=${encodeURIComponent(currentUser.email || '')}`,
      {
        cache: 'no-store',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      }
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data?.success) return;
        const patch: { walletBalance?: number; coinsBalance?: number } = {};
        if (typeof data.balance === 'number') {
          walletBalanceRef.current = data.balance;
          setWalletBalance(data.balance);
          patch.walletBalance = data.balance;
        }
        if (typeof data.coinsBalance === 'number') {
          coinsBalanceRef.current = data.coinsBalance;
          setCoinsBalance(data.coinsBalance);
          patch.coinsBalance = data.coinsBalance;
        }
        if (typeof patch.walletBalance === 'number' || typeof patch.coinsBalance === 'number') {
          syncAuthUserStorageBalances(patch);
          setCurrentUser((prev) => (prev ? { ...prev, ...patch } : null));
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
          coinsBalanceRef.current = detail.balance;
          setCoinsBalance(detail.balance);
          syncAuthUserStorageBalances({ coinsBalance: detail.balance });
          setCurrentUser((prev) => (prev ? { ...prev, coinsBalance: detail.balance } : null));
        } else {
          walletBalanceRef.current = detail.balance;
          setWalletBalance(detail.balance);
          syncAuthUserStorageBalances({ walletBalance: detail.balance });
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

  const isGameBoardFixed =
    isGamesOpen &&
    (activeGame === 'golden-tree' || activeGame === 'plinko' || activeGame === 'mines' || activeGame === 'dice' || activeGame === 'olympus' || activeGame === 'boxes' || activeGame === 'winter-slots') &&
    !isWalletOpen &&
    !isSettingsOpen &&
    !isBlockedUsersOpen &&
    !isAdminPanelOpen &&
    !isSupremePanelOpen &&
    !isSearchPageOpen;

  const isInsideVoiceRoom =
    (isRoomsOpen || activeTab === 'rooms') &&
    Boolean(activeRoomCode) &&
    Boolean(currentUser) &&
    !isWalletOpen &&
    !isSettingsOpen &&
    !isBlockedUsersOpen &&
    !isAdminPanelOpen &&
    !isSupremePanelOpen &&
    !isSearchPageOpen;

  // Support direct room share URLs (?room=SX-XXXXXX&invite=...)
  const initialRoomParamHandledRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser || initialRoomParamHandledRef.current) return;
    initialRoomParamHandledRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && roomParam.trim()) {
      const inviteParam = params.get('invite');
      setIsWalletOpen(false);
      setIsGamesOpen(false);
      setIsStoreOpen(false);
      setIsSettingsOpen(false);
      setIsBlockedUsersOpen(false);
      setIsAdminPanelOpen(false);
      setIsSupremePanelOpen(false);
      setIsSearchPageOpen(false);
      setActiveTab('rooms');
      setIsRoomsOpen(true);
      setActiveRoomCode(roomParam.trim().toUpperCase());
      setActiveRoomInvite(inviteParam ? inviteParam.trim() : null);
    }
  }, [currentUser]);

  // Keep ?room= query param synced with active room state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (isRoomsOpen && activeRoomCode) {
      url.searchParams.set('room', activeRoomCode);
      if (activeRoomInvite) url.searchParams.set('invite', activeRoomInvite);
      else url.searchParams.delete('invite');
    } else {
      url.searchParams.delete('room');
      url.searchParams.delete('invite');
    }
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }, [isRoomsOpen, activeRoomCode, activeRoomInvite]);

  const syncCoinsBalanceImmediate = (nextBalance: number) => {
    coinsBalanceRef.current = nextBalance;
    setCoinsBalance(nextBalance);
    syncAuthUserStorageBalances({ coinsBalance: nextBalance });
    setCurrentUser((prev) => (prev ? { ...prev, coinsBalance: nextBalance } : null));
  };

  // Lock window/body scroll completely during active messaging, active voice room, or fixed game boards so bars remain 100% stationary
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (isInsideActiveChat || isGameBoardFixed || isInsideVoiceRoom) {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    };
  }, [isInsideActiveChat, isGameBoardFixed, isInsideVoiceRoom]);

  const isAccountTab = activeTab === 'account';

  return (
    <div
      className={`max-w-full overflow-x-clip ${
        isInsideActiveChat || isGameBoardFixed || isInsideVoiceRoom ? 'h-[100dvh] overflow-hidden' : 'min-h-screen'
      } bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 transition-colors flex flex-col selection:bg-cyan-500/20 selection:text-cyan-400`}
    >
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
            : isBlockedUsersOpen
            ? (isAr ? 'قائمة المحظورين' : 'Blocked Users')
            : isSupremePanelOpen
            ? (isAr ? 'لوحة الإدارة العليا' : 'Supreme Admin Panel')
            : isAdminPanelOpen
            ? (isAr ? 'لوحة الإدارة' : 'Admin Panel')
            : isGamesOpen
            ? (activeGame === 'golden-tree' ? 'Golden Tree' : activeGame === 'plinko' ? 'Plinko' : activeGame === 'mines' ? 'Mines' : activeGame === 'dice' ? 'Dice' : activeGame === 'olympus' ? 'Olympus Gates' : activeGame === 'boxes' ? (isAr ? 'صناديق الحظ' : 'Mystery Boxes') : activeGame === 'winter-slots' ? 'Winter Slots' : (isAr ? 'الألعاب' : 'Games'))
            : isStoreOpen
            ? (isAr ? 'المتجر' : 'Store')
            : isRoomsOpen || activeTab === 'rooms'
            ? (isAr ? 'الغرف' : 'Rooms')
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
        showCoinsInBar={
          (isGamesOpen || isStoreOpen) && !isWalletOpen && !isSettingsOpen && !isBlockedUsersOpen && !isAdminPanelOpen && !isSupremePanelOpen && !isSearchPageOpen
        }
        isActiveGame={isGameBoardFixed}
        onOpenSettings={() => {
          setIsWalletOpen(false);
          setIsGamesOpen(false);
          setIsStoreOpen(false);
          setIsRoomsOpen(false);
          setActiveRoomCode(null);
          setActiveRoomInvite(null);
          setActiveGame(null);
          setIsBlockedUsersOpen(false);
          setIsAdminPanelOpen(false);
          setIsSupremePanelOpen(false);
          setIsSettingsOpen(true);
        }}
        onOpenWallet={(tab) => {
          setIsSettingsOpen(false);
          setIsBlockedUsersOpen(false);
          setIsAdminPanelOpen(false);
          setIsSupremePanelOpen(false);
          setWalletInitialTab(tab || 'diamonds');
          setIsWalletOpen(true);
        }}
        onBrandClick={() => {
          setIsWalletOpen(false);
          setIsGamesOpen(false);
          setIsStoreOpen(false);
          setIsRoomsOpen(false);
          setActiveRoomCode(null);
          setActiveRoomInvite(null);
          setActiveGame(null);
          setIsSettingsOpen(false);
          setIsBlockedUsersOpen(false);
          setIsAdminPanelOpen(false);
          setIsSupremePanelOpen(false);
          setActiveTab('home');
        }}
        onNavigateToChats={() => {
          setIsWalletOpen(false);
          setIsGamesOpen(false);
          setIsStoreOpen(false);
          setIsRoomsOpen(false);
          setActiveRoomCode(null);
          setActiveRoomInvite(null);
          setActiveGame(null);
          setIsSettingsOpen(false);
          setIsBlockedUsersOpen(false);
          setIsAdminPanelOpen(false);
          setIsSupremePanelOpen(false);
          setActiveTab('chats');
        }}
        onBack={
          isWalletOpen
            ? () => setIsWalletOpen(false)
            : isSettingsOpen
            ? () => setIsSettingsOpen(false)
            : isBlockedUsersOpen
            ? () => setIsBlockedUsersOpen(false)
            : isSupremePanelOpen
            ? handleSupremeLock
            : isAdminPanelOpen
            ? null
            : isGamesOpen
            ? () => {
                if (activeGame) {
                  setActiveGame(null);
                } else {
                  setIsGamesOpen(false);
                }
              }
            : isStoreOpen
            ? () => setIsStoreOpen(false)
            : (isRoomsOpen || activeTab === 'rooms') && activeRoomCode
            ? () => {
                setActiveRoomCode(null);
                setActiveRoomInvite(null);
              }
            : null
        }
        adminActions={
          isAdminPanelOpen
            ? {
                onRefresh: () => window.dispatchEvent(new CustomEvent('soulx:admin-refresh')),
                onLock: handleAdminLock,
                isRefreshing: isAdminRefreshing,
              }
            : null
        }
        backLabel={
          isWalletOpen
            ? (isAr ? 'العودة' : 'Back')
            : isSettingsOpen
            ? (isAr ? 'العودة للملف' : 'Back to Profile')
            : isBlockedUsersOpen
            ? (isAr ? 'العودة للملف' : 'Back to Profile')
            : isSupremePanelOpen
            ? (isAr ? 'إغلاق اللوحة' : 'Close')
            : isGamesOpen
            ? (activeGame ? (isAr ? 'الألعاب' : 'Games') : (isAr ? 'العودة' : 'Back'))
            : isStoreOpen
            ? (isAr ? 'العودة' : 'Back')
            : (isRoomsOpen || activeTab === 'rooms') && activeRoomCode
            ? (isAr ? 'العودة' : 'Back')
            : null
        }
        onOpenSearch={
          activeTab === 'home' && !isRoomsOpen && !isGamesOpen && !isStoreOpen && !isWalletOpen && !isSettingsOpen && !isBlockedUsersOpen && !isAdminPanelOpen && !isSupremePanelOpen && !isSearchPageOpen
            ? () => setIsSearchPageOpen(true)
            : null
        }
        onOpenFriends={
          activeTab === 'chats' && !isRoomsOpen && !isWalletOpen && !isSettingsOpen && !isBlockedUsersOpen && !isAdminPanelOpen && !isSupremePanelOpen && !isInsideActiveChat
            ? () => window.dispatchEvent(new CustomEvent('soulx:open-friends'))
            : null
        }
        isSearchActive={isSearchPageOpen}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onCloseSearch={() => {
          setIsSearchPageOpen(false);
          setSearchQuery('');
          setIsScannerOpen(false);
        }}
        onScanBarcodeClick={() => setIsScannerOpen((prev) => !prev)}
        isScannerOpen={isScannerOpen}
      />

      {/* المحتوى الرئيسي حسب التبويب أو شاشة المحفظة / الإعدادات / قائمة المحظورين / لوحة الإدارة / البحث ملء الشاشة / الألعاب / المتجر / الغرف */}
      <main
        className={`flex-1 min-h-0 flex flex-col min-w-0 max-w-full overflow-x-clip ${
          isInsideVoiceRoom
            ? 'w-full px-0 pt-0 pb-0 overflow-hidden items-stretch justify-start'
            : activeTab === 'chats'
            ? 'w-full px-0 pt-0 pb-0 items-stretch justify-start'
            : isGameBoardFixed
            ? 'w-full px-0 pt-0 pb-[68px] overflow-hidden items-stretch justify-center'
            : isAccountTab || isWalletOpen || isSettingsOpen || isBlockedUsersOpen || isAdminPanelOpen || isSupremePanelOpen || isSearchPageOpen || isGamesOpen || isStoreOpen || isRoomsOpen || activeTab === 'rooms'
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
        ) : isBlockedUsersOpen ? (
          /* شاشة قائمة المحظورين كصفحة منفصلة ومستقلة تماماً عن إعدادات الحساب */
          <BlockedUsersView
            lang={lang}
            currentUser={currentUser}
            onBack={() => setIsBlockedUsersOpen(false)}
          />
        ) : isSupremePanelOpen && supremeToken ? (
          /* لوحة الإدارة العليا المنفصلة (مخصصة لـ ADMIN1 فقط) */
          <SupremeAdminPanelView
            lang={lang}
            supremeToken={supremeToken}
            onLock={handleSupremeLock}
          />
        ) : isAdminPanelOpen ? (
          /* لوحة تحكم الإدارة (محمية بـ ADMIN_PIN ومخصصة لـ ADMIN1 و ADMIN2) */
          <AdminPanelView
            lang={lang}
            currentUser={currentUser}
            adminToken={adminToken || ''}
            onBack={handleAdminLock}
            onLock={handleAdminLock}
            onLoadingChange={setIsAdminRefreshing}
          />
        ) : isSearchPageOpen ? (
          /* شاشة البحث كصفحة كاملة ملء الشاشة مع إمكانية عرض الملفات الشخصية */
          <FriendSearchView
            lang={lang}
            onBack={() => {
              setIsSearchPageOpen(false);
              setSearchQuery('');
              setIsScannerOpen(false);
            }}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isScannerOpen={isScannerOpen}
            setIsScannerOpen={setIsScannerOpen}
            onNavigateToChats={(friendInfo) => {
              setIsSearchPageOpen(false);
              setSearchQuery('');
              setIsScannerOpen(false);
              const targetId = typeof friendInfo === 'string' ? friendInfo : friendInfo?.id;
              if (targetId && typeof window !== 'undefined') {
                localStorage.setItem('soulx_open_conversation_id', targetId);
                window.dispatchEvent(
                  new CustomEvent('soulx:open-conversation', { detail: { conversationId: targetId } })
                );
              }
              setActiveTab('chats');
            }}
          />
        ) : isGamesOpen ? (
          <GamesView
            lang={lang}
            currentUser={currentUser}
            coinsBalance={coinsBalance}
            activeGame={activeGame}
            onSelectGame={(game) => {
              playNavClick();
              setActiveGame(game);
            }}
            onCoinsBalanceSync={(nextBalance) => {
              coinsBalanceRef.current = nextBalance;
              setCoinsBalance(nextBalance);
              syncAuthUserStorageBalances({ coinsBalance: nextBalance });
              setCurrentUser((prev) => (prev ? { ...prev, coinsBalance: nextBalance } : null));
            }}
            onOpenWallet={() => {
              playNavClick();
              setWalletInitialTab('coins');
              setIsWalletOpen(true);
            }}
          />
        ) : isStoreOpen ? (
          <StoreView
            lang={lang}
            currentUser={currentUser}
            coinsBalance={coinsBalance}
            gender={gender || currentUser?.gender}
            onOpenWallet={() => {
              playNavClick();
              setWalletInitialTab('coins');
              setIsWalletOpen(true);
            }}
            onCoinsBalanceSync={(nextBalance) => {
              coinsBalanceRef.current = nextBalance;
              setCoinsBalance(nextBalance);
              syncAuthUserStorageBalances({ coinsBalance: nextBalance });
              setCurrentUser((prev) => (prev ? { ...prev, coinsBalance: nextBalance } : null));
            }}
            onEquippedFrameChange={(nextFrameId) => {
              setCurrentUser((prev) => {
                if (!prev) return null;
                const updated = { ...prev, equippedFrameId: nextFrameId };
                if (typeof window !== 'undefined') {
                  try {
                    localStorage.setItem('soulx_auth_user', JSON.stringify(updated));
                  } catch {}
                }
                return updated;
              });
            }}
          />
        ) : (isRoomsOpen || activeTab === 'rooms') && currentUser ? (
          activeRoomCode ? (
            <VoiceRoomView
              lang={lang}
              currentUser={currentUser}
              roomCode={activeRoomCode}
              inviteToken={activeRoomInvite || undefined}
              coinsBalance={coinsBalance}
              onLeave={() => {
                setActiveRoomCode(null);
                setActiveRoomInvite(null);
              }}
              onCoinsSync={syncCoinsBalanceImmediate}
              onOpenWallet={() => {
                playNavClick();
                setWalletInitialTab('coins');
                setIsWalletOpen(true);
              }}
            />
          ) : (
            <RoomsHubView
              lang={lang}
              currentUser={currentUser}
              coinsBalance={coinsBalance}
              onEnterRoom={(code: string) => {
                playNavClick();
                setActiveRoomCode(code);
                setActiveRoomInvite(null);
              }}
              onCoinsSync={syncCoinsBalanceImmediate}
              onOpenWallet={() => {
                playNavClick();
                setWalletInitialTab('coins');
                setIsWalletOpen(true);
              }}
            />
          )
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeView
                key={currentUser?.id || 'guest'}
                lang={lang}
                currentUser={currentUser}
                gamesEnabled={sectionsSettings.gamesEnabled}
                storeEnabled={sectionsSettings.storeEnabled}
                onNavigateToTab={(tab) => {
                  playNavClick();
                  setIsWalletOpen(false);
                  setIsGamesOpen(false);
                  setIsStoreOpen(false);
                  setActiveGame(null);
                  setIsSettingsOpen(false);
                  setIsBlockedUsersOpen(false);
                  setIsAdminPanelOpen(false);
                  setIsSearchPageOpen(false);
                  setActiveTab(tab);
                }}
                onGoToChat={(friendName) => {
                  playNavClick();
                  setIsWalletOpen(false);
                  setIsGamesOpen(false);
                  setIsStoreOpen(false);
                  setActiveGame(null);
                  setIsSettingsOpen(false);
                  setIsBlockedUsersOpen(false);
                  setIsAdminPanelOpen(false);
                  setIsSearchPageOpen(false);
                  setActiveTab('chats');
                }}
                onOpenWallet={() => {
                  playNavClick();
                  setIsSettingsOpen(false);
                  setIsBlockedUsersOpen(false);
                  setIsAdminPanelOpen(false);
                  setIsSearchPageOpen(false);
                  setWalletInitialTab('coins');
                  setIsWalletOpen(true);
                }}
                onOpenSearch={() => {
                  playNavClick();
                  setIsSearchPageOpen(true);
                }}
                onOpenGames={() => {
                  if (!sectionsSettings.gamesEnabled) return;
                  playNavClick();
                  setActiveGame(null);
                  setIsStoreOpen(false);
                  setIsGamesOpen(true);
                }}
                onOpenStore={() => {
                  if (!sectionsSettings.storeEnabled) return;
                  playNavClick();
                  setIsGamesOpen(false);
                  setActiveGame(null);
                  setIsStoreOpen(true);
                }}
              />
            )}

            {activeTab === 'match' && (
              <MatchingView
                key={currentUser?.id || 'guest'}
                lang={lang}
                onGoToChat={() => {
                  playNavClick();
                  setActiveTab('chats');
                }}
                currentUser={currentUser}
                walletBalance={walletBalance}
                coinsBalance={coinsBalance}
                onDeductDiamonds={handleWithdraw}
                onDeductCoins={handleDeductCoins}
                onOpenWallet={() => {
                  playNavClick();
                  setWalletInitialTab('coins');
                  setIsWalletOpen(true);
                }}
              />
            )}

            {activeTab === 'chats' && (
              <ChatsView
                key={currentUser?.id || 'guest'}
                lang={lang}
                currentUser={currentUser}
                walletBalance={walletBalance}
                coinsBalance={coinsBalance}
                onDeductDiamonds={handleWithdraw}
                onDeductCoins={handleDeductCoins}
                onOpenWallet={() => {
                  playNavClick();
                  setWalletInitialTab('coins');
                  setIsWalletOpen(true);
                }}
                onActiveChatChange={setIsInsideActiveChat}
              />
            )}

            {activeTab === 'account' && (
              <AccountView
                key={currentUser?.id || 'guest'}
                lang={lang}
                walletBalance={walletBalance}
                coinsBalance={coinsBalance}
                onOpenWallet={(tab) => {
                  playNavClick();
                  setWalletInitialTab(tab || 'coins');
                  setIsWalletOpen(true);
                }}
                onOpenSettings={() => {
                  playNavClick();
                  setIsBlockedUsersOpen(false);
                  setIsSettingsOpen(true);
                }}
                onOpenBlockedUsers={() => {
                  playNavClick();
                  setIsSettingsOpen(false);
                  setIsBlockedUsersOpen(true);
                }}
                auth={auth}
                onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
                birthDate={birthDate}
                gender={gender}
                country={country || currentUser?.country}
                onOpenEditProfile={() => setIsEditingProfile(true)}
                currentUser={currentUser}
                onLogout={handleLogout}
                onOpenAdminPanel={handleOpenAdmin}
                onOpenSupremePanel={handleOpenSupremePanel}
                adminSwitchOriginToken={adminSwitchOriginToken}
                onOpenAccountSwitcher={() => setIsAccountSwitcherOpen(true)}
              />
            )}
          </>
        )}
      </main>

      {/* إشعار رسالة واردة فورية عند التواجد في صفحة أخرى */}
      {incomingMessageToast && activeTab !== 'chats' && !isInsideVoiceRoom && (
        <div
          onClick={() => {
            playNavClick();
            setIsWalletOpen(false);
            setIsGamesOpen(false);
            setIsStoreOpen(false);
            setIsRoomsOpen(false);
            setActiveRoomCode(null);
            setActiveRoomInvite(null);
            setActiveGame(null);
            setIsSettingsOpen(false);
            setIsBlockedUsersOpen(false);
            setIsAdminPanelOpen(false);
            setIsSupremePanelOpen(false);
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
          }}
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md z-[100] p-4 rounded-3xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-2 border-cyan-500 shadow-2xl shadow-cyan-500/30 flex items-center gap-3 cursor-pointer hover:scale-[1.02] transition-transform animate-in fade-in zoom-in-95 duration-300"
        >
          <img
            src={incomingMessageToast.senderAvatar}
            alt={incomingMessageToast.senderName}
            className="w-10 h-10 rounded-full object-cover border border-cyan-500/40 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-neutral-900 dark:text-white truncate inline-flex items-center gap-1">
                <span className="truncate">{incomingMessageToast.senderName}</span>
                {incomingMessageToast.senderIsVerified && <VerifiedBadge lang={lang} size="xs" />}
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

      {/* البار السفلي / Bottom Navigation Bar - يُخفى تلقائياً عند الدخول في محادثة نشطة أو داخل غرفة صوتية */}
      {!isInsideActiveChat && !isInsideVoiceRoom && (
        <BottomNav
          activeTab={
            isWalletOpen || isSettingsOpen || isBlockedUsersOpen || isAdminPanelOpen || isSupremePanelOpen
              ? 'account'
              : isRoomsOpen
              ? 'rooms'
              : activeTab
          }
          onChangeTab={(tab) => {
            setIsWalletOpen(false);
            setIsGamesOpen(false);
            setIsStoreOpen(false);
            setActiveGame(null);
            setIsSettingsOpen(false);
            setIsBlockedUsersOpen(false);
            setIsAdminPanelOpen(false);
            setIsSupremePanelOpen(false);
            setIsInsideActiveChat(false);
            setIsSearchPageOpen(false);
            if (tab === 'rooms') {
              setIsRoomsOpen(true);
              setActiveRoomCode(null);
              setActiveRoomInvite(null);
            } else {
              setIsRoomsOpen(false);
              setActiveRoomCode(null);
              setActiveRoomInvite(null);
            }
            setActiveTab(tab);
          }}
          lang={lang}
          unreadChatsCount={unreadChatsCount}
          userAvatar={currentUser?.photoUrl || null}
          onAccountTripleTap={
            currentUser && (Boolean(currentUser.isAdmin) || Boolean(adminSwitchOriginToken))
              ? () => setIsAccountSwitcherOpen(true)
              : undefined
          }
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
          // Direct login/registration must NEVER retain or inherit any previous Admin Quick-Switch session
          clearAdminSwitchOriginToken();
          setAdminSwitchOriginTokenState(null);
          setIsAccountSwitcherOpen(false);

          setCurrentUser(user);
          checkAccountRestriction(user);
          if (typeof window !== 'undefined') {
            localStorage.setItem('soulx_auth_user', JSON.stringify(user));
          }
          const initialDiamonds = typeof user.walletBalance === 'number' ? user.walletBalance : 0;
          const initialCoins = typeof user.coinsBalance === 'number' ? user.coinsBalance : 0;
          walletBalanceRef.current = initialDiamonds;
          coinsBalanceRef.current = initialCoins;
          setWalletBalance(initialDiamonds);
          setCoinsBalance(initialCoins);
          syncAuthUserStorageBalances({ walletBalance: initialDiamonds, coinsBalance: initialCoins });
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

      {/* Modal: التحقق المخفي للوحة الإدارة العليا (ADMIN1 فقط) */}
      <SupremeUnlockModal
        isOpen={isSupremeUnlockOpen}
        onClose={() => setIsSupremeUnlockOpen(false)}
        lang={lang}
        onSuccess={handleSupremeUnlockSuccess}
      />

      {/* Modal: تبديل الحسابات السريع لحسابات الأدمن */}
      <AdminAccountSwitcherModal
        isOpen={isAccountSwitcherOpen}
        onClose={() => setIsAccountSwitcherOpen(false)}
        lang={lang}
        currentUser={currentUser}
        isAdmin={Boolean(currentUser?.isAdmin)}
        adminSwitchOriginToken={adminSwitchOriginToken}
        onAccountSwitched={handleAccountSwitched}
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

      {/* Full-Screen Other User Profile View */}
      <OtherUserProfileModal
        isOpen={Boolean(inspectedUserProfile)}
        onClose={() => setInspectedUserProfile(null)}
        lang={lang}
        currentUser={currentUser}
        user={inspectedUserProfile}
        onStartChat={(target) => {
          setInspectedUserProfile(null);
          setIsSearchPageOpen(false);
          setIsSearchModalOpen(false);
          setIsWalletOpen(false);
          setIsGamesOpen(false);
          setIsStoreOpen(false);
          setIsRoomsOpen(false);
          setActiveRoomCode(null);
          setActiveRoomInvite(null);
          setActiveGame(null);
          setIsSettingsOpen(false);
          setIsBlockedUsersOpen(false);
          setIsAdminPanelOpen(false);
          setIsSupremePanelOpen(false);
          const convId = target.displayId || target.id;
          if (typeof window !== 'undefined') {
            localStorage.setItem('soulx_open_conversation_id', convId);
            window.dispatchEvent(
              new CustomEvent('soulx:open-conversation', {
                detail: {
                  conversationId: convId,
                  partnerId: target.id,
                  partnerName: target.name,
                  partnerAvatar: target.avatar,
                },
              })
            );
          }
          setActiveTab('chats');
        }}
      />

      {/* نافذة منع وصول المستخدم المجمد أو المحظور مع عداد تنازلي حي لفك التجميد */}
      {accountRestriction && (accountRestriction.isBanned || accountRestriction.isFrozen) && (
        <AccountRestrictionModal
          isOpen={true}
          restriction={accountRestriction}
          userName={currentUser?.name || ''}
          userDisplayId={currentUser?.displayId || currentUser?.id}
          lang={lang}
          onLogout={handleRestrictedLogout}
          onUnfrozen={handleAccountUnfrozen}
          onRefreshStatus={async () => {
            await checkAccountRestriction(currentUser, true);
          }}
        />
      )}
    </div>
  );
}
