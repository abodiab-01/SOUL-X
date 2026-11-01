import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Permit Telegram WebApp to embed and communicate smoothly
app.use((_req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Helper function to verify Telegram WebApp initData
export function verifyTelegramWebAppData(
  initData: string,
  botToken: string
): {
  valid: boolean;
  user?: any;
  authDate?: number;
  queryId?: string;
  error?: string;
} {
  if (!initData) {
    return { valid: false, error: 'initData is empty' };
  }
  if (!botToken) {
    return { valid: false, error: 'TELEGRAM_BOT_TOKEN is not configured on the server' };
  }

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      return { valid: false, error: 'No hash provided in initData' };
    }

    params.delete('hash');

    // Sort parameters alphabetically
    const dataCheckArr: string[] = [];
    const keys = Array.from(params.keys()).sort();
    for (const key of keys) {
      const val = params.get(key);
      if (val !== null) {
        dataCheckArr.push(`${key}=${val}`);
      }
    }
    const dataCheckString = dataCheckArr.join('\n');

    // HMAC-SHA256 signature calculation per Telegram standard
    // secret_key = HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();

    // calculatedHash = HMAC_SHA256(secretKey, dataCheckString).hex()
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash.toLowerCase() !== hash.toLowerCase()) {
      return {
        valid: false,
        error: 'Invalid signature: data check hash mismatch. Token or data is invalid.',
      };
    }

    const userRaw = params.get('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    const authDateRaw = params.get('auth_date');
    const authDate = authDateRaw ? parseInt(authDateRaw, 10) : undefined;
    const queryId = params.get('query_id') || undefined;

    return {
      valid: true,
      user,
      authDate,
      queryId,
    };
  } catch (err: any) {
    return { valid: false, error: err.message || 'Verification exception' };
  }
}

// 1. Endpoint: التحقق من صحة بيانات Telegram من جهة السيرفر
app.post('/api/telegram/validate', (req: Request, res: Response) => {
  const { initData, isSimulated } = req.body;

  if (!initData || typeof initData !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'initData is required',
      message: 'بيانات initData مفقودة من الطلب.',
    });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  // If simulated in test mode
  if (isSimulated && (!botToken || initData.includes('soulx_simulated=true'))) {
    try {
      const params = new URLSearchParams(initData);
      const userRaw = params.get('user');
      const user = userRaw ? JSON.parse(userRaw) : null;
      return res.json({
        success: true,
        verified: true,
        isSimulated: true,
        user,
        message: 'تم التحقق بنجاح (وضع المحاكاة التجريبي لاختبار الواجهة).',
      });
    } catch {
      // fallback
    }
  }

  if (!botToken) {
    // If token is missing, attempt to parse user data safely so app works in preview,
    // but clearly indicate that cryptographic verification requires the environment variable.
    try {
      const params = new URLSearchParams(initData);
      const userRaw = params.get('user');
      const user = userRaw ? JSON.parse(userRaw) : null;

      return res.status(200).json({
        success: true,
        verified: false,
        user,
        warning: 'TELEGRAM_BOT_TOKEN_NOT_CONFIGURED',
        message:
          'لم يتم تعيين TELEGRAM_BOT_TOKEN في متغيرات البيئة (.env). تم استخراج بيانات المستخدم ولكن لا يمكن اعتماد التوقيع التشفيري رسمياً حتى إضافة التوكن.',
      });
    } catch {
      return res.status(500).json({
        success: false,
        error: 'BOT_TOKEN_MISSING',
        message: 'متغير البيئة TELEGRAM_BOT_TOKEN غير محدد في السيرفر.',
      });
    }
  }

  const verification = verifyTelegramWebAppData(initData, botToken);

  if (!verification.valid) {
    return res.status(401).json({
      success: false,
      verified: false,
      error: verification.error,
      message: 'فشل التحقق الأمني من توقيع Telegram! البيانات قد تكون معدلة أو غير صالحة.',
    });
  }

  return res.json({
    success: true,
    verified: true,
    user: verification.user,
    authDate: verification.authDate,
    queryId: verification.queryId,
    message: 'تم التحقق من هوية المستخدم بنجاح ومطابقة التوقيع التشفيري مع بوت تيليجرام.',
  });
});

// 2. Endpoint: حالة إعداد بوت Telegram وتفاصيل البوت
app.get('/api/telegram/status', async (_req: Request, res: Response) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return res.json({
      configured: false,
      message: 'TELEGRAM_BOT_TOKEN is not set in environment variables',
      botInfo: null,
    });
  }

  // Mask token for security (e.g. 123456...abcd)
  const maskedToken =
    botToken.length > 10
      ? `${botToken.substring(0, 6)}...${botToken.substring(botToken.length - 4)}`
      : '***';

  try {
    // Fetch bot info from Telegram API
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json();

    if (data.ok) {
      return res.json({
        configured: true,
        maskedToken,
        botInfo: {
          id: data.result.id,
          is_bot: data.result.is_bot,
          first_name: data.result.first_name,
          username: data.result.username,
          can_join_groups: data.result.can_join_groups,
          can_read_all_group_messages: data.result.can_read_all_group_messages,
          supports_inline_queries: data.result.supports_inline_queries,
        },
      });
    } else {
      return res.json({
        configured: true,
        maskedToken,
        error: data.description || 'Failed to authenticate bot token with Telegram',
        botInfo: null,
      });
    }
  } catch (err: any) {
    return res.json({
      configured: true,
      maskedToken,
      error: err.message,
      botInfo: null,
    });
  }
});

// 3. Endpoint: تعيين زر القائمة Menu Button للبوت تلقائياً عبر API
app.post('/api/telegram/set-menu-button', async (req: Request, res: Response) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const { webAppUrl, buttonText } = req.body;

  if (!botToken) {
    return res.status(400).json({
      success: false,
      message: 'TELEGRAM_BOT_TOKEN is not configured in server environment.',
    });
  }

  if (!webAppUrl) {
    return res.status(400).json({
      success: false,
      message: 'webAppUrl is required.',
    });
  }

  try {
    const payload = {
      menu_button: {
        type: 'web_app',
        text: buttonText || '✨ Soul-X App',
        web_app: {
          url: webAppUrl,
        },
      },
    };

    const response = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (data.ok) {
      return res.json({
        success: true,
        message: 'تم تعيين زر Web App في بوت تيليجرام بنجاح! سيظهر للمستخدمين الآن زر لفتح التطبيق.',
        result: data.result,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: data.description || 'Failed to set menu button on Telegram',
      });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

// 4. Endpoint: محاكي البيانات للتجربة السريعة وإنشاء توقيع سري محاكي
app.post('/api/telegram/create-test-init-data', (req: Request, res: Response) => {
  const { user } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN || 'TEST_SOULX_BOT_TOKEN';

  const defaultUser = {
    id: 549182301,
    first_name: 'عبدالله',
    last_name: 'الناصر',
    username: 'soulx_user',
    language_code: 'ar',
    is_premium: true,
    photo_url: '',
  };

  const finalUser = user || defaultUser;
  const authDate = Math.floor(Date.now() / 1000);
  const queryId = 'AAHd...' + Math.random().toString(36).substring(7);

  const params: Record<string, string> = {
    auth_date: authDate.toString(),
    query_id: queryId,
    user: JSON.stringify(finalUser),
  };

  // Sort and build data check string
  const sortedKeys = Object.keys(params).sort();
  const dataCheckString = sortedKeys.map((k) => `${k}=${params[k]}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const searchParams = new URLSearchParams();
  for (const k of sortedKeys) {
    searchParams.set(k, params[k]);
  }
  searchParams.set('hash', hash);

  return res.json({
    success: true,
    initData: searchParams.toString(),
    user: finalUser,
  });
});

import { TelegramBotService } from './botService.js';

// Mount Vite or serve static assets
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Soul-X Server with Telegram WebApp verification running on http://0.0.0.0:${PORT}`);

    // Automatically run Telegram Bot if token is set in environment variables
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const appUrl =
      process.env.APP_URL ||
      'https://ais-dev-32ssckxg7udqcbjwij4dza-323115029859.europe-west2.run.app';

    if (botToken && botToken.trim().length > 0) {
      console.log('[Telegram Bot] Launching Telegram Bot service from environment variables...');
      const botService = new TelegramBotService(botToken.trim(), appUrl);
      botService.start();
    } else {
      console.log(
        '[Telegram Bot] TELEGRAM_BOT_TOKEN is not set in environment variables. Bot runner waiting for token in .env'
      );
    }
  });
}

startServer().catch((err) => {
  console.error('Server startup error:', err);
});
