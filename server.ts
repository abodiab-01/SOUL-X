import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { TelegramBotService } from './botService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

let activeBotService: TelegramBotService | null = null;

export function getActiveBotService(): TelegramBotService | null {
  return activeBotService;
}

export function startBotService(token: string, initialUrl?: string): TelegramBotService {
  if (activeBotService) {
    activeBotService.stop();
    activeBotService = null;
  }
  const appUrl = initialUrl || process.env.APP_URL || 'http://127.0.0.1:3000';
  activeBotService = new TelegramBotService(token.trim(), appUrl);
  activeBotService.start();
  return activeBotService;
}

app.use(express.json());

// Permit Telegram WebApp to embed and communicate smoothly
app.use((_req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org https://*.trycloudflare.com *;"
  );
  next();
});

// ==========================================
// Email Authentication & User Persistence
// ==========================================
interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  photoUrl?: string;
  birthDate?: string | null;
  gender?: 'male' | 'female' | null;
}

const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');

function hashPassword(password: string): string {
  return crypto.createHmac('sha256', 'SOULX_SALT_2026').update(password).digest('hex');
}

function getStoredUsers(): StoredUser[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading users file:', err);
  }
  return [];
}

function saveStoredUsers(users: StoredUser[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving users file:', err);
  }
}

// 1. Endpoint: التحقق من وجود البريد الإلكتروني
app.post('/api/auth/check-email', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
  }

  const normalized = email.trim().toLowerCase();
  const users = getStoredUsers();
  const user = users.find((u) => u.email.toLowerCase() === normalized);

  return res.json({
    success: true,
    exists: !!user,
    email: normalized,
    name: user ? user.name : undefined,
  });
});

// 2. Endpoint: تسجيل الدخول للمستخدم المسجل بكلمة المرور
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'البريد الإلكتروني وكلمة المرور مطلوبان',
    });
  }

  const normalized = email.trim().toLowerCase();
  const users = getStoredUsers();
  const user = users.find((u) => u.email.toLowerCase() === normalized);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'هذا البريد الإلكتروني غير مسجل، يرجى إنشاء حساب جديد',
    });
  }

  const hashed = hashPassword(password);
  if (user.passwordHash !== hashed) {
    return res.status(401).json({
      success: false,
      message: 'كلمة المرور غير صحيحة، يرجى التحقق وإعادة المحاولة',
    });
  }

  return res.json({
    success: true,
    message: `مرحباً بعودتك يا ${user.name}!`,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      photoUrl: user.photoUrl,
      createdAt: user.createdAt,
      birthDate: user.birthDate || null,
      gender: user.gender || null,
    },
  });
});

// 3. Endpoint: إنشاء حساب جديد بالاسم وكلمة المرور (تكرار الأسماء مسموح)
app.post('/api/auth/register', (req: Request, res: Response) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({
      success: false,
      message: 'يرجى كتابة البريد والاسم وكلمة المرور للمتابعة',
    });
  }

  const normalized = email.trim().toLowerCase();
  const users = getStoredUsers();

  if (users.some((u) => u.email.toLowerCase() === normalized)) {
    return res.status(409).json({
      success: false,
      message: 'هذا البريد مسجل مسبقاً، يرجى تسجيل الدخول بدلاً من ذلك',
    });
  }

  if (password.length < 4) {
    return res.status(400).json({
      success: false,
      message: 'كلمة المرور يجب أن لا تقل عن 4 خانات',
    });
  }

  // Duplicate names are allowed per requirement ("لا مشكلة من تكرار الأسماء")
  const newUser: StoredUser = {
    id: Math.floor(100000000 + Math.random() * 900000000).toString(),
    email: normalized,
    name: name.trim(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveStoredUsers(users);

  return res.json({
    success: true,
    message: `أهلاً بك يا ${newUser.name} في Soul-X! تم إنشاء حسابك بنجاح`,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      photoUrl: newUser.photoUrl,
      createdAt: newUser.createdAt,
      birthDate: null,
      gender: null,
    },
  });
});

// 4. Endpoint: تحديث بيانات الملف الشخصي
app.post('/api/auth/update-profile', (req: Request, res: Response) => {
  const { userId, name, birthDate, gender, photoUrl } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const users = getStoredUsers();
  const index = users.findIndex((u) => u.id === String(userId));
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
  }

  if (name) users[index].name = name.trim();
  if (birthDate !== undefined) users[index].birthDate = birthDate;
  if (gender !== undefined) users[index].gender = gender;
  if (photoUrl !== undefined) users[index].photoUrl = photoUrl;

  saveStoredUsers(users);

  const u = users[index];
  return res.json({
    success: true,
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      photoUrl: u.photoUrl,
      createdAt: u.createdAt,
      birthDate: u.birthDate,
      gender: u.gender,
    },
  });
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

// 2. Endpoint: حالة إعداد بوت Telegram وتفاصيل البوت والرابط العام الفعال
app.get('/api/telegram/status', async (_req: Request, res: Response) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const publicUrl = activeBotService?.getAppUrl() || null;
  const isTunnelActive = activeBotService?.isTunnelRunning() || false;

  if (!botToken) {
    return res.json({
      configured: false,
      message: 'TELEGRAM_BOT_TOKEN is not set in environment variables',
      botInfo: null,
      publicUrl,
      isTunnelActive,
    });
  }

  // Mask token for security (e.g. 123456...abcd)
  const maskedToken =
    botToken.length > 10
      ? `${botToken.substring(0, 6)}...${botToken.substring(botToken.length - 4)}`
      : '***';

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json();

    if (data.ok) {
      return res.json({
        configured: true,
        maskedToken,
        publicUrl,
        isTunnelActive,
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
        publicUrl,
        isTunnelActive,
        error: data.description || 'Failed to authenticate bot token with Telegram',
        botInfo: null,
      });
    }
  } catch (err: any) {
    return res.json({
      configured: true,
      maskedToken,
      publicUrl,
      isTunnelActive,
      error: err.message,
      botInfo: null,
    });
  }
});

// 3. Endpoint: تعيين زر القائمة Menu Button للبوت تلقائياً عبر API
app.post('/api/telegram/set-menu-button', async (req: Request, res: Response) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  let { webAppUrl, buttonText } = req.body;

  if (!botToken) {
    return res.status(400).json({
      success: false,
      message: 'TELEGRAM_BOT_TOKEN is not configured in server environment.',
    });
  }

  // Prefer active public tunnel URL if client provided localhost or dev URL
  const publicTunnelUrl = activeBotService?.getAppUrl();
  if (
    (!webAppUrl || webAppUrl.includes('ais-dev-') || webAppUrl.includes('localhost') || webAppUrl.includes('127.0.0.1')) &&
    publicTunnelUrl &&
    !publicTunnelUrl.includes('localhost')
  ) {
    webAppUrl = publicTunnelUrl;
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
        message: `تم تعيين زر Web App في بوت تيليجرام بنجاح! الرابط الفعال: ${webAppUrl}`,
        result: data.result,
        appliedUrl: webAppUrl,
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

// 4. Endpoint: حفظ توكن البوت وتشغيل الخدمة فورياً
app.post('/api/telegram/configure', async (req: Request, res: Response) => {
  const { botToken } = req.body;
  if (!botToken || typeof botToken !== 'string' || !botToken.trim()) {
    return res.status(400).json({ success: false, message: 'botToken مطلوب' });
  }

  const cleanToken = botToken.trim();
  try {
    const testRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const testData = await testRes.json();
    if (!testData.ok) {
      return res.status(400).json({
        success: false,
        message: `توكن تيليجرام غير صحيح: ${testData.description || 'فشل المصادقة'}`,
      });
    }

    process.env.TELEGRAM_BOT_TOKEN = cleanToken;

    // Save to .env file for persistence
    const envPath = path.resolve(__dirname, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf-8');
      if (envContent.includes('TELEGRAM_BOT_TOKEN=')) {
        envContent = envContent.replace(/TELEGRAM_BOT_TOKEN=.*/, `TELEGRAM_BOT_TOKEN=${cleanToken}`);
      } else {
        envContent += `\nTELEGRAM_BOT_TOKEN=${cleanToken}\n`;
      }
    } else {
      envContent = `TELEGRAM_BOT_TOKEN=${cleanToken}\n`;
    }
    fs.writeFileSync(envPath, envContent, 'utf-8');

    // Launch or restart bot service
    startBotService(cleanToken);

    return res.json({
      success: true,
      message: `تم تشغيل البوت بنجاح! متصل كـ @${testData.result.username} (${testData.result.first_name})`,
      botInfo: testData.result,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Endpoint: محاكي البيانات للتجربة السريعة وإنشاء توقيع سري محاكي
app.post('/api/telegram/create-test-init-data', (req: Request, res: Response) => {
  const { user } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN || 'TEST_SOULX_BOT_TOKEN';

  const defaultUser = {
    id: 549182301,
    first_name: 'سلطان',
    last_name: 'الشمري',
    username: 'sultan_sh',
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
    console.log(`Soul-X Server running on http://0.0.0.0:${PORT}`);

    // Automatically run Telegram Bot if token is configured
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (botToken && botToken.trim().length > 0) {
      console.log('[Telegram Bot] Starting bot service from environment variables...');
      startBotService(botToken.trim());
    } else {
      console.log(
        '[Telegram Bot] TELEGRAM_BOT_TOKEN is not set in environment variables. Ready for setup.'
      );
    }
  });
}

startServer().catch((err) => {
  console.error('Server startup error:', err);
});

process.on('SIGINT', () => {
  activeBotService?.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  activeBotService?.stop();
  process.exit(0);
});
