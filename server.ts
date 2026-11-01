import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { TelegramBotService } from './botService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ==========================================
// Supabase Backend Client Initialization
// ==========================================
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_ANON_KEY = (
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();
const SUPABASE_KEY = (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY).trim();

const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_KEY &&
  SUPABASE_URL.startsWith('http')
);

export const supabaseAdmin = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

if (supabaseAdmin) {
  console.log(`⚡ Supabase Database & Auth connected successfully: ${SUPABASE_URL}`);
  if (SUPABASE_SERVICE_ROLE_KEY) {
    console.log('🔑 Service Role Key detected: Full administrative database & auth access enabled.');
  } else {
    console.log('🔑 Anon Key detected: Standard database & auth access enabled.');
  }
} else {
  console.log('ℹ️ Supabase credentials not detected yet in env, running in resilient fallback mode.');
}

// Automatically ensure 'soul-x' storage bucket exists in Supabase
async function ensureSupabaseBucket() {
  if (!supabaseAdmin) return;
  try {
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    if (!error && buckets) {
      const exists = buckets.some((b: any) => b.id === 'soul-x' || b.name === 'soul-x');
      if (!exists) {
        await supabaseAdmin.storage.createBucket('soul-x', { public: true });
        console.log('⚡ Supabase Storage bucket [soul-x] created successfully.');
      } else {
        console.log('⚡ Supabase Storage bucket [soul-x] verified.');
      }
    }
  } catch (err) {
    console.warn('Supabase storage bucket initialization warning:', err);
  }
}

if (supabaseAdmin) {
  ensureSupabaseBucket().catch(() => {});
}

// Helper to resolve displayId or uuid to profile UUID
async function resolveProfileId(userIdOrDisplayId: string): Promise<string> {
  const clean = String(userIdOrDisplayId || '').trim();
  if (!supabaseAdmin || !clean) return clean;
  // If already in uuid format
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) {
    return clean;
  }
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`display_id.eq.${clean},email.eq.${clean.toLowerCase()}`)
      .maybeSingle();
    if (data?.id) return data.id;
  } catch {}
  return clean;
}

function withTimeout<T>(promise: PromiseLike<T> | Promise<T>, ms = 1200): Promise<T | null> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

let activeBotService: TelegramBotService | null = null;

export function getActiveBotService(): TelegramBotService | null {
  return activeBotService;
}

export function startBotService(token: string, initialUrl?: string): TelegramBotService {
  if (activeBotService) {
    activeBotService.stop();
    activeBotService = null;
  }
  const appUrl = initialUrl || process.env.APP_URL || 'https://soul-x.onrender.com';
  activeBotService = new TelegramBotService(token.trim(), appUrl);
  activeBotService.start();
  return activeBotService;
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Telegram Bot Web App URL configuration (strictly anchored to https://soul-x.onrender.com)
app.use((_req, _res, next) => {
  if (activeBotService) {
    const currentUrl = activeBotService.getAppUrl();
    if (!currentUrl || currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
      activeBotService.updateAppUrl('https://soul-x.onrender.com');
    }
  }
  next();
});

// ==========================================
// Email Authentication & User Persistence
// ==========================================
interface StoredUser {
  id: string;
  displayId?: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
  photoUrl?: string;
  birthDate?: string | null;
  gender?: 'male' | 'female' | null;
  walletBalance?: number;
}

interface StoredSession {
  token: string;
  userId: string;
  displayId?: string;
  email: string;
  name: string;
  isAdmin?: boolean;
  createdAt: string;
  lastActiveAt: string;
}

const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const USERS_FILE = path.resolve(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.resolve(DATA_DIR, 'sessions.json');

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

function getStoredSessions(): StoredSession[] {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = fs.readFileSync(SESSIONS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading sessions file:', err);
  }
  return [];
}

function saveStoredSessions(sessions: StoredSession[]) {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving sessions file:', err);
  }
}

function createSession(userId: string, email: string, name: string, isAdmin = false, displayId?: string): string {
  const token = `sx_${crypto.randomBytes(32).toString('hex')}`;
  const sessions = getStoredSessions();
  const now = new Date().toISOString();
  // Filter out any older session for the same user
  const updated = sessions.filter((s) => s.userId !== userId && s.email.toLowerCase() !== email.toLowerCase());
  updated.push({
    token,
    userId,
    displayId,
    email: email.toLowerCase(),
    name,
    isAdmin,
    createdAt: now,
    lastActiveAt: now,
  });
  saveStoredSessions(updated);
  return token;
}

function revokeSession(token: string) {
  if (!token) return;
  const sessions = getStoredSessions();
  const updated = sessions.filter((s) => s.token !== token);
  saveStoredSessions(updated);
}

async function verifyToken(token: string): Promise<{ valid: boolean; user?: any; isAdmin?: boolean; reason?: string }> {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'التوكن مفقود أو غير صالح' };
  }

  // 1. Check if token is the master admin token
  const expectedAdminToken = generateAdminToken();
  if (expectedAdminToken && token === expectedAdminToken) {
    const adminEmails = getAdminEmails();
    if (adminEmails.length > 0) {
      const primaryAdmin = adminEmails[0];
      return {
        valid: true,
        isAdmin: true,
        user: {
          id: 'admin-1001',
          name: 'مدير النظام (ADMIN)',
          email: primaryAdmin,
          createdAt: new Date().toISOString(),
          birthDate: '1995-01-01',
          gender: 'male',
        },
      };
    }
  }

  // 2. Check local stored active sessions
  const sessions = getStoredSessions();
  const session = sessions.find((s) => s.token === token);
  if (session) {
    let userRecord: any = null;

    if (supabaseAdmin) {
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .or(`id.eq.${session.userId},display_id.eq.${session.userId},email.eq.${session.email}`)
          .maybeSingle();

        if (profile) {
          userRecord = {
            id: profile.id,
            displayId: profile.display_id,
            name: profile.name,
            email: profile.email,
            photoUrl: profile.avatar_url,
            createdAt: profile.created_at,
            birthDate: profile.birth_date || null,
            gender: profile.gender || null,
          };
        }
      } catch {}
    }

    if (!userRecord) {
      const users = getStoredUsers();
      const localUser = users.find(
        (u) => u.id === session.userId || u.email.toLowerCase() === session.email.toLowerCase()
      );
      if (localUser) {
        userRecord = {
          id: localUser.id,
          displayId: localUser.displayId || session.displayId,
          name: localUser.name,
          email: localUser.email,
          photoUrl: localUser.photoUrl,
          createdAt: localUser.createdAt,
          birthDate: localUser.birthDate || null,
          gender: localUser.gender || null,
          walletBalance: localUser.walletBalance ?? 1250,
        };
      } else {
        userRecord = {
          id: session.userId,
          displayId: session.displayId,
          name: session.name,
          email: session.email,
          createdAt: session.createdAt,
          birthDate: null,
          gender: null,
          walletBalance: 1250,
        };
      }
    }

    // Touch lastActiveAt
    session.lastActiveAt = new Date().toISOString();
    saveStoredSessions(sessions);

    const adminEmails = getAdminEmails();
    const isAdmin = Boolean(session.isAdmin || adminEmails.includes(session.email.toLowerCase()));

    return {
      valid: true,
      isAdmin,
      user: userRecord,
    };
  }

  // 3. Fallback to Supabase Auth token verification
  if (supabaseAdmin) {
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && user) {
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        const userObj = {
          id: profile?.id || user.id,
          displayId: profile?.display_id,
          name: profile?.name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          email: profile?.email || user.email,
          photoUrl: profile?.avatar_url || null,
          createdAt: profile?.created_at || user.created_at,
          birthDate: profile?.birth_date || null,
          gender: profile?.gender || null,
        };

        const adminEmails = getAdminEmails();
        const isAdmin = adminEmails.includes((userObj.email || '').toLowerCase());

        return {
          valid: true,
          isAdmin,
          user: userObj,
        };
      }
    } catch {}
  }

  return { valid: false, reason: 'انتهت صلاحية جلسة التوكن أو تم تسجيل الخروج وحذف الجلسة' };
}

// ==========================================
// Friends & Messages Persistent Data
// ==========================================
interface StoredFriendship {
  id: string;
  userId: string;
  friendId: string;
  createdAt: string;
}

interface StoredFriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  senderName: string;
  receiverName: string;
  senderAvatar?: string;
  senderBio?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

interface StoredMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
}

interface StoredConversation {
  id: string;
  participants: string[];
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
}

const FRIENDS_FILE = path.resolve(DATA_DIR, 'friends.json');
const MESSAGES_FILE = path.resolve(DATA_DIR, 'messages.json');

function getStoredFriendsData(): { friends: StoredFriendship[]; requests: StoredFriendRequest[] } {
  try {
    if (fs.existsSync(FRIENDS_FILE)) {
      return JSON.parse(fs.readFileSync(FRIENDS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading friends file:', err);
  }
  return { friends: [], requests: [] };
}

function saveStoredFriendsData(data: { friends: StoredFriendship[]; requests: StoredFriendRequest[] }) {
  try {
    fs.writeFileSync(FRIENDS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving friends file:', err);
  }
}

function getStoredMessagesData(): { conversations: StoredConversation[] } {
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      return JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading messages file:', err);
  }
  return { conversations: [] };
}

function saveStoredMessagesData(data: { conversations: StoredConversation[] }) {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving messages file:', err);
  }
}

// ==========================================
// Supabase Configuration & Status Endpoints
// ==========================================
app.get('/api/supabase/config', (_req: Request, res: Response) => {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  return res.json({
    configured: Boolean(url && anonKey && url.startsWith('http')),
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
  });
});

app.get('/api/supabase/status', async (_req: Request, res: Response) => {
  if (!supabaseAdmin) {
    return res.json({
      configured: false,
      message: 'بيانات Supabase غير محددة في متغيرات البيئة (SUPABASE_URL و SUPABASE_ANON_KEY)',
      hasServiceKey: false,
      hasAnonKey: false,
      databaseConnected: false,
      profilesTableReady: false,
      storageBucketReady: false,
    });
  }

  let dbConnected = false;
  let profilesTableReady = false;
  let profilesCount = 0;
  let storageBucketReady = false;
  let errorDetail: string | null = null;

  try {
    const { count, error } = await supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (!error) {
      dbConnected = true;
      profilesTableReady = true;
      profilesCount = typeof count === 'number' ? count : 0;
    } else {
      errorDetail = error.message;
    }
  } catch (err: any) {
    errorDetail = err?.message;
  }

  try {
    const { data: bucket, error: bucketErr } = await supabaseAdmin.storage.getBucket('soul-x');
    if (!bucketErr && bucket) {
      storageBucketReady = true;
    } else {
      // Try listing
      const { data: buckets } = await supabaseAdmin.storage.listBuckets();
      storageBucketReady = Boolean(buckets?.some((b: any) => b.id === 'soul-x' || b.name === 'soul-x'));
    }
  } catch {}

  return res.json({
    configured: true,
    supabaseUrl: SUPABASE_URL,
    hasServiceKey: Boolean(SUPABASE_SERVICE_ROLE_KEY),
    hasAnonKey: Boolean(SUPABASE_ANON_KEY),
    databaseConnected: dbConnected,
    profilesTableReady,
    profilesCount,
    storageBucketReady,
    errorDetail,
    message: dbConnected
      ? 'متصل بقاعدة بيانات Supabase بنجاح وجميع الجداول جاهزة'
      : 'بيانات الاتصال موجودة، ولكن تعذر الاتصال بجدول profiles (تأكد من تشغيل ملف الهجرة sql)',
  });
});

// Update Wallet Balance in Supabase & Local Cache
app.post('/api/wallet/update', async (req: Request, res: Response) => {
  const { userId, amount, balance } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const cleanUserId = String(userId);
  let newBalance = balance;

  if (supabaseAdmin) {
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, wallet_balance')
        .or(`id.eq.${cleanUserId},display_id.eq.${cleanUserId}`)
        .maybeSingle();

      if (profile) {
        newBalance =
          typeof balance === 'number'
            ? balance
            : (profile.wallet_balance || 1250) + (amount || 0);

        await supabaseAdmin
          .from('profiles')
          .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
          .eq('id', profile.id);
      }
    } catch (e) {
      console.warn('Wallet balance update warning in Supabase:', e);
    }
  }

  return res.json({
    success: true,
    walletBalance: newBalance,
    message: 'تم تحديث رصيد المحفظة في Supabase بنجاح',
  });
});

// 1. Endpoint: التحقق من وجود البريد الإلكتروني
app.post('/api/auth/check-email', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
  }

  const normalized = email.trim().toLowerCase();
  const adminEmails = getAdminEmails();
  const isAdminEmail = adminEmails.includes(normalized);

  // Instant response for admin accounts (ADMIN1 and ADMIN2)
  if (isAdminEmail) {
    const users = getStoredUsers();
    const user = users.find((u) => u.email.toLowerCase() === normalized);
    return res.json({
      success: true,
      exists: true,
      email: normalized,
      name: user ? user.name : 'مدير النظام',
      isAdmin: true,
    });
  }

  // Check in Supabase Database first
  if (supabaseAdmin) {
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email')
        .eq('email', normalized)
        .maybeSingle();

      if (profile) {
        return res.json({
          success: true,
          exists: true,
          email: normalized,
          name: profile.name,
        });
      }
    } catch (dbErr) {
      console.warn('Supabase profile check query warning:', dbErr);
    }
  }

  // Fallback to local stored users
  const users = getStoredUsers();
  const user = users.find((u) => u.email.toLowerCase() === normalized);

  return res.json({
    success: true,
    exists: !!user,
    email: normalized,
    name: user ? user.name : undefined,
    isAdmin: false,
  });
});

// 2. Endpoint: تسجيل الدخول للمستخدم المسجل بكلمة المرور
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'البريد الإلكتروني وكلمة المرور مطلوبان',
    });
  }

  const normalized = email.trim().toLowerCase();
  const adminEmails = getAdminEmails();
  const isAdminEmail = adminEmails.includes(normalized);

  // If this is an ADMIN1 or ADMIN2 account, allow instant login with ADMIN_PIN or user password
  if (isAdminEmail) {
    const adminPin = getAdminPin();
    const isPinMatch = Boolean(adminPin && password.trim() === adminPin);
    const users = getStoredUsers();
    let user = users.find((u) => u.email.toLowerCase() === normalized);
    const isPassMatch = user && user.passwordHash === hashPassword(password);

    if (isPinMatch || isPassMatch) {
      if (!user) {
        user = {
          id: normalized === (process.env.ADMIN1 || '').toLowerCase() ? 'admin-1001' : 'admin-1002',
          email: normalized,
          name: normalized === (process.env.ADMIN1 || '').toLowerCase() ? 'مدير النظام (ADMIN1)' : 'مدير النظام (ADMIN2)',
          passwordHash: hashPassword(password),
          createdAt: new Date().toISOString(),
          birthDate: '1995-01-01',
          gender: 'male',
        };
        users.push(user);
        saveStoredUsers(users);
      }

      const token = createSession(user.id, user.email, user.name, true);
      return res.json({
        success: true,
        message: `مرحباً بك يا ${user.name}! تم تسجيل الدخول بنجاح`,
        token,
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
    }
  }

  // Try Supabase Auth first
  if (supabaseAdmin) {
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email: normalized,
        password,
      });

      if (!authError && authData.user) {
        // Fetch full profile from Supabase Database
        let { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        // If profile record does not exist in profiles table yet, create it now!
        if (!profile) {
          const displayId = Math.floor(100000000 + Math.random() * 900000000).toString();
          const newProfile = {
            id: authData.user.id,
            display_id: displayId,
            email: normalized,
            name: authData.user.user_metadata?.name || normalized.split('@')[0],
            wallet_balance: 1250,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await supabaseAdmin.from('profiles').upsert(newProfile, { onConflict: 'id' });
          profile = newProfile as any;
        }

        const userObj = {
          id: profile?.id || authData.user.id,
          displayId: profile?.display_id,
          name: profile?.name || authData.user.user_metadata?.name || normalized.split('@')[0],
          email: profile?.email || authData.user.email || normalized,
          photoUrl: profile?.avatar_url || null,
          createdAt: profile?.created_at || authData.user.created_at,
          birthDate: profile?.birth_date || null,
          gender: profile?.gender || null,
          walletBalance: profile?.wallet_balance ?? 1250,
        };

        const sessionToken = createSession(userObj.id, userObj.email, userObj.name, isAdminEmail);

        return res.json({
          success: true,
          message: `مرحباً بعودتك يا ${userObj.name}!`,
          token: sessionToken,
          supabaseToken: authData.session?.access_token,
          user: userObj,
        });
      }
    } catch (supaErr) {
      console.warn('Supabase signInWithPassword exception, checking fallback:', supaErr);
    }
  }

  // Fallback to local stored users
  const users = getStoredUsers();
  let user = users.find((u) => u.email.toLowerCase() === normalized);

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

  const token = createSession(user.id, user.email, user.name, isAdminEmail);

  return res.json({
    success: true,
    message: `مرحباً بعودتك يا ${user.name}!`,
    token,
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

// 3. Endpoint: إنشاء حساب جديد بالاسم وكلمة المرور في Supabase Auth وقاعدة البيانات
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({
      success: false,
      message: 'يرجى كتابة البريد والاسم وكلمة المرور للمتابعة',
    });
  }

  const normalized = email.trim().toLowerCase();

  if (password.length < 4) {
    return res.status(400).json({
      success: false,
      message: 'كلمة المرور يجب أن لا تقل عن 4 خانات',
    });
  }

  const users = getStoredUsers();
  const displayId = Math.floor(100000000 + Math.random() * 900000000).toString();
  let createdUserId = displayId;
  let authToken: string | undefined;

  // Supabase Auth & Database registration
  if (supabaseAdmin) {
    try {
      let authUser: any = null;

      // 1. If service role key is configured, use admin.createUser to create pre-confirmed user
      if (SUPABASE_SERVICE_ROLE_KEY && (supabaseAdmin.auth as any).admin) {
        try {
          const { data: adminData, error: adminErr } = await (supabaseAdmin.auth as any).admin.createUser({
            email: normalized,
            password,
            email_confirm: true,
            user_metadata: {
              name: name.trim(),
              display_id: displayId,
            },
          });
          if (!adminErr && adminData?.user) {
            authUser = adminData.user;
          } else if (adminErr && adminErr.message.toLowerCase().includes('already registered')) {
            return res.status(409).json({
              success: false,
              message: 'هذا البريد مسجل مسبقاً، يرجى تسجيل الدخول بدلاً من ذلك',
            });
          }
        } catch (adminEx) {
          console.warn('Admin createUser exception:', adminEx);
        }
      }

      // 2. Standard signUp fallback
      if (!authUser) {
        const { data: authData, error: authError } = await supabaseAdmin.auth.signUp({
          email: normalized,
          password,
          options: {
            data: {
              name: name.trim(),
              display_id: displayId,
            },
          },
        });

        if (authError) {
          if (authError.message.toLowerCase().includes('already registered')) {
            return res.status(409).json({
              success: false,
              message: 'هذا البريد مسجل مسبقاً، يرجى تسجيل الدخول بدلاً من ذلك',
            });
          }
          console.warn('Supabase Auth signUp warning:', authError.message);
        }

        if (authData?.user) {
          authUser = authData.user;
        }
      }

      if (authUser) {
        createdUserId = authUser.id;

        // Upsert into public.profiles in Supabase Database
        await supabaseAdmin
          .from('profiles')
          .upsert(
            {
              id: createdUserId,
              display_id: displayId,
              email: normalized,
              name: name.trim(),
              wallet_balance: 1250,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          );
      }
    } catch (supaErr) {
      console.warn('Supabase register error, using fallback:', supaErr);
    }
  }

  // Also maintain local fallback
  if (users.some((u) => u.email.toLowerCase() === normalized)) {
    return res.status(409).json({
      success: false,
      message: 'هذا البريد مسجل مسبقاً، يرجى تسجيل الدخول بدلاً من ذلك',
    });
  }

  const newUser: StoredUser = {
    id: createdUserId,
    displayId,
    email: normalized,
    name: name.trim(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    walletBalance: 1250,
  };

  users.push(newUser);
  saveStoredUsers(users);

  const sessionToken = createSession(newUser.id, newUser.email, newUser.name, false, displayId);

  return res.json({
    success: true,
    message: `أهلاً بك يا ${newUser.name} في Soul-X! تم إنشاء حسابك بنجاح`,
    token: sessionToken,
    user: {
      id: newUser.id,
      displayId,
      name: newUser.name,
      email: newUser.email,
      photoUrl: newUser.photoUrl,
      createdAt: newUser.createdAt,
      birthDate: null,
      gender: null,
      walletBalance: 1250,
    },
  });
});

// 3.1 Endpoint: التحقق من صحة جلسة التوكن (Token Verification)
app.get('/api/auth/verify', async (req: Request, res: Response) => {
  const authHeader = (req.headers['authorization'] as string) || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'رمز التحقق (Token) مفقود، يرجى تسجيل الدخول مجدداً',
    });
  }

  const result = await verifyToken(token);
  if (!result.valid || !result.user) {
    return res.status(401).json({
      success: false,
      message: result.reason || 'جلسة التوكن منتهية أو غير صالحة',
    });
  }

  return res.json({
    success: true,
    user: result.user,
    isAdmin: Boolean(result.isAdmin),
  });
});

// 3.2 Endpoint: تسجيل الخروج الفعلي وحذف الجلسة بالكامل من الخادم
app.post('/api/auth/logout', async (req: Request, res: Response) => {
  const authHeader = (req.headers['authorization'] as string) || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

  if (token) {
    revokeSession(token);
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.auth.signOut();
      } catch {}
    }
  }

  return res.json({
    success: true,
    message: 'تم تسجيل الخروج بنجاح وإلغاء جلسة التوكن بالكامل.',
  });
});

// Helper to verify user identity and prevent modifying another user's profile/assets
async function verifyUserOwnership(req: Request, targetUserId: string): Promise<{ authorized: boolean; reason?: string }> {
  const cleanTargetId = String(targetUserId).trim();
  const authHeader = (req.headers['authorization'] as string) || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  const pinHeader = (req.headers['x-admin-pin'] as string) || '';

  // Admin PIN bypass
  const adminPin = getAdminPin();
  if (adminPin && pinHeader && pinHeader.trim() === adminPin) {
    return { authorized: true };
  }

  if (!token) {
    return { authorized: false, reason: 'مطلوب توكن تسجيل الدخول (Bearer token) لتعديل أو حذف البيانات' };
  }

  const verification = await verifyToken(token);
  if (!verification.valid || !verification.user) {
    return { authorized: false, reason: verification.reason || 'جلسة تسجيل الدخول غير صالحة أو منتهية' };
  }

  if (verification.isAdmin) {
    return { authorized: true };
  }

  if (
    verification.user.id === cleanTargetId ||
    verification.user.displayId === cleanTargetId ||
    String(verification.user.email).toLowerCase() === cleanTargetId.toLowerCase()
  ) {
    return { authorized: true };
  }

  return { authorized: false, reason: 'غير مصرح لك بتعديل أو حذف بيانات مستخدم آخر (حماية البيانات)' };
}

// 4. Endpoint: تحديث بيانات الملف الشخصي في Supabase Database
app.post('/api/auth/update-profile', async (req: Request, res: Response) => {
  const { userId, name, birthDate, gender, photoUrl, bio } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const cleanUserId = String(userId);

  // Enforce user isolation: prevent modifying another user's profile
  const authCheck = await verifyUserOwnership(req, cleanUserId);
  if (!authCheck.authorized) {
    return res.status(403).json({ success: false, message: authCheck.reason });
  }

  // Update in Supabase Database profiles table
  if (supabaseAdmin) {
    try {
      const updates: any = { updated_at: new Date().toISOString() };
      if (name) updates.name = name.trim();
      if (birthDate !== undefined) updates.birth_date = birthDate;
      if (gender !== undefined) updates.gender = gender;
      if (photoUrl !== undefined) updates.avatar_url = photoUrl;
      if (bio !== undefined) updates.bio = bio;

      await supabaseAdmin
        .from('profiles')
        .update(updates)
        .or(`id.eq.${cleanUserId},display_id.eq.${cleanUserId}`);
    } catch (supaErr) {
      console.warn('Supabase update profile error:', supaErr);
    }
  }

  // Also update stored users
  const users = getStoredUsers();
  const index = users.findIndex((u) => u.id === cleanUserId);
  if (index !== -1) {
    if (name) users[index].name = name.trim();
    if (birthDate !== undefined) users[index].birthDate = birthDate;
    if (gender !== undefined) users[index].gender = gender;
    if (photoUrl !== undefined) users[index].photoUrl = photoUrl;
    saveStoredUsers(users);
  }

  return res.json({
    success: true,
    message: 'تم تحديث الملف الشخصي بنجاح',
    user: {
      id: cleanUserId,
      name: name ? name.trim() : undefined,
      birthDate,
      gender,
      photoUrl,
    },
  });
});

// 5. Endpoint: رفع الصورة الشخصية إلى Supabase Storage (Bucket: soul-x) وحفظ المسار في قاعدة البيانات
app.post('/api/profile/upload-avatar', async (req: Request, res: Response) => {
  try {
    const { userId, fileName, fileData, contentType } = req.body;
    if (!userId || !fileData) {
      return res.status(400).json({
        success: false,
        message: 'معرف المستخدم وبيانات الصورة مطلوبة',
      });
    }

    const cleanUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, '');

    // Enforce user isolation: prevent uploading avatars under another user's account
    const authCheck = await verifyUserOwnership(req, cleanUserId);
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, message: authCheck.reason });
    }

    let mimeType = contentType || 'image/jpeg';
    let base64Body = fileData;

    if (fileData.includes(';base64,')) {
      const parts = fileData.split(';base64,');
      mimeType = parts[0].replace('data:', '') || mimeType;
      base64Body = parts[1];
    }

    const buffer = Buffer.from(base64Body, 'base64');
    const ext = fileName && fileName.includes('.') ? fileName.split('.').pop() : mimeType.split('/')[1] || 'jpg';
    const storagePath = `avatars/${cleanUserId}-${Date.now()}.${ext}`;

    let avatarUrl = '';

    // Upload to Supabase Storage bucket 'soul-x'
    if (supabaseAdmin) {
      try {
        const { data: uploadData, error: uploadErr } = await supabaseAdmin.storage
          .from('soul-x')
          .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (uploadErr) {
          console.error('Supabase soul-x storage upload error:', uploadErr.message);
        } else if (uploadData) {
          const { data: publicUrlData } = supabaseAdmin.storage
            .from('soul-x')
            .getPublicUrl(storagePath);

          avatarUrl = publicUrlData?.publicUrl || '';
        }

        // Link avatar path/URL in Supabase Database profiles table
        if (avatarUrl) {
          await supabaseAdmin
            .from('profiles')
            .update({
              avatar_url: avatarUrl,
              updated_at: new Date().toISOString(),
            })
            .or(`id.eq.${cleanUserId},display_id.eq.${cleanUserId}`);
        }
      } catch (supaUploadErr) {
        console.error('Supabase upload exception:', supaUploadErr);
      }
    }

    // Fallback if Supabase not ready yet
    if (!avatarUrl) {
      avatarUrl = fileData.startsWith('data:') ? fileData : `data:${mimeType};base64,${base64Body}`;
    }

    // Keep stored users in sync
    const users = getStoredUsers();
    const u = users.find((x) => x.id === cleanUserId);
    if (u) {
      u.photoUrl = avatarUrl;
      saveStoredUsers(users);
    }

    return res.json({
      success: true,
      avatarUrl,
      bucket: 'soul-x',
      path: storagePath,
      message: 'تم رفع الصورة بنجاح إلى Supabase Storage وربطها بالملف الشخصي',
    });
  } catch (err: any) {
    console.error('Upload avatar endpoint error:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء رفع الصورة',
    });
  }
});

// 6. Endpoint: حذف الصورة الشخصية من Supabase Storage (Bucket: soul-x) وقاعدة البيانات
app.post('/api/profile/delete-avatar', async (req: Request, res: Response) => {
  try {
    const { userId, avatarUrl } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }

    const cleanUserId = String(userId);

    // Enforce user isolation: prevent deleting another user's avatar
    const authCheck = await verifyUserOwnership(req, cleanUserId);
    if (!authCheck.authorized) {
      return res.status(403).json({ success: false, message: authCheck.reason });
    }

    // Delete from Supabase Storage and clear avatar_url in Database
    if (supabaseAdmin) {
      try {
        if (avatarUrl && avatarUrl.includes('/soul-x/')) {
          const parts = avatarUrl.split('/soul-x/');
          if (parts.length > 1) {
            const pathInBucket = decodeURIComponent(parts[1]);
            await supabaseAdmin.storage.from('soul-x').remove([pathInBucket]);
          }
        }

        await supabaseAdmin
          .from('profiles')
          .update({
            avatar_url: null,
            updated_at: new Date().toISOString(),
          })
          .or(`id.eq.${cleanUserId},display_id.eq.${cleanUserId}`);
      } catch (supaDeleteErr) {
        console.error('Supabase delete avatar error:', supaDeleteErr);
      }
    }

    // Local fallback
    const users = getStoredUsers();
    const u = users.find((x) => x.id === cleanUserId);
    if (u) {
      u.photoUrl = undefined;
      saveStoredUsers(users);
    }

    return res.json({
      success: true,
      message: 'تم حذف الصورة من Supabase Storage وإلغاء ربطها بالملف الشخصي',
    });
  } catch (err: any) {
    console.error('Delete avatar error:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء حذف الصورة',
    });
  }
});

// 7. Endpoint: تحديث رصيد المحفظة (الماسات) في Supabase وقاعدة البيانات
app.post('/api/wallet/update', async (req: Request, res: Response) => {
  try {
    const { userId, balance } = req.body;
    if (!userId || typeof balance !== 'number') {
      return res.status(400).json({ success: false, message: 'معرف المستخدم والرصيد مطلوبان' });
    }

    const cleanUserId = String(userId);

    // Update in Supabase profiles table
    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('profiles')
          .update({
            wallet_balance: Math.max(0, balance),
            updated_at: new Date().toISOString(),
          })
          .or(`id.eq.${cleanUserId},display_id.eq.${cleanUserId}`);
      } catch (err) {
        console.warn('Supabase wallet balance update error:', err);
      }
    }

    return res.json({
      success: true,
      balance: Math.max(0, balance),
      message: 'تم تحديث رصيد المحفظة بنجاح',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Endpoint: بحث عن مستخدم بالمعرف أو الاسم (بيانات حقيقية فقط من قاعدة البيانات)
app.get('/api/users/search', async (req: Request, res: Response) => {
  const query = ((req.query.q as string) || '').trim().toLowerCase();
  const currentUserId = ((req.query.currentUserId as string) || '').trim();
  const storedUsers = getStoredUsers();

  // Fetch real profiles from Supabase Database
  let supabaseProfiles: any[] = [];
  if (supabaseAdmin) {
    try {
      const { data: dbProfiles } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .limit(200);

      if (dbProfiles) {
        supabaseProfiles = dbProfiles.map((p) => ({
          id: p.display_id || p.id,
          name: p.name,
          nameEn: undefined,
          username: p.email ? p.email.split('@')[0] : p.display_id,
          bio: p.bio || 'مستخدم مسجل في منصة Soul-X ✨',
          avatar: p.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
          gender: p.gender || null,
          age: p.birth_date ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)) : 25,
          location: 'الرياض',
          matchScore: 95,
          status: 'online' as const,
        }));
      }
    } catch (e) {
      console.warn('Could not query Supabase profiles:', e);
    }
  }

  // Real registered users from local storage
  const mappedStored = storedUsers.map((u) => ({
    id: u.id,
    name: u.name,
    nameEn: undefined as string | undefined,
    username: u.email.split('@')[0],
    bio: 'مستخدم مسجل في منصة Soul-X ✨',
    avatar:
      u.photoUrl ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    gender: u.gender || null,
    age: u.birthDate ? Math.floor((Date.now() - new Date(u.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000)) : 25,
    location: 'الرياض',
    matchScore: 92,
    status: 'online' as const,
  }));

  // Merge unique real users only - ZERO mock users
  const combined = [
    ...supabaseProfiles,
    ...mappedStored.filter((m) => !supabaseProfiles.some((s) => s.id === m.id)),
  ].filter((u) => !currentUserId || u.id !== currentUserId);

  if (!query) {
    return res.json({ success: true, users: combined });
  }

  const results = combined.filter(
    (u) =>
      u.id.toLowerCase().includes(query) ||
      u.name.toLowerCase().includes(query) ||
      (u.nameEn && u.nameEn.toLowerCase().includes(query)) ||
      (u.username && u.username.toLowerCase().includes(query.replace('@', '')))
  );

  return res.json({ success: true, users: results });
});

// 6. Endpoint: قائمة الأصدقاء والطلبات الحقيقية للمستخدم من Supabase وقاعدة البيانات
app.get('/api/friends/list', async (req: Request, res: Response) => {
  const userId = ((req.query.userId as string) || '').trim();
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const localData = getStoredFriendsData();
  const allUsers = getStoredUsers();

  let friendsList: any[] = [];
  let incomingRequests: any[] = [];
  let sentRequests: any[] = [];

  if (supabaseAdmin) {
    try {
      const resolvedUid = await resolveProfileId(userId);

      // 1. Fetch friendships from Supabase public.friends
      const { data: dbFriendships } = await supabaseAdmin
        .from('friends')
        .select('user_id, friend_id')
        .or(`user_id.eq.${resolvedUid},friend_id.eq.${resolvedUid}`);

      if (dbFriendships && dbFriendships.length > 0) {
        const friendUids = dbFriendships.map((f: any) =>
          f.user_id === resolvedUid ? f.friend_id : f.user_id
        );
        const { data: dbProfiles } = await supabaseAdmin
          .from('profiles')
          .select('id, display_id, name, avatar_url, bio')
          .in('id', friendUids);

        if (dbProfiles) {
          friendsList = dbProfiles.map((p: any) => ({
            id: p.display_id || p.id,
            name: p.name,
            avatar:
              p.avatar_url ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            status: 'online' as const,
            bio: p.bio || 'صديق في Soul-X ✨',
          }));
        }
      }

      // 2. Fetch requests from Supabase public.friend_requests
      const { data: dbRequests } = await supabaseAdmin
        .from('friend_requests')
        .select('*')
        .or(`receiver_id.eq.${resolvedUid},sender_id.eq.${resolvedUid}`);

      if (dbRequests && dbRequests.length > 0) {
        // Collect all related profiles for names and avatars
        const allRelatedIds = Array.from(
          new Set(dbRequests.flatMap((r: any) => [r.sender_id, r.receiver_id]))
        );
        const { data: reqProfiles } = await supabaseAdmin
          .from('profiles')
          .select('id, display_id, name, avatar_url, bio')
          .in('id', allRelatedIds);

        const profileMap = new Map((reqProfiles || []).map((p: any) => [p.id, p]));

        incomingRequests = dbRequests
          .filter((r: any) => r.receiver_id === resolvedUid && r.status === 'pending')
          .map((r: any) => {
            const sender = profileMap.get(r.sender_id);
            return {
              id: r.id,
              senderId: sender?.display_id || r.sender_id,
              receiverId: userId,
              senderName: sender?.name || 'مستخدم Soul-X',
              senderAvatar:
                sender?.avatar_url ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
              senderBio: sender?.bio || 'طلب صداقة في Soul-X ✨',
              status: r.status,
              createdAt: r.created_at,
            };
          });

        sentRequests = dbRequests
          .filter((r: any) => r.sender_id === resolvedUid)
          .map((r: any) => {
            const receiver = profileMap.get(r.receiver_id);
            return {
              id: r.id,
              senderId: userId,
              receiverId: receiver?.display_id || r.receiver_id,
              senderName: 'أنا',
              receiverName: receiver?.name || 'مستخدم Soul-X',
              status: r.status,
              createdAt: r.created_at,
            };
          });
      }
    } catch (dbErr) {
      console.warn('Friends list database query warning:', dbErr);
    }
  }

  // Merge with local fallback
  const userFriendships = localData.friends.filter(
    (f) => f.userId === userId || f.friendId === userId
  );
  const localFriendUserIds = userFriendships.map((f) => (f.userId === userId ? f.friendId : f.userId));
  for (const fId of localFriendUserIds) {
    if (!friendsList.some((f) => f.id === fId)) {
      const u = allUsers.find((x) => x.id === fId);
      friendsList.push({
        id: fId,
        name: u?.name || `مستخدم ${fId}`,
        avatar:
          u?.photoUrl ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        status: 'online' as const,
        bio: 'صديق في Soul-X ✨',
      });
    }
  }

  const localIncoming = localData.requests.filter(
    (r) => r.receiverId === userId && r.status === 'pending'
  );
  for (const r of localIncoming) {
    if (!incomingRequests.some((x) => x.id === r.id || x.senderId === r.senderId)) {
      incomingRequests.push(r);
    }
  }

  const localSent = localData.requests.filter((r) => r.senderId === userId);
  for (const r of localSent) {
    if (!sentRequests.some((x) => x.id === r.id || x.receiverId === r.receiverId)) {
      sentRequests.push(r);
    }
  }

  return res.json({
    success: true,
    friends: friendsList,
    incomingRequests,
    sentRequests,
  });
});

// 7. Endpoint: إرسال طلب صداقة وحفظه في Supabase وقاعدة البيانات
app.post('/api/friends/send-request', async (req: Request, res: Response) => {
  const { senderId, senderName, targetUserId, targetUserName, senderAvatar, senderBio } = req.body;
  if (!senderId || !targetUserId) {
    return res.status(400).json({ success: false, message: 'معرفات المستخدمين مطلوبة' });
  }

  const localData = getStoredFriendsData();
  let createdRequestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  if (supabaseAdmin) {
    try {
      const senderUuid = await resolveProfileId(senderId);
      const targetUuid = await resolveProfileId(targetUserId);

      // Verify profiles exist before inserting to satisfy foreign key
      if (senderUuid && targetUuid) {
        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from('friend_requests')
          .upsert(
            {
              sender_id: senderUuid,
              receiver_id: targetUuid,
              status: 'pending',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'sender_id,receiver_id' }
          )
          .select()
          .maybeSingle();

        if (!insertErr && inserted?.id) {
          createdRequestId = inserted.id;
        }
      }
    } catch (dbErr) {
      console.warn('Supabase friend request insert warning:', dbErr);
    }
  }

  // Also maintain in local storage
  const existing = localData.requests.find(
    (r) =>
      ((r.senderId === senderId && r.receiverId === targetUserId) ||
        (r.senderId === targetUserId && r.receiverId === senderId)) &&
      r.status === 'pending'
  );

  const newRequest: StoredFriendRequest = existing || {
    id: createdRequestId,
    senderId,
    receiverId: targetUserId,
    senderName: senderName || 'مستخدم Soul-X',
    receiverName: targetUserName || 'مستخدم Soul-X',
    senderAvatar,
    senderBio,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  if (!existing) {
    localData.requests.push(newRequest);
    saveStoredFriendsData(localData);
  }

  return res.json({
    success: true,
    message: `تم إرسال طلب الصداقة بنجاح إلى ${targetUserName || targetUserId}`,
    request: newRequest,
  });
});

// 8. Endpoint: قبول أو رفض طلب الصداقة في Supabase وقاعدة البيانات
app.post('/api/friends/respond-request', async (req: Request, res: Response) => {
  const { requestId, action, userId } = req.body; // action: 'accept' | 'decline'
  if (!requestId || !action) {
    return res.status(400).json({ success: false, message: 'معرف الطلب والإجراء مطلوبان' });
  }

  const localData = getStoredFriendsData();
  const reqItem = localData.requests.find((r) => r.id === requestId);

  if (supabaseAdmin) {
    try {
      const statusValue = action === 'accept' ? 'accepted' : 'declined';
      // Update request in Supabase
      const { data: updatedReq } = await supabaseAdmin
        .from('friend_requests')
        .update({ status: statusValue, updated_at: new Date().toISOString() })
        .eq('id', requestId)
        .select()
        .maybeSingle();

      if (action === 'accept') {
        const sId = updatedReq?.sender_id || (reqItem ? await resolveProfileId(reqItem.senderId) : null);
        const rId = updatedReq?.receiver_id || (reqItem ? await resolveProfileId(reqItem.receiverId) : null);

        if (sId && rId) {
          await supabaseAdmin.from('friends').upsert(
            [
              { user_id: sId, friend_id: rId, created_at: new Date().toISOString() },
              { user_id: rId, friend_id: sId, created_at: new Date().toISOString() },
            ],
            { onConflict: 'user_id,friend_id' }
          );
        }
      }
    } catch (dbErr) {
      console.warn('Supabase friend response warning:', dbErr);
    }
  }

  if (reqItem) {
    reqItem.status = action === 'accept' ? 'accepted' : 'declined';
    if (action === 'accept') {
      const exists = localData.friends.some(
        (f) =>
          (f.userId === reqItem.senderId && f.friendId === reqItem.receiverId) ||
          (f.userId === reqItem.receiverId && f.friendId === reqItem.senderId)
      );
      if (!exists) {
        localData.friends.push({
          id: `fr-${Date.now()}`,
          userId: reqItem.senderId,
          friendId: reqItem.receiverId,
          createdAt: new Date().toISOString(),
        });
      }
    }
    saveStoredFriendsData(localData);
  }

  return res.json({
    success: true,
    message: action === 'accept' ? 'تم قبول طلب الصداقة بنجاح' : 'تم رفض طلب الصداقة',
    status: action === 'accept' ? 'accepted' : 'declined',
  });
});

// 9. Endpoint: جلب محادثات ورسائل المستخدم الحقيقية من Supabase
app.get('/api/conversations/list', async (req: Request, res: Response) => {
  const userId = ((req.query.userId as string) || '').trim();
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const messagesData = getStoredMessagesData();
  const allUsers = getStoredUsers();
  let dbConversations: any[] = [];

  if (supabaseAdmin) {
    try {
      const resolvedUid = await resolveProfileId(userId);

      // Find conversations that user is a participant of
      const { data: userParts } = await supabaseAdmin
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', resolvedUid);

      if (userParts && userParts.length > 0) {
        const convIds = userParts.map((p: any) => p.conversation_id);

        // Fetch conversations
        const { data: convRows } = await supabaseAdmin
          .from('conversations')
          .select('id, created_at, updated_at')
          .in('id', convIds)
          .order('updated_at', { ascending: false });

        // Fetch messages for these conversations
        const { data: dbMessages } = await supabaseAdmin
          .from('messages')
          .select('id, conversation_id, sender_id, text, created_at')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: true });

        // Fetch all participants in these conversations
        const { data: allParticipants } = await supabaseAdmin
          .from('conversation_participants')
          .select('conversation_id, user_id')
          .in('conversation_id', convIds);

        const otherUserIds = Array.from(
          new Set(
            (allParticipants || [])
              .filter((p: any) => p.user_id !== resolvedUid)
              .map((p: any) => p.user_id)
          )
        );

        const { data: partProfiles } = await supabaseAdmin
          .from('profiles')
          .select('id, display_id, name, avatar_url')
          .in('id', otherUserIds);

        const profileMap = new Map((partProfiles || []).map((p: any) => [p.id, p]));

        dbConversations = (convRows || []).map((c: any) => {
          const part = (allParticipants || []).find(
            (p: any) => p.conversation_id === c.id && p.user_id !== resolvedUid
          );
          const otherProfile = part ? profileMap.get(part.user_id) : null;
          const msgs = (dbMessages || []).filter((m: any) => m.conversation_id === c.id);
          const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;

          return {
            id: c.id,
            name: otherProfile?.name || `مستخدم ${c.id.substring(0, 6)}`,
            avatar:
              otherProfile?.avatar_url ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            status: 'online' as const,
            lastMessage: lastMsg ? lastMsg.text : 'بدء محادثة جديدة',
            time: lastMsg
              ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'الآن',
            unreadCount: 0,
            messages: msgs.map((m: any) => ({
              id: m.id,
              sender: m.sender_id === resolvedUid ? ('me' as const) : ('them' as const),
              text: m.text,
              time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            })),
          };
        });
      }
    } catch (dbErr) {
      console.warn('Supabase conversations list warning:', dbErr);
    }
  }

  // Format local conversations
  const userConvs = messagesData.conversations.filter((c) => c.participants.includes(userId));
  const localFormatted = userConvs.map((c) => {
    const otherUserId = c.participants.find((p) => p !== userId) || userId;
    const otherUser = allUsers.find((u) => u.id === otherUserId);
    const lastMsg = c.messages.length > 0 ? c.messages[c.messages.length - 1] : null;

    return {
      id: c.id,
      name: otherUser?.name || `مستخدم ${otherUserId}`,
      avatar:
        otherUser?.photoUrl ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      status: 'online' as const,
      lastMessage: lastMsg ? lastMsg.text : 'بدء محادثة جديدة',
      time: lastMsg
        ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'الآن',
      unreadCount: 0,
      messages: c.messages.map((m) => ({
        id: m.id,
        sender: m.senderId === userId ? ('me' as const) : ('them' as const),
        text: m.text,
        time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      })),
    };
  });

  // Merge unique
  const merged = [
    ...dbConversations,
    ...localFormatted.filter((lc) => !dbConversations.some((dc) => dc.id === lc.id || dc.name === lc.name)),
  ];

  return res.json({ success: true, conversations: merged });
});

// 10. Endpoint: إرسال رسالة حقيقية وحفظها في Supabase وقاعدة البيانات
app.post('/api/messages/send', async (req: Request, res: Response) => {
  const { conversationId, senderId, recipientId, text } = req.body;
  if (!senderId || !text || !text.trim()) {
    return res.status(400).json({ success: false, message: 'بيانات الرسالة غير مكتملة' });
  }

  let finalConvId = conversationId;
  let createdMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  if (supabaseAdmin) {
    try {
      const senderUuid = await resolveProfileId(senderId);
      const recipientUuid = recipientId ? await resolveProfileId(recipientId) : null;

      // 1. If no valid UUID conversationId, check or create in Supabase
      const isUuidConv =
        finalConvId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalConvId);

      if (!isUuidConv && recipientUuid) {
        // Find existing conversation between senderUuid and recipientUuid
        const { data: myParts } = await supabaseAdmin
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', senderUuid);

        if (myParts && myParts.length > 0) {
          const myConvIds = myParts.map((p: any) => p.conversation_id);
          const { data: otherPart } = await supabaseAdmin
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', recipientUuid)
            .in('conversation_id', myConvIds)
            .maybeSingle();

          if (otherPart) {
            finalConvId = otherPart.conversation_id;
          }
        }

        // If still not found, create new conversation row
        if (!finalConvId || !isUuidConv) {
          const { data: newConv } = await supabaseAdmin
            .from('conversations')
            .insert({ created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .select()
            .single();

          if (newConv?.id) {
            finalConvId = newConv.id;
            await supabaseAdmin.from('conversation_participants').insert([
              { conversation_id: finalConvId, user_id: senderUuid },
              { conversation_id: finalConvId, user_id: recipientUuid },
            ]);
          }
        }
      }

      // 2. Insert message into Supabase public.messages
      if (
        finalConvId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalConvId)
      ) {
        const { data: msgRow, error: msgErr } = await supabaseAdmin
          .from('messages')
          .insert({
            conversation_id: finalConvId,
            sender_id: senderUuid,
            text: text.trim(),
            created_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle();

        if (!msgErr && msgRow) {
          createdMessageId = msgRow.id;
          await supabaseAdmin
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', finalConvId);
        }
      }
    } catch (dbErr) {
      console.warn('Supabase send message warning:', dbErr);
    }
  }

  // Also maintain local messages.json
  const messagesData = getStoredMessagesData();
  let conv = finalConvId ? messagesData.conversations.find((c) => c.id === finalConvId) : null;

  if (!conv && recipientId) {
    conv = messagesData.conversations.find(
      (c) => c.participants.includes(senderId) && c.participants.includes(recipientId)
    );
    if (!conv) {
      conv = {
        id: finalConvId || `conv-${Date.now()}`,
        participants: [senderId, recipientId],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      };
      messagesData.conversations.push(conv);
    }
  }

  const newMsg: StoredMessage = {
    id: createdMessageId,
    conversationId: conv ? conv.id : (finalConvId || `conv-${Date.now()}`),
    senderId,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };

  if (conv) {
    conv.messages.push(newMsg);
    conv.updatedAt = new Date().toISOString();
    saveStoredMessagesData(messagesData);
  }

  return res.json({
    success: true,
    message: newMsg,
    conversationId: finalConvId || (conv ? conv.id : undefined),
  });
});

// ==========================================
// Admin Control Panel & PIN Protection
// ==========================================
function getAdminEmails(): string[] {
  const admin1 = (process.env.ADMIN1 || '').trim().toLowerCase();
  const admin2 = (process.env.ADMIN2 || '').trim().toLowerCase();
  const list: string[] = [];
  if (admin1) list.push(admin1);
  if (admin2 && !list.includes(admin2)) list.push(admin2);
  return list;
}

function getAdminPin(): string {
  return (process.env.ADMIN_PIN || '').trim();
}

function generateAdminToken(): string {
  const pin = getAdminPin();
  if (!pin) return '';
  return crypto.createHmac('sha256', pin).update('SOULX_ADMIN_SESSION').digest('hex');
}

function verifyAdminAuth(req: Request, res: Response, next: () => void) {
  const expectedPin = getAdminPin();
  if (!expectedPin) {
    return res.status(503).json({
      success: false,
      error: 'PIN_NOT_CONFIGURED',
      message: 'متغير البيئة ADMIN_PIN غير محدد في السيرفر. تم إيقاف الوصول للوحة التحكم لحين ضبطه.',
    });
  }

  const pinHeader = (req.headers['x-admin-pin'] as string) || '';
  const authHeader = (req.headers['authorization'] as string) || '';
  const expectedToken = generateAdminToken();

  if (pinHeader && pinHeader.trim() === expectedPin) {
    return next();
  }
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token && expectedToken && token === expectedToken) {
      return next();
    }
  }

  return res.status(403).json({
    success: false,
    error: 'PIN_REQUIRED',
    message: 'مسار محمي: يرجى إدخال رمز PIN الإداري المطابق لـ ADMIN_PIN للوصول إلى لوحة التحكم.',
  });
}

// 0. Endpoint: إعدادات وتكوين لوحة التحكم
app.get('/api/admin/config', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    hasAdminPin: Boolean(getAdminPin()),
  });
});

// 1. Endpoint: التحقق من صلاحية البريد لإظهار زر لوحة التحكم
app.post('/api/admin/check-access', (req: Request, res: Response) => {
  const { email } = req.body;
  const admins = getAdminEmails();

  if (!email || typeof email !== 'string' || admins.length === 0) {
    return res.json({ success: true, isAdmin: false });
  }

  const normalized = email.trim().toLowerCase();
  const isAdmin = admins.includes(normalized);

  return res.json({
    success: true,
    isAdmin,
  });
});

// 2. Endpoint: التحقق من رمز PIN الإداري
app.post('/api/admin/verify-pin', (req: Request, res: Response) => {
  const { email, pin } = req.body;
  const admins = getAdminEmails();
  const adminPin = getAdminPin();

  if (!adminPin) {
    return res.status(503).json({
      success: false,
      message: 'رمز ADMIN_PIN غير محدد في متغيرات البيئة. يرجى تعيينه في ملف .env أولاً.',
    });
  }

  if (admins.length === 0 || !email || !admins.includes(email.trim().toLowerCase())) {
    return res.status(403).json({
      success: false,
      message: 'هذا الحساب غير مصرح له كمدير للوحة التحكم. الصلاحية مقتصرة فقط على حسابات ADMIN1 و ADMIN2 المحددة في البيئة.',
    });
  }

  if (!pin || pin.trim() !== adminPin) {
    return res.status(401).json({
      success: false,
      message: 'رمز PIN الإداري غير صحيح! يرجى التحقق من القيمة المحددة في متغيرات البيئة.',
    });
  }

  const token = generateAdminToken();
  return res.json({
    success: true,
    message: 'تم التحقق من رمز PIN بنجاح! مرحباً بك في لوحة تحكم مديري Soul-X.',
    token,
  });
});

// 3. Endpoint: إحصائيات لوحة التحكم (محمية بـ ADMIN_PIN)
app.get('/api/admin/stats', verifyAdminAuth, async (_req: Request, res: Response) => {
  const storedUsers = getStoredUsers();
  let dbCount = 0;
  if (supabaseAdmin) {
    try {
      const res: any = await withTimeout(
        supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true })
      );
      if (res && typeof res.count === 'number') dbCount = res.count;
    } catch {}
  }
  const totalUsers = Math.max(dbCount, storedUsers.length);
  const friendsData = getStoredFriendsData();
  const messagesData = getStoredMessagesData();
  const activeBot = getActiveBotService();

  return res.json({
    success: true,
    stats: {
      registeredUsersCount: totalUsers,
      friendshipsCount: friendsData.friends.length,
      conversationsCount: messagesData.conversations.length,
      admins: getAdminEmails(),
      botConfigured: !!process.env.TELEGRAM_BOT_TOKEN,
      botPublicUrl: activeBot?.getAppUrl() || null,
      isTunnelActive: activeBot?.isTunnelRunning() || false,
      uptimeSeconds: Math.floor(process.uptime()),
      serverTime: new Date().toISOString(),
    },
  });
});

// 4. Endpoint: جلب جميع المستخدمين المسجلين (محمية بـ ADMIN_PIN) من Supabase وقاعدة البيانات
app.get('/api/admin/users', verifyAdminAuth, async (_req: Request, res: Response) => {
  let supabaseUsers: any[] = [];
  if (supabaseAdmin) {
    try {
      const res: any = await withTimeout(
        supabaseAdmin
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
      );

      if (res && res.data) {
        supabaseUsers = res.data.map((p: any) => ({
          id: p.id,
          displayId: p.display_id,
          name: p.name,
          email: p.email,
          createdAt: p.created_at,
          birthDate: p.birth_date || null,
          gender: p.gender || null,
          photoUrl: p.avatar_url || null,
        }));
      }
    } catch (e) {
      console.warn('Admin: Supabase profiles query warning:', e);
    }
  }

  const users = getStoredUsers();
  const safeStored = users.map((u) => ({
    id: u.id,
    displayId: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.createdAt,
    birthDate: u.birthDate || null,
    gender: u.gender || null,
    photoUrl: u.photoUrl || null,
  }));

  // Merge unique users
  const merged = [
    ...supabaseUsers,
    ...safeStored.filter((s) => !supabaseUsers.some((u) => u.id === s.id || u.email === s.email)),
  ];

  return res.json({
    success: true,
    users: merged,
  });
});

// 5. Endpoint: حذف مستخدم من لوحة التحكم (محمية بـ ADMIN_PIN) من Supabase
app.post('/api/admin/delete-user', verifyAdminAuth, async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const cleanUserId = String(userId);

  if (supabaseAdmin) {
    try {
      await supabaseAdmin
        .from('profiles')
        .delete()
        .or(`id.eq.${cleanUserId},display_id.eq.${cleanUserId}`);

      // Try deleting from auth.users via admin api if UUID format
      if (cleanUserId.includes('-')) {
        await supabaseAdmin.auth.admin.deleteUser(cleanUserId).catch(() => {});
      }
    } catch (supaErr) {
      console.warn('Supabase admin delete user warning:', supaErr);
    }
  }

  const users = getStoredUsers();
  const filtered = users.filter((u) => u.id !== cleanUserId);
  saveStoredUsers(filtered);

  return res.json({
    success: true,
    message: 'تم حذف المستخدم من قاعدة بيانات Supabase بنجاح.',
  });
});

// 6. Endpoint: تعديل مستخدم من لوحة التحكم (محمية بـ ADMIN_PIN) في Supabase
app.post('/api/admin/update-user', verifyAdminAuth, async (req: Request, res: Response) => {
  const { userId, name, email, birthDate, gender } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const cleanUserId = String(userId);

  if (supabaseAdmin) {
    try {
      const updates: any = { updated_at: new Date().toISOString() };
      if (name) updates.name = name.trim();
      if (email) updates.email = email.trim().toLowerCase();
      if (birthDate !== undefined) updates.birth_date = birthDate;
      if (gender !== undefined) updates.gender = gender;

      await supabaseAdmin
        .from('profiles')
        .update(updates)
        .or(`id.eq.${cleanUserId},display_id.eq.${cleanUserId}`);
    } catch (supaErr) {
      console.warn('Supabase admin update user warning:', supaErr);
    }
  }

  const users = getStoredUsers();
  const user = users.find((u) => u.id === cleanUserId);
  if (user) {
    if (name) user.name = name.trim();
    if (email) user.email = email.trim().toLowerCase();
    if (birthDate !== undefined) user.birthDate = birthDate;
    if (gender !== undefined) user.gender = gender;
    saveStoredUsers(users);
  }

  return res.json({
    success: true,
    message: 'تم تحديث بيانات المستخدم في Supabase بنجاح.',
    user: {
      id: cleanUserId,
      name,
      email,
      birthDate,
      gender,
    },
  });
});

// ==========================================
// Comprehensive Database Purge & Fresh Binding
// ==========================================
export async function wipeAllSoulXData(): Promise<{
  success: boolean;
  localCleared: boolean;
  supabaseTablesPurged: string[];
  authUsersCount: number;
  storageFilesCount: number;
  message: string;
  errors?: string[];
}> {
  const result = {
    success: true,
    localCleared: false,
    supabaseTablesPurged: [] as string[],
    authUsersCount: 0,
    storageFilesCount: 0,
    message: '',
    errors: [] as string[],
  };

  // 1. Wipe all local JSON caches
  try {
    saveStoredUsers([]);
    saveStoredSessions([]);
    saveStoredFriendsData({ friends: [], requests: [] });
    saveStoredMessagesData({ conversations: [] });
    result.localCleared = true;
    console.log('🧹 [Soul-X Purge] Local JSON caches purged completely.');
  } catch (err: any) {
    result.errors.push(`Local JSON error: ${err.message}`);
  }

  // 2. Wipe Supabase tables & Storage if connected
  if (supabaseAdmin) {
    try {
      console.log('🧹 [Soul-X Purge] Purging connected Supabase database and storage...');

      // Delete messages
      try {
        const { error: msgErr } = await supabaseAdmin
          .from('messages')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (!msgErr) result.supabaseTablesPurged.push('messages');
        else result.errors.push(`messages table delete warning: ${msgErr.message}`);
      } catch (e: any) {
        result.errors.push(`messages delete error: ${e.message}`);
      }

      // Delete conversation participants
      try {
        const { error: partErr } = await supabaseAdmin
          .from('conversation_participants')
          .delete()
          .neq('user_id', '00000000-0000-0000-0000-000000000000');
        if (!partErr) result.supabaseTablesPurged.push('conversation_participants');
        else result.errors.push(`conversation_participants table delete warning: ${partErr.message}`);
      } catch (e: any) {
        result.errors.push(`conversation_participants delete error: ${e.message}`);
      }

      // Delete conversations
      try {
        const { error: convErr } = await supabaseAdmin
          .from('conversations')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (!convErr) result.supabaseTablesPurged.push('conversations');
        else result.errors.push(`conversations table delete warning: ${convErr.message}`);
      } catch (e: any) {
        result.errors.push(`conversations delete error: ${e.message}`);
      }

      // Delete friend requests
      try {
        const { error: freqErr } = await supabaseAdmin
          .from('friend_requests')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (!freqErr) result.supabaseTablesPurged.push('friend_requests');
        else result.errors.push(`friend_requests table delete warning: ${freqErr.message}`);
      } catch (e: any) {
        result.errors.push(`friend_requests delete error: ${e.message}`);
      }

      // Delete friends
      try {
        const { error: frErr } = await supabaseAdmin
          .from('friends')
          .delete()
          .neq('user_id', '00000000-0000-0000-0000-000000000000');
        if (!frErr) result.supabaseTablesPurged.push('friends');
        else result.errors.push(`friends table delete warning: ${frErr.message}`);
      } catch (e: any) {
        result.errors.push(`friends delete error: ${e.message}`);
      }

      // Delete profiles
      try {
        const { error: profErr } = await supabaseAdmin
          .from('profiles')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');
        if (!profErr) result.supabaseTablesPurged.push('profiles');
        else result.errors.push(`profiles table delete warning: ${profErr.message}`);
      } catch (e: any) {
        result.errors.push(`profiles delete error: ${e.message}`);
      }

      // Delete Supabase Auth users if admin api is available
      if ((supabaseAdmin.auth as any).admin?.listUsers) {
        try {
          const { data: userList, error: listErr } = await (supabaseAdmin.auth as any).admin.listUsers({ perPage: 1000 });
          if (!listErr && userList?.users && userList.users.length > 0) {
            for (const u of userList.users) {
              await (supabaseAdmin.auth as any).admin.deleteUser(u.id);
              result.authUsersCount++;
            }
          }
        } catch (authErr: any) {
          result.errors.push(`auth.users delete: ${authErr?.message || authErr}`);
        }
      }

      // Clear soul-x storage bucket avatars
      try {
        const { data: files } = await supabaseAdmin.storage.from('soul-x').list('avatars', { limit: 1000 });
        if (files && files.length > 0) {
          const paths = files.map((f: any) => `avatars/${f.name}`);
          await supabaseAdmin.storage.from('soul-x').remove(paths);
          result.storageFilesCount += paths.length;
        }
      } catch (stErr: any) {
        result.errors.push(`storage files delete: ${stErr?.message || stErr}`);
      }

      console.log('✅ [Soul-X Purge] Supabase database and storage successfully wiped clean.');
    } catch (dbErr: any) {
      result.errors.push(`Supabase purge error: ${dbErr?.message || dbErr}`);
    }
  }

  result.message = 'تم مسح وتصفير كافة البيانات وقاعدة بيانات Supabase بنجاح، وتهيئة الربط الفعلي النظيف.';
  return result;
}

// 7. Endpoint: مسح وتصفير كافة البيانات وقاعدة البيانات بالكامل (محمية بـ ADMIN_PIN)
app.post('/api/admin/reset-database', verifyAdminAuth, async (_req: Request, res: Response) => {
  try {
    const result = await wipeAllSoulXData();
    return res.json({
      success: true,
      message: result.message,
      details: result,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء مسح البيانات',
    });
  }
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
      telegramLoginDisabled: true,
      error: verification.error,
      message: 'تسجيل الدخول في Soul-X بالبريد الإلكتروني فقط (تم إلغاء تسجيل الدخول بتيليجرام).',
    });
  }

  return res.json({
    success: true,
    verified: true,
    telegramLoginDisabled: true,
    user: verification.user,
    authDate: verification.authDate,
    queryId: verification.queryId,
    message: 'تم استخراج بيانات تيليجرام. يرجى تسجيل الدخول أو إنشاء حسابك بالبريد الإلكتروني.',
  });
});

// 2. Endpoint: حالة إعداد بوت Telegram وتفاصيل البوت والرابط العام الفعال
app.get('/api/telegram/status', async (_req: Request, res: Response) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const publicUrl = 'https://soul-x.onrender.com';
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

// 3. Endpoint: تعيين زر القائمة Menu Button للبوت تلقائياً عبر API (برابط https://soul-x.onrender.com)
app.post('/api/telegram/set-menu-button', async (req: Request, res: Response) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const { buttonText } = req.body;
  const webAppUrl = 'https://soul-x.onrender.com';

  if (!botToken) {
    return res.status(400).json({
      success: false,
      message: 'TELEGRAM_BOT_TOKEN is not configured in server environment.',
    });
  }

  // Update active bot service
  if (activeBotService) {
    await activeBotService.updateAppUrl('https://soul-x.onrender.com', true);
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
        message: `تم تعيين زر Web App في بوت تيليجرام بنجاح! الرابط الفعال المعتمد: ${webAppUrl}`,
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

  app.listen(PORT, '0.0.0.0', async () => {
    console.log(`Soul-X Server running on http://0.0.0.0:${PORT}`);

    // Execute comprehensive clean wipe and bind directly to Supabase as requested
    try {
      console.log('🔄 [Initialization] Purging existing database data and binding fresh to Supabase...');
      const purgeStatus = await wipeAllSoulXData();
      console.log('✨ [Initialization] Database purged & ready for live Supabase sync:', purgeStatus.message);
    } catch (wipeErr) {
      console.warn('⚠️ [Initialization] Database wipe warning:', wipeErr);
    }

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
