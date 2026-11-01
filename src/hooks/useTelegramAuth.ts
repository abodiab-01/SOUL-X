import { useState, useEffect, useCallback } from 'react';
import { TelegramUser, Language } from '../types';

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe?: {
          query_id?: string;
          user?: TelegramUser;
          auth_date?: string;
          hash?: string;
        };
        version?: string;
        platform?: string;
        colorScheme?: 'dark' | 'light';
        themeParams?: Record<string, string>;
        isExpanded?: boolean;
        viewportHeight?: number;
        viewportStableHeight?: number;
        headerColor?: string;
        backgroundColor?: string;
        ready: () => void;
        expand: () => void;
        close: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
        openTelegramLink?: (url: string) => void;
        openLink?: (url: string) => void;
        showPopup?: (params: any, callback?: (buttonId: string) => void) => void;
        showAlert?: (message: string, callback?: () => void) => void;
        showConfirm?: (message: string, callback?: (confirmed: boolean) => void) => void;
        HapticFeedback?: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
      };
    };
  }
}

export interface UseTelegramAuthReturn {
  isTelegram: boolean;
  isVerified: boolean;
  isLoading: boolean;
  telegramUser: TelegramUser | null;
  serverMessage: string | null;
  serverError: string | null;
  isSimulated: boolean;
  botConfigured: boolean;
  botInfo: any;
  publicUrl: string | null;
  isTunnelActive: boolean;
  checkBotStatus: () => Promise<void>;
  simulateTelegramLogin: (customUser?: Partial<TelegramUser>) => Promise<boolean>;
  logoutTelegram: () => void;
  reValidate: () => Promise<void>;
  configureBotToken: (token: string) => Promise<{ success: boolean; message: string }>;
}

export function useTelegramAuth(onLanguageChange?: (lang: Language) => void): UseTelegramAuthReturn {
  const [isTelegram, setIsTelegram] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSimulated, setIsSimulated] = useState(false);
  const [botConfigured, setBotConfigured] = useState(false);
  const [botInfo, setBotInfo] = useState<any>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [isTunnelActive, setIsTunnelActive] = useState(false);

  // Check bot token status on the server and auto-sync dynamic origin
  const checkBotStatus = useCallback(async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = origin ? `/api/telegram/status?clientUrl=${encodeURIComponent(origin)}` : '/api/telegram/status';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setBotConfigured(!!data.configured);
        setBotInfo(data.botInfo || null);
        setPublicUrl(data.publicUrl || null);
        setIsTunnelActive(!!data.isTunnelActive);
      }
    } catch {
      // ignore
    }
  }, []);

  // Configure new bot token dynamically
  const configureBotToken = useCallback(
    async (token: string): Promise<{ success: boolean; message: string }> => {
      try {
        const res = await fetch('/api/telegram/configure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ botToken: token }),
        });
        const data = await res.json();
        if (data.success) {
          await checkBotStatus();
          return { success: true, message: data.message };
        } else {
          return { success: false, message: data.message || 'فشل ضبط توكن البوت' };
        }
      } catch (err: any) {
        return { success: false, message: err.message || 'خطأ في الاتصال بالخادم' };
      }
    },
    [checkBotStatus]
  );

  // Validate initData with backend
  const validateWithServer = useCallback(
    async (initDataString: string, simulated: boolean = false) => {
      setIsLoading(true);
      setServerError(null);
      try {
        const response = await fetch('/api/telegram/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            initData: initDataString,
            isSimulated: simulated,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setIsVerified(data.verified !== false);
          setTelegramUser(data.user || null);
          setIsSimulated(!!data.isSimulated);
          setServerMessage(data.message || 'تم التحقق بنجاح');

          // Note: Telegram login is disabled in favor of Email-only authentication
          if (data.user?.language_code && onLanguageChange) {
            const langCode = data.user.language_code.startsWith('ar') ? 'ar' : 'en';
            onLanguageChange(langCode);
          }
        } else {
          setIsVerified(false);
          setServerError(data.message || data.error || 'فشل التحقق من صحة بيانات تيليجرام');
        }
      } catch (err: any) {
        setServerError('تعذر الاتصال بخادم التحقق: ' + err.message);
        setIsVerified(false);
      } finally {
        setIsLoading(false);
      }
    },
    [onLanguageChange]
  );

  // Initialize and check environment
  useEffect(() => {
    checkBotStatus();

    // Check if running inside Telegram Mini App container to enable WebApp viewport features
    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
    if (tg) {
      setIsTelegram(true);
      try {
        tg.ready();
        tg.expand();
        tg.setHeaderColor?.('#0a0a0a');
        tg.setBackgroundColor?.('#0a0a0a');
      } catch {
        // ignore
      }
    }
    setIsLoading(false);
  }, [checkBotStatus]);

  // Simulate Telegram login (for browser testing and development)
  const simulateTelegramLogin = useCallback(
    async (customUser?: Partial<TelegramUser>): Promise<boolean> => {
      setIsLoading(true);
      try {
        const testRes = await fetch('/api/telegram/create-test-init-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: customUser }),
        });

        const testData = await testRes.json();
        if (testData.success && testData.initData) {
          setIsTelegram(true);
          await validateWithServer(testData.initData, true);
          return true;
        }
        return false;
      } catch (err: any) {
        setServerError(err.message);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [validateWithServer]
  );

  // Logout / clear Telegram account linking
  const logoutTelegram = useCallback(() => {
    setTelegramUser(null);
    setIsVerified(false);
    setIsSimulated(false);
    setServerMessage(null);
    setServerError(null);
    localStorage.removeItem('soulx_telegram_user');
    localStorage.removeItem('soulx_telegram_verified');
  }, []);

  const reValidate = useCallback(async () => {
    const tg = window.Telegram?.WebApp;
    if (tg?.initData) {
      await validateWithServer(tg.initData, false);
    } else {
      await checkBotStatus();
    }
  }, [checkBotStatus, validateWithServer]);

  return {
    isTelegram,
    isVerified,
    isLoading,
    telegramUser,
    serverMessage,
    serverError,
    isSimulated,
    botConfigured,
    botInfo,
    publicUrl,
    isTunnelActive,
    checkBotStatus,
    simulateTelegramLogin,
    logoutTelegram,
    reValidate,
    configureBotToken,
  };
}
