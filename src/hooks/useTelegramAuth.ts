import { useState, useEffect, useCallback } from 'react';
import { TelegramUser, TelegramAuthResult, Language } from '../types';

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
  checkBotStatus: () => Promise<void>;
  simulateTelegramLogin: (customUser?: Partial<TelegramUser>) => Promise<boolean>;
  logoutTelegram: () => void;
  reValidate: () => Promise<void>;
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

  // Check bot token status on the server
  const checkBotStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram/status');
      if (res.ok) {
        const data = await res.json();
        setBotConfigured(!!data.configured);
        setBotInfo(data.botInfo || null);
      }
    } catch {
      // ignore
    }
  }, []);

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

          // Save verified telegram user in localStorage
          if (data.user) {
            localStorage.setItem('soulx_telegram_user', JSON.stringify(data.user));
            localStorage.setItem('soulx_telegram_verified', data.verified ? 'true' : 'false');
            localStorage.setItem('soulx_user_id', data.user.id.toString());
            
            // Auto sync language if specified in Telegram user object
            if (data.user.language_code && onLanguageChange) {
              const langCode = data.user.language_code.startsWith('ar') ? 'ar' : 'en';
              onLanguageChange(langCode);
            }
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

    let rawInitDataToValidate: string | null = null;
    let userFromParams: TelegramUser | null = null;

    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const rawHash = (window.location.hash || '').replace(/^[#?]+/, '');
      const hashParams = new URLSearchParams(rawHash);

      // Check if Telegram passed raw WebAppData in hash or search
      const tgWebAppData = hashParams.get('tgWebAppData') || searchParams.get('tgWebAppData');
      if (tgWebAppData) {
        try {
          const decoded = tgWebAppData.includes('%') ? decodeURIComponent(tgWebAppData) : tgWebAppData;
          rawInitDataToValidate = decoded;
          const innerParams = new URLSearchParams(decoded);
          const rawUser = innerParams.get('user');
          if (rawUser) {
            userFromParams = JSON.parse(rawUser);
          }
        } catch {
          // ignore parsing error
        }
      }

      // Check direct parameters from custom bot buttons
      const tgId = searchParams.get('tg_id') || hashParams.get('tg_id');
      const tgName = searchParams.get('tg_name') || hashParams.get('tg_name');
      const tgLast = searchParams.get('tg_last') || hashParams.get('tg_last');
      const tgUser = searchParams.get('tg_user') || hashParams.get('tg_user');
      const tgLang = searchParams.get('tg_lang') || hashParams.get('tg_lang');

      if (tgId && !userFromParams) {
        userFromParams = {
          id: parseInt(tgId, 10),
          first_name: tgName || 'عضو تيليجرام',
          last_name: tgLast || undefined,
          username: tgUser || undefined,
          language_code: tgLang || 'ar',
        };
      }
    }

    const processTelegramSession = () => {
      const tg = window.Telegram?.WebApp;
      if (tg) {
        try {
          tg.ready();
          tg.expand();
          tg.setHeaderColor?.('#0a0a0a');
          tg.setBackgroundColor?.('#0a0a0a');
        } catch {
          // ignore
        }
      }

      const userFromInitDataUnsafe = tg?.initDataUnsafe?.user;
      const detectedUser = userFromInitDataUnsafe || userFromParams;
      const initDataString = tg?.initData || rawInitDataToValidate;

      if (detectedUser) {
        setIsTelegram(true);
        setTelegramUser(detectedUser);
        setIsVerified(true);
        setServerMessage('تم التعرف على بيانات حساب تيليجرام وتسجيل الدخول تلقائياً');
        localStorage.setItem('soulx_telegram_user', JSON.stringify(detectedUser));
        localStorage.setItem('soulx_telegram_verified', 'true');
        localStorage.setItem('soulx_user_id', detectedUser.id.toString());

        if (detectedUser.language_code && onLanguageChange) {
          const langCode = detectedUser.language_code.startsWith('ar') ? 'ar' : 'en';
          onLanguageChange(langCode);
        }
      }

      if (initDataString && initDataString.length > 0) {
        setIsTelegram(true);
        validateWithServer(initDataString, false);
      } else if (!detectedUser) {
        // Fallback to cached profile
        const cachedTg = localStorage.getItem('soulx_telegram_user');
        const cachedVerified = localStorage.getItem('soulx_telegram_verified') === 'true';
        if (cachedTg) {
          try {
            const parsed = JSON.parse(cachedTg);
            setTelegramUser(parsed);
            setIsVerified(cachedVerified);
          } catch {
            // ignore
          }
        }
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    };

    processTelegramSession();

    // Check again shortly in case window.Telegram loaded asynchronously
    const timer = setTimeout(() => {
      if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
        processTelegramSession();
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [checkBotStatus, validateWithServer, onLanguageChange]);

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
    checkBotStatus,
    simulateTelegramLogin,
    logoutTelegram,
    reValidate,
  };
}
