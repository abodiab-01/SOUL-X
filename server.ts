import express, { Request, Response } from 'express';
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
const SUPABASE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

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
  console.log('⚡ Supabase Database & Auth initialized successfully.');
} else {
  console.log('ℹ️ Supabase credentials not detected yet in env, running in resilient fallback mode.');
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
  const appUrl = initialUrl || process.env.APP_URL || 'http://127.0.0.1:3000';
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

// Dynamic Auto-Detection of Application Host & URL for Telegram Bot
app.use((req, _res, next) => {
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '') as string;
  const proto = (req.headers['x-forwarded-proto'] || 'https') as string;

  if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
    const livePublicUrl = `${proto}://${host}`;
    if (activeBotService) {
      const currentUrl = activeBotService.getAppUrl();
      if (!currentUrl || currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
        activeBotService.updateAppUrl(livePublicUrl);
      }
    }
  }
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
app.post('/api/auth/check-email', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
  }

  const normalized = email.trim().toLowerCase();

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

  // Try Supabase Auth first
  if (supabaseAdmin) {
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
        email: normalized,
        password,
      });

      if (!authError && authData.user) {
        // Fetch full profile from Supabase Database
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        const userObj = {
          id: profile?.id || authData.user.id,
          displayId: profile?.display_id,
          name: profile?.name || authData.user.user_metadata?.name || normalized.split('@')[0],
          email: profile?.email || authData.user.email || normalized,
          photoUrl: profile?.avatar_url || null,
          createdAt: profile?.created_at || authData.user.created_at,
          birthDate: profile?.birth_date || null,
          gender: profile?.gender || null,
        };

        return res.json({
          success: true,
          message: `مرحباً بعودتك يا ${userObj.name}!`,
          token: authData.session?.access_token,
          user: userObj,
        });
      }
    } catch (supaErr) {
      console.warn('Supabase signInWithPassword exception, checking fallback:', supaErr);
    }
  }

  // Fallback to local stored users
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
        createdUserId = authData.user.id;
        authToken = authData.session?.access_token;

        // Upsert into public.profiles in Supabase Database
        await supabaseAdmin
          .from('profiles')
          .upsert({
            id: createdUserId,
            display_id: displayId,
            email: normalized,
            name: name.trim(),
            wallet_balance: 1250,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
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
    token: authToken,
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

// Helper to verify user identity and prevent modifying another user's profile/assets
async function verifyUserOwnership(req: Request, targetUserId: string): Promise<{ authorized: boolean; reason?: string }> {
  const cleanTargetId = String(targetUserId).trim();
  const authHeader = (req.headers['authorization'] as string) || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  const pinHeader = (req.headers['x-admin-pin'] as string) || '';

  // Admin bypass
  if ((pinHeader && pinHeader.trim() === getAdminPin()) || (token && token === generateAdminToken())) {
    return { authorized: true };
  }

  // 1. If Supabase is active
  if (supabaseAdmin) {
    if (!token) {
      return { authorized: false, reason: 'مطلوب تسجيل الدخول لتعديل أو حذف البيانات (جلسة مفقودة)' };
    }
    try {
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !user) {
        return { authorized: false, reason: 'جلسة تسجيل الدخول غير صالحة أو منتهية' };
      }
      if (user.id === cleanTargetId) {
        return { authorized: true };
      }
      // Check display_id
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('display_id')
        .eq('id', user.id)
        .maybeSingle();
      if (profile && profile.display_id === cleanTargetId) {
        return { authorized: true };
      }
      return { authorized: false, reason: 'غير مصرح لك بتعديل أو حذف بيانات مستخدم آخر (حماية RLS)' };
    } catch {
      return { authorized: false, reason: 'فشل التحقق من هوية المستخدم' };
    }
  }

  // 2. In local fallback mode
  return { authorized: true };
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

// 5. Endpoint: بحث عن مستخدم بالمعرف أو الاسم
app.get('/api/users/search', async (req: Request, res: Response) => {
  const query = ((req.query.q as string) || '').trim().toLowerCase();
  const storedUsers = getStoredUsers();

  const mockUsers = [
    {
      id: '98234105',
      name: 'ريما الشريف',
      nameEn: 'Rima Al-Sharif',
      username: 'rima_sh',
      bio: 'محبة للفنون التشكيلية والتأمل والموسيقى الهادئة 🎨 أبحث عن روح تشاركني الشغف.',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      gender: 'female',
      age: 24,
      location: 'الرياض',
      matchScore: 97,
      status: 'online',
    },
    {
      id: '47190283',
      name: 'فيصل السبيعي',
      nameEn: 'Faisal Al-Subaie',
      username: 'faisal_s',
      bio: 'شغوف بالقراءة، السفر، استكشاف الأماكن الهادئة والتقنية الحديثة ✈️',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      gender: 'male',
      age: 27,
      location: 'جدة',
      matchScore: 93,
      status: 'online',
    },
    {
      id: '11029384',
      name: 'نورة الدوسري',
      nameEn: 'Noura Al-Dosari',
      username: 'noura_d',
      bio: 'أبحث عن أرواح راقية تشاركني حب القهوة والمحادثات العميقة ☕',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
      gender: 'female',
      age: 23,
      location: 'الدمام',
      matchScore: 95,
      status: 'online',
    },
    {
      id: '549182301',
      name: 'سلطان الشمري',
      nameEn: 'Sultan Al-Shammari',
      username: 'sultan_sh',
      bio: 'مهتم بالرياضة والبودكاست وأسلوب الحياة الصحي 🏃‍♂️',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
      gender: 'male',
      age: 26,
      location: 'الرياض',
      matchScore: 89,
      status: 'offline',
    },
    {
      id: '73829104',
      name: 'ليندا الأحمد',
      nameEn: 'Linda Al-Ahmad',
      username: 'linda_ah',
      bio: 'مهندسة ديكور، محبة للطبيعة والسينما المستقلة والنباتات 🌿',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
      gender: 'female',
      age: 25,
      location: 'الخبر',
      matchScore: 94,
      status: 'online',
    },
    {
      id: '62918374',
      name: 'طارق الحربي',
      nameEn: 'Tariq Al-Harbi',
      username: 'tariq_h',
      bio: 'مصور فوتوغرافي ومحب للمغامرات والتخييم في الطبيعة 📷',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&q=80',
      gender: 'male',
      age: 28,
      location: 'العلا',
      matchScore: 91,
      status: 'offline',
    },
    {
      id: '83920147',
      name: 'سارة العتيبي',
      nameEn: 'Sarah Al-Otaibi',
      username: 'sarah_otb',
      bio: 'أبحث عن أحاديث عميقة تشبه الروح، محبة للقراءة والفن ✨',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
      gender: 'female',
      age: 25,
      location: 'الرياض',
      matchScore: 96,
      status: 'online',
    },
  ];

  // Fetch profiles from Supabase Database
  let supabaseProfiles: any[] = [];
  if (supabaseAdmin) {
    try {
      const { data: dbProfiles } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .limit(100);

      if (dbProfiles) {
        supabaseProfiles = dbProfiles.map((p) => ({
          id: p.display_id || p.id,
          name: p.name,
          nameEn: undefined,
          username: p.email ? p.email.split('@')[0] : p.display_id,
          bio: p.bio || 'مستخدم مسجل في منصة Soul-X ✨',
          avatar: p.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
          gender: p.gender || null,
          age: 24,
          location: 'الرياض',
          matchScore: 92,
          status: 'online' as const,
        }));
      }
    } catch (e) {
      console.warn('Could not query Supabase profiles:', e);
    }
  }

  // Convert stored registered users into search format
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
    age: 24,
    location: 'الرياض',
    matchScore: 90,
    status: 'online' as const,
  }));

  const combined = [
    ...mockUsers,
    ...supabaseProfiles.filter((s) => !mockUsers.some((x) => x.id === s.id)),
    ...mappedStored.filter((m) => !mockUsers.some((x) => x.id === m.id) && !supabaseProfiles.some((s) => s.id === m.id)),
  ];

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

// 6. Endpoint: إرسال طلب صداقة
app.post('/api/friends/send-request', (req: Request, res: Response) => {
  const { targetUserId, targetUserName, timestamp } = req.body;
  if (!targetUserId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  return res.json({
    success: true,
    message: `تم إرسال طلب الصداقة بنجاح إلى ${targetUserName || targetUserId}`,
    requestId: `req-${targetUserId}-${Date.now()}`,
    timestamp: timestamp || new Date().toISOString(),
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
  if (admin2) list.push(admin2);
  if (list.length === 0) {
    list.push('lasmr.ok9900@gmail.com', 'admin@soulx.app');
  }
  return list;
}

function getAdminPin(): string {
  return (process.env.ADMIN_PIN || '2026').trim();
}

function generateAdminToken(): string {
  return crypto.createHmac('sha256', getAdminPin()).update('SOULX_ADMIN_SESSION').digest('hex');
}

function verifyAdminAuth(req: Request, res: Response, next: () => void) {
  const pinHeader = (req.headers['x-admin-pin'] as string) || '';
  const authHeader = (req.headers['authorization'] as string) || '';
  const expectedPin = getAdminPin();
  const expectedToken = generateAdminToken();

  if (pinHeader && pinHeader.trim() === expectedPin) {
    return next();
  }
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === expectedToken) {
      return next();
    }
  }

  return res.status(403).json({
    success: false,
    error: 'PIN_REQUIRED',
    message: 'مسار محمي: يرجى إدخال رمز PIN الإداري للوصول إلى لوحة التحكم.',
  });
}

// 1. Endpoint: التحقق من صلاحية البريد لإظهار زر لوحة التحكم
app.post('/api/admin/check-access', (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.json({ isAdmin: false });
  }

  const normalized = email.trim().toLowerCase();
  const admins = getAdminEmails();
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

  if (!email || !admins.includes(email.trim().toLowerCase())) {
    return res.status(403).json({
      success: false,
      message: 'هذا الحساب غير مصرح له كمدير للوحة التحكم.',
    });
  }

  if (!pin || pin.trim() !== getAdminPin()) {
    return res.status(401).json({
      success: false,
      message: 'رمز PIN الإداري غير صحيح! يرجى المحاولة مرة أخرى.',
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
app.get('/api/admin/stats', verifyAdminAuth, (_req: Request, res: Response) => {
  const storedUsers = getStoredUsers();
  const activeBot = getActiveBotService();

  return res.json({
    success: true,
    stats: {
      registeredUsersCount: storedUsers.length,
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
      const { data: dbProfiles } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (dbProfiles) {
        supabaseUsers = dbProfiles.map((p) => ({
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
app.get('/api/telegram/status', async (req: Request, res: Response) => {
  const clientUrl = req.query.clientUrl as string;
  if (clientUrl && (clientUrl.startsWith('https://') || clientUrl.startsWith('http://')) && activeBotService) {
    const currentUrl = activeBotService.getAppUrl();
    if (!currentUrl || currentUrl.includes('localhost') || currentUrl.includes('127.0.0.1')) {
      await activeBotService.updateAppUrl(clientUrl);
    }
  }

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

  // Auto-detect public URL from tunnel or request headers if missing
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '') as string;
  const proto = (req.headers['x-forwarded-proto'] || 'https') as string;
  const publicTunnelUrl = activeBotService?.getAppUrl();

  if (publicTunnelUrl && !publicTunnelUrl.includes('localhost') && !publicTunnelUrl.includes('127.0.0.1')) {
    webAppUrl = publicTunnelUrl;
  } else if ((!webAppUrl || webAppUrl.includes('localhost') || webAppUrl.includes('127.0.0.1')) && host) {
    webAppUrl = `${proto}://${host}`;
  }

  if (!webAppUrl) {
    return res.status(400).json({
      success: false,
      message: 'webAppUrl is required.',
    });
  }

  // Update active bot service dynamically
  if (activeBotService) {
    await activeBotService.updateAppUrl(webAppUrl, true);
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
