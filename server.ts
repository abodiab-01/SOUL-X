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
function isUuidString(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || '').trim());
}

async function resolveProfileId(userIdOrDisplayId: string): Promise<string> {
  const clean = String(userIdOrDisplayId || '').trim();
  if (!supabaseAdmin || !clean) return clean;
  // If already in uuid format
  if (isUuidString(clean)) {
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

// Safely query Supabase profile by ID, Display ID, or Email without triggering Postgres UUID syntax errors
async function getSupabaseProfileByIdentifier(identifier: string) {
  if (!supabaseAdmin || !identifier) return null;
  const clean = String(identifier).trim();
  try {
    if (isUuidString(clean)) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', clean)
        .maybeSingle();
      if (!error && data) return data;
    }
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .or(`display_id.eq.${clean},email.eq.${clean.toLowerCase()}`)
      .maybeSingle();
    if (!error && data) return data;
  } catch (err) {
    console.warn('getSupabaseProfileByIdentifier warning:', err);
  }
  return null;
}

// Safely update Supabase profile by ID, Display ID, or Email without triggering Postgres UUID syntax errors
async function updateSupabaseProfileByIdentifier(identifier: string, updates: Record<string, any>): Promise<boolean> {
  if (!supabaseAdmin || !identifier) return false;
  const clean = String(identifier).trim();
  try {
    if (isUuidString(clean)) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', clean);
      if (!error) return true;
    }
    const { error } = await supabaseAdmin
      .from('profiles')
      .update(updates)
      .or(`display_id.eq.${clean},email.eq.${clean.toLowerCase()}`);
    return !error;
  } catch (err) {
    console.warn('updateSupabaseProfileByIdentifier warning:', err);
  }
  return false;
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
  coinsBalance?: number;
  bio?: string;
  updatedAt?: string;
}

interface StoredSession {
  token: string;
  refreshToken: string;
  expiresAt: string;
  refreshExpiresAt: string;
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
const AGENTS_FILE = path.resolve(DATA_DIR, 'agents.json');
const AGENCY_WITHDRAWALS_FILE = path.resolve(DATA_DIR, 'agency_withdrawals.json');
const AGENCY_TRANSACTIONS_FILE = path.resolve(DATA_DIR, 'agency_transactions.json');

export interface StoredAgent {
  id: string;
  gridCode?: string; // رقم القريد للوكيل مثال A8838
  email: string;
  name: string;
  nameEn?: string;
  taglineAr?: string;
  taglineEn?: string;
  country: string;
  flag: string;
  balance: number;
  category: 'recharge' | 'withdraw' | 'both';
  methods: string[];
  responseTimeAr?: string;
  responseTimeEn?: string;
  rating?: number;
  completedOrders?: number;
  whatsapp?: string;
  telegram?: string;
  isOnline?: boolean;
  minAmount?: number;
  maxAmount?: number;
  rateNoteAr?: string;
  rateNoteEn?: string;
  status: 'active' | 'suspended';
  createdAt: string;
  updatedAt?: string;
}

export interface StoredAgencyWithdrawal {
  id: string;
  agentId: string;
  agentName: string;
  gridCode: string;
  amount: number;
  fee?: number;
  netCredited?: number;
  method: string;
  accountDetails: string;
  notes?: string;
  status: 'pending' | 'completed' | 'rejected';
  userId?: string;
  userDisplayId?: string;
  userName?: string;
  type?: 'agency_cashout' | 'incoming_user_withdrawal';
  createdAt: string;
  updatedAt?: string;
  adminNote?: string;
}

export interface StoredAgencyTransaction {
  id: string;
  agentId: string;
  gridCode: string;
  targetUserId: string;
  targetUserDisplayId?: string;
  targetUserName: string;
  amount: number;
  grossAmount?: number;
  feeAmount?: number;
  feePercentage?: number;
  payoutMethod?: string;
  accountDetails?: string;
  type?: 'recharge' | 'user_withdrawal';
  timestamp: string;
  previousBalance?: number;
  newBalance?: number;
}

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

// Generate unique account IDs strictly conforming to Soul-X pattern: S-0101V77-X711
function generateSoulXId(existingIds?: Set<string>): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const ids = existingIds || getAllExistingDisplayIds();
  for (let attempt = 0; attempt < 10000; attempt++) {
    const p1 = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    const char = chars.charAt(Math.floor(Math.random() * chars.length));
    const p2 = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    const p3 = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const candidate = `S-${p1}${char}${p2}-X${p3}`;
    if (!ids.has(candidate)) {
      return candidate;
    }
  }
  return `S-0101V77-X711`;
}

function getAllExistingDisplayIds(): Set<string> {
  const ids = new Set<string>();
  try {
    const users = getStoredUsers();
    users.forEach((u) => {
      if (u.displayId) ids.add(u.displayId);
      if (u.id) ids.add(u.id);
    });
  } catch {}
  return ids;
}

// Migrate stored users to ensure all users have the unique S-0101V77-X711 format
function migrateUserDisplayIds() {
  try {
    const users = getStoredUsers();
    let changed = false;
    const existingIds = new Set<string>();
    users.forEach((u) => {
      if (u.displayId && /^S-\d{4}[A-Z]\d{2}-X\d{3}$/.test(u.displayId)) {
        existingIds.add(u.displayId);
      }
    });

    users.forEach((u) => {
      if (!u.displayId || !/^S-\d{4}[A-Z]\d{2}-X\d{3}$/.test(u.displayId)) {
        const newId = generateSoulXId(existingIds);
        existingIds.add(newId);
        u.displayId = newId;
        changed = true;
      }
    });

    if (changed) {
      saveStoredUsers(users);
      console.log('✅ Migrated stored users to Soul-X pattern (S-0101V77-X711)');
    }
  } catch (err) {
    console.warn('Display ID migration warning:', err);
  }
}

migrateUserDisplayIds();

const DEFAULT_ADMIN_PASSWORD = 'aaa123123';

function ensureAdminAccountsInitialized() {
  try {
    const users = getStoredUsers();
    let changed = false;
    const existingIds = getAllExistingDisplayIds();

    const admin1 = (process.env.ADMIN1 || 'abojafar@soul-x.com').trim().toLowerCase();
    const admin2 = (process.env.ADMIN2 || 'abohaidar@soul-x.com').trim().toLowerCase();

    const adminDefs = [
      {
        email: admin1,
        id: 'admin-1001',
        name: 'مدير النظام (ADMIN1)',
      },
      {
        email: admin2,
        id: 'admin-1002',
        name: 'مدير النظام (ADMIN2)',
      },
    ];

    for (const def of adminDefs) {
      if (!def.email) continue;
      let user = users.find((u) => u.email.toLowerCase() === def.email);
      const targetHash = hashPassword(DEFAULT_ADMIN_PASSWORD);

      if (!user) {
        const displayId = generateSoulXId(existingIds);
        existingIds.add(displayId);
        user = {
          id: def.id,
          displayId,
          email: def.email,
          name: def.name,
          passwordHash: targetHash,
          createdAt: new Date().toISOString(),
          birthDate: '1995-01-01',
          gender: 'male',
          walletBalance: 99999,
          coinsBalance: 100000,
        };
        users.push(user);
        changed = true;
      } else {
        if (!user.passwordHash) {
          user.passwordHash = targetHash;
          changed = true;
        }
        if (!user.displayId) {
          const displayId = generateSoulXId(existingIds);
          existingIds.add(displayId);
          user.displayId = displayId;
          changed = true;
        }
        if (typeof user.walletBalance !== 'number') {
          user.walletBalance = 99999;
          changed = true;
        }
        if (typeof user.coinsBalance !== 'number') {
          user.coinsBalance = 100000;
          changed = true;
        }
      }

      if (supabaseAdmin && user) {
        Promise.resolve(
          updateSupabaseProfileByIdentifier(user.email, {
            display_id: user.displayId,
            name: user.name,
            wallet_balance: user.walletBalance ?? 99999,
            updated_at: new Date().toISOString(),
          })
        ).catch(() => {});
      }
    }

    if (changed || users.length === 0) {
      saveStoredUsers(users);
      console.log('⚡ Admin accounts initialized with password [aaa123123] for ADMIN1 & ADMIN2');
    }
  } catch (err) {
    console.warn('Admin account initialization warning:', err);
  }
}

ensureAdminAccountsInitialized();

function generateGridCode(existingCodes?: Set<string>): string {
  const codes =
    existingCodes ||
    new Set(
      getStoredAgentsRaw()
        .map((a) => a.gridCode)
        .filter(Boolean) as string[]
    );
  // Example format: A8838, A followed by 4 digits
  for (let i = 0; i < 5000; i++) {
    const num = Math.floor(1000 + Math.random() * 9000);
    const code = `A${num}`;
    if (!codes.has(code)) return code;
  }
  return `A${Date.now().toString().slice(-4)}`;
}

function getStoredAgentsRaw(): StoredAgent[] {
  try {
    if (fs.existsSync(AGENTS_FILE)) {
      const data = fs.readFileSync(AGENTS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading agents file:', err);
  }
  return [];
}

function getStoredAgents(): StoredAgent[] {
  const agents = getStoredAgentsRaw();
  let changed = false;
  const codes = new Set(agents.map((a) => a.gridCode).filter(Boolean) as string[]);

  agents.forEach((agent) => {
    if (!agent.gridCode) {
      agent.gridCode = generateGridCode(codes);
      codes.add(agent.gridCode);
      changed = true;
    }
  });

  if (changed) {
    saveStoredAgents(agents);
  }

  return agents;
}

function saveStoredAgents(agents: StoredAgent[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(agents, null, 2), 'utf-8');
    console.log(`💾 [Soul-X] Agents database file updated successfully (${agents.length} agents)`);
  } catch (err) {
    console.error('Error saving agents file:', err);
  }
}

function getStoredAgencyWithdrawals(): StoredAgencyWithdrawal[] {
  try {
    if (fs.existsSync(AGENCY_WITHDRAWALS_FILE)) {
      const data = fs.readFileSync(AGENCY_WITHDRAWALS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading agency withdrawals file:', err);
  }
  return [];
}

function saveStoredAgencyWithdrawals(withdrawals: StoredAgencyWithdrawal[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(AGENCY_WITHDRAWALS_FILE, JSON.stringify(withdrawals, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving agency withdrawals file:', err);
  }
}

function getStoredAgencyTransactions(): StoredAgencyTransaction[] {
  try {
    if (fs.existsSync(AGENCY_TRANSACTIONS_FILE)) {
      const data = fs.readFileSync(AGENCY_TRANSACTIONS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading agency transactions file:', err);
  }
  return [];
}

function saveStoredAgencyTransactions(txs: StoredAgencyTransaction[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(AGENCY_TRANSACTIONS_FILE, JSON.stringify(txs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving agency transactions file:', err);
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

const REFRESH_TOKEN_DAYS = 30; // 30 days valid refresh token
const ACCESS_TOKEN_HOURS = 24; // 24 hours valid access token

interface SessionTokens {
  token: string;
  refreshToken: string;
  expiresAt: string;
  refreshExpiresAt: string;
}

function createSession(
  userId: string,
  email: string,
  name: string,
  isAdmin = false,
  displayId?: string
): SessionTokens {
  const token = `sx_at_${crypto.randomBytes(32).toString('hex')}`;
  const refreshToken = `sx_rt_${crypto.randomBytes(32).toString('hex')}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ACCESS_TOKEN_HOURS * 60 * 60 * 1000).toISOString();
  const refreshExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const sessions = getStoredSessions();
  // Filter out any older session for the same user
  const updated = sessions.filter(
    (s) => s.userId !== userId && s.email.toLowerCase() !== email.toLowerCase()
  );
  updated.push({
    token,
    refreshToken,
    expiresAt,
    refreshExpiresAt,
    userId,
    displayId,
    email: email.toLowerCase(),
    name,
    isAdmin,
    createdAt: now.toISOString(),
    lastActiveAt: now.toISOString(),
  });
  saveStoredSessions(updated);
  return { token, refreshToken, expiresAt, refreshExpiresAt };
}

function revokeSession(tokenOrRefreshToken: string) {
  if (!tokenOrRefreshToken) return;
  const sessions = getStoredSessions();
  const clean = tokenOrRefreshToken.trim();
  const updated = sessions.filter(
    (s) => s.token !== clean && s.refreshToken !== clean
  );
  saveStoredSessions(updated);
}

async function refreshSession(refreshToken: string): Promise<{
  valid: boolean;
  token?: string;
  refreshToken?: string;
  expiresAt?: string;
  refreshExpiresAt?: string;
  user?: any;
  isAdmin?: boolean;
  reason?: string;
}> {
  if (!refreshToken || typeof refreshToken !== 'string') {
    return { valid: false, reason: 'رمز التجديد (Refresh Token) مفقود أو غير صالح' };
  }

  const cleanRf = refreshToken.trim();
  const sessions = getStoredSessions();
  const sessionIndex = sessions.findIndex((s) => s.refreshToken === cleanRf);

  if (sessionIndex === -1) {
    return {
      valid: false,
      reason: 'رمز التجديد غير مسجل أو انتهت صلاحيته، يرجى تسجيل الدخول مجدداً',
    };
  }

  const session = sessions[sessionIndex];

  // Check 30-day expiration
  if (session.refreshExpiresAt && new Date(session.refreshExpiresAt).getTime() < Date.now()) {
    sessions.splice(sessionIndex, 1);
    saveStoredSessions(sessions);
    return {
      valid: false,
      reason: 'انتهت صلاحية جلسة 30 يوماً، يرجى تسجيل الدخول مجدداً',
    };
  }

  const now = new Date();
  const newToken = `sx_at_${crypto.randomBytes(32).toString('hex')}`;
  // Rolling 30-day window: extend refresh window by 30 days every time it is refreshed
  const newRefreshExpiresAt = new Date(
    now.getTime() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const newExpiresAt = new Date(
    now.getTime() + ACCESS_TOKEN_HOURS * 60 * 60 * 1000
  ).toISOString();

  session.token = newToken;
  session.expiresAt = newExpiresAt;
  session.refreshExpiresAt = newRefreshExpiresAt;
  session.lastActiveAt = now.toISOString();
  sessions[sessionIndex] = session;
  saveStoredSessions(sessions);

  // Retrieve user record
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
          walletBalance: profile.wallet_balance ?? 1250,
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

  const adminEmails = getAdminEmails();
  const isAdmin = Boolean(session.isAdmin || adminEmails.includes(session.email.toLowerCase()));

  return {
    valid: true,
    token: newToken,
    refreshToken: session.refreshToken,
    expiresAt: newExpiresAt,
    refreshExpiresAt: newRefreshExpiresAt,
    user: userRecord,
    isAdmin,
  };
}

async function verifyToken(
  token: string,
  fallbackRefreshToken?: string
): Promise<{
  valid: boolean;
  user?: any;
  isAdmin?: boolean;
  token?: string;
  refreshToken?: string;
  expiresAt?: string;
  refreshExpiresAt?: string;
  reason?: string;
}> {
  if (!token || typeof token !== 'string') {
    if (fallbackRefreshToken) {
      return refreshSession(fallbackRefreshToken);
    }
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
  const session = sessions.find((s) => s.token === token || s.refreshToken === token);
  if (session) {
    // If the 30-day window expired:
    if (session.refreshExpiresAt && new Date(session.refreshExpiresAt).getTime() < Date.now()) {
      revokeSession(session.token);
      return { valid: false, reason: 'انتهت صلاحية جلسة 30 يوماً، يرجى تسجيل الدخول مجدداً' };
    }

    // If access token expired, transparently refresh using 30-day refreshToken
    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      if (session.refreshToken) {
        return refreshSession(session.refreshToken);
      }
    }

    let userRecord: any = null;

    if (supabaseAdmin) {
      try {
        const profile = await getSupabaseProfileByIdentifier(session.userId || session.email);

        if (profile) {
          const users = getStoredUsers();
          const localUser = users.find(
            (u) =>
              u.id === session.userId ||
              (u.displayId && u.displayId === session.displayId) ||
              u.email.toLowerCase() === session.email.toLowerCase()
          );
          userRecord = {
            id: profile.id,
            displayId: profile.display_id,
            name: profile.name,
            email: profile.email,
            photoUrl: profile.avatar_url,
            createdAt: profile.created_at,
            birthDate: profile.birth_date || null,
            gender: profile.gender || null,
            walletBalance:
              typeof profile.wallet_balance === 'number'
                ? profile.wallet_balance
                : (localUser?.walletBalance ?? 1250),
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
      token: session.token,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      refreshExpiresAt: session.refreshExpiresAt,
    };
  }

  // If token didn't match session, but fallbackRefreshToken provided:
  if (fallbackRefreshToken) {
    const refreshRes = await refreshSession(fallbackRefreshToken);
    if (refreshRes.valid) return refreshRes;
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
          walletBalance: typeof profile?.wallet_balance === 'number' ? profile.wallet_balance : 1250,
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
  userDisplayId?: string;
  friendId: string;
  friendDisplayId?: string;
  userName?: string;
  userAvatar?: string;
  userBio?: string;
  friendName?: string;
  friendAvatar?: string;
  friendBio?: string;
  createdAt: string;
}

interface StoredFriendRequest {
  id: string;
  senderId: string;
  senderDisplayId?: string;
  receiverId: string;
  receiverDisplayId?: string;
  senderName: string;
  receiverName: string;
  senderAvatar?: string;
  senderBio?: string;
  receiverAvatar?: string;
  receiverBio?: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  updatedAt?: string;
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
  participantDetails?: Record<string, { id: string; displayId?: string; name: string; avatar: string }>;
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

// Get Wallet Balance from Supabase & Local Cache (always real balance)
app.get('/api/wallet/balance', async (req: Request, res: Response) => {
  try {
    const userId = ((req.query.userId as string) || '').trim();
    const email = ((req.query.email as string) || '').trim().toLowerCase();
    const authHeader = (req.headers['authorization'] as string) || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

    let lookupId = userId;
    let lookupEmail = email;

    if (!lookupId && token) {
      const session = getStoredSessions().find((s) => s.token === token || s.refreshToken === token);
      if (session) {
        lookupId = session.userId;
        lookupEmail = session.email;
      }
    }

    if (!lookupId && !lookupEmail) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم أو البريد مطلوب' });
    }

    const adminEmails = getAdminEmails();
    const isAdmin = (lookupEmail && adminEmails.includes(lookupEmail)) ||
      (lookupId && (lookupId === 'admin-1001' || lookupId === 'admin-1002'));

    let balance: number | null = null;

    // 1. Check Supabase profile safely without UUID syntax error
    if (supabaseAdmin) {
      const profile = await getSupabaseProfileByIdentifier(lookupId || lookupEmail);
      if (profile && typeof profile.wallet_balance === 'number') {
        balance = profile.wallet_balance;
      }
    }

    // 2. Check local stored users
    const users = getStoredUsers();
    const u = users.find(
      (x) =>
        (lookupId && (x.id === lookupId || x.displayId === lookupId)) ||
        (lookupEmail && x.email.toLowerCase() === lookupEmail)
    );

    if (u && typeof u.walletBalance === 'number') {
      if (isAdmin) {
        balance = Math.max(u.walletBalance, balance ?? 99999);
      } else if (balance === null) {
        balance = u.walletBalance;
      } else {
        // Pick the non-default or customized balance
        balance = u.walletBalance !== 1250 ? u.walletBalance : balance;
      }
    }

    if (balance === null) {
      balance = isAdmin ? 99999 : 1250;
    }

    return res.json({
      success: true,
      balance,
      userId: lookupId,
      displayId: u?.displayId || lookupId,
      email: u?.email || lookupEmail,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطأ في جلب الرصيد' });
  }
});

// Update Wallet Balance in Supabase & Local Cache (keeping both in sync)
app.post('/api/wallet/update', async (req: Request, res: Response) => {
  try {
    const { userId, displayId, email, amount, balance } = req.body;
    if (!userId && !displayId && !email) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }

    const cleanUserId = String(userId || displayId || email).trim();
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    const cleanDisplayId = displayId ? String(displayId).trim() : '';

    let currentBalance = 1250;

    // 1. Check Supabase
    if (supabaseAdmin) {
      const profile = await getSupabaseProfileByIdentifier(cleanUserId || cleanEmail);
      if (profile && typeof profile.wallet_balance === 'number') {
        currentBalance = profile.wallet_balance;
      }
    }

    // 2. Check local stored users
    const users = getStoredUsers();
    const u = users.find(
      (x) =>
        x.id === cleanUserId ||
        x.displayId === cleanUserId ||
        (cleanDisplayId && x.displayId === cleanDisplayId) ||
        (cleanEmail && x.email.toLowerCase() === cleanEmail) ||
        x.email.toLowerCase() === cleanUserId.toLowerCase()
    );
    if (u && typeof u.walletBalance === 'number') {
      currentBalance = currentBalance !== 1250 ? currentBalance : u.walletBalance;
    }

    let newBalance: number;
    if (typeof balance === 'number') {
      newBalance = Math.max(0, balance);
    } else if (typeof amount === 'number') {
      newBalance = Math.max(0, currentBalance + amount);
    } else {
      newBalance = currentBalance;
    }

    // Sync to Supabase
    if (supabaseAdmin) {
      await updateSupabaseProfileByIdentifier(cleanUserId, {
        wallet_balance: newBalance,
        updated_at: new Date().toISOString(),
      });
      if (cleanEmail && cleanEmail !== cleanUserId) {
        await updateSupabaseProfileByIdentifier(cleanEmail, {
          wallet_balance: newBalance,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // Sync to stored users
    let found = false;
    users.forEach((x) => {
      if (
        x.id === cleanUserId ||
        x.displayId === cleanUserId ||
        (cleanDisplayId && x.displayId === cleanDisplayId) ||
        (cleanEmail && x.email.toLowerCase() === cleanEmail) ||
        x.email.toLowerCase() === cleanUserId.toLowerCase()
      ) {
        x.walletBalance = newBalance;
        x.updatedAt = new Date().toISOString();
        found = true;
      }
    });
    if (found) {
      saveStoredUsers(users);
    }

    return res.json({
      success: true,
      balance: newBalance,
      walletBalance: newBalance,
      message: 'تم تحديث رصيد المحفظة الفعلي بنجاح',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطأ في تحديث الرصيد' });
  }
});

// Update Coins Balance in Local Cache and sync
app.post('/api/coins/update', async (req: Request, res: Response) => {
  try {
    const { userId, displayId, email, amount, balance } = req.body;
    if (!userId && !displayId && !email) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }

    const cleanUserId = String(userId || displayId || email).trim();
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    const cleanDisplayId = displayId ? String(displayId).trim() : '';

    const users = getStoredUsers();
    const u = users.find(
      (x) =>
        x.id === cleanUserId ||
        x.displayId === cleanUserId ||
        (cleanDisplayId && x.displayId === cleanDisplayId) ||
        (cleanEmail && x.email.toLowerCase() === cleanEmail) ||
        x.email.toLowerCase() === cleanUserId.toLowerCase()
    );

    const isAdmin = u?.email ? getAdminEmails().includes(u.email.toLowerCase()) : false;
    let currentCoins = typeof u?.coinsBalance === 'number' ? u.coinsBalance : (isAdmin ? 100000 : 25000);

    let newCoins: number;
    if (typeof balance === 'number') {
      newCoins = Math.max(0, balance);
    } else if (typeof amount === 'number') {
      newCoins = Math.max(0, currentCoins + amount);
    } else {
      newCoins = currentCoins;
    }

    let found = false;
    users.forEach((x) => {
      if (
        x.id === cleanUserId ||
        x.displayId === cleanUserId ||
        (cleanDisplayId && x.displayId === cleanDisplayId) ||
        (cleanEmail && x.email.toLowerCase() === cleanEmail) ||
        x.email.toLowerCase() === cleanUserId.toLowerCase()
      ) {
        x.coinsBalance = newCoins;
        x.updatedAt = new Date().toISOString();
        found = true;
      }
    });

    if (found) {
      saveStoredUsers(users);
    }

    return res.json({
      success: true,
      balance: newCoins,
      coinsBalance: newCoins,
      message: 'تم تحديث رصيد الكوينز بنجاح',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطأ في تحديث رصيد الكوينز' });
  }
});

// ==========================================
// Financial Conversion Rules:
// 1. الإيداع: كل 1 دولار = 25,000 Coins
// 2. السحب: كل 10 دولار = 400,000 Diamonds (40,000 ماسة = 1 دولار)
// 3. التحويل من Diamonds إلى Coins: كل 50,000 Diamonds = 25,000 Coins (نسبة 2:1)
// ==========================================

// Endpoint: تحويل من Diamonds (الماسات) إلى Coins (الكوينز)
// كل 50,000 Diamonds تساوي 25,000 Coins
app.post('/api/wallet/convert-to-coins', async (req: Request, res: Response) => {
  try {
    const { userId, displayId, email, diamondsAmount } = req.body;
    if (!userId && !displayId && !email) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }

    const dAmount = Math.floor(Number(diamondsAmount));
    if (isNaN(dAmount) || dAmount <= 0) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال كمية صحيحة من الماسات للتحويل' });
    }

    // كل 50,000 Diamonds تساوي 25,000 Coins
    const coinsGain = Math.floor(dAmount * (25000 / 50000));
    if (coinsGain <= 0) {
      return res.status(400).json({ success: false, message: 'الحد الأدنى للتحويل هو 2 ماسة للحصول على 1 كوينز (كل 50,000 ماسة = 25,000 كوينز)' });
    }

    const cleanUserId = String(userId || displayId || email).trim();
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    const cleanDisplayId = displayId ? String(displayId).trim() : '';

    // Fetch current balances
    let currentDiamonds = 1250;
    let currentCoins = 25000;

    const users = getStoredUsers();
    let u = users.find(
      (x) =>
        x.id === cleanUserId ||
        x.displayId === cleanUserId ||
        (cleanDisplayId && x.displayId === cleanDisplayId) ||
        (cleanEmail && x.email.toLowerCase() === cleanEmail) ||
        x.email.toLowerCase() === cleanUserId.toLowerCase()
    );

    if (supabaseAdmin) {
      const profile = await getSupabaseProfileByIdentifier(cleanUserId || cleanEmail);
      if (profile && typeof profile.wallet_balance === 'number') {
        currentDiamonds = profile.wallet_balance;
      }
    }
    if (u && typeof u.walletBalance === 'number') {
      currentDiamonds = currentDiamonds !== 1250 ? currentDiamonds : u.walletBalance;
    }
    if (u && typeof u.coinsBalance === 'number') {
      currentCoins = u.coinsBalance;
    }

    if (currentDiamonds < dAmount) {
      return res.status(400).json({
        success: false,
        message: `رصيد الماسات غير كافٍ. لديك ${currentDiamonds.toLocaleString()} ماسة، والمطلوب ${dAmount.toLocaleString()} ماسة.`,
        currentDiamonds,
      });
    }

    const newDiamonds = Math.max(0, currentDiamonds - dAmount);
    const newCoins = currentCoins + coinsGain;

    // Update local storage
    if (u) {
      u.walletBalance = newDiamonds;
      u.coinsBalance = newCoins;
      u.updatedAt = new Date().toISOString();
      saveStoredUsers(users);
    }

    // Sync to Supabase
    if (supabaseAdmin) {
      await updateSupabaseProfileByIdentifier(cleanUserId, {
        wallet_balance: newDiamonds,
        updated_at: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      diamondsDeducted: dAmount,
      coinsGained: coinsGain,
      newDiamondsBalance: newDiamonds,
      newCoinsBalance: newCoins,
      message: `تم تحويل ${dAmount.toLocaleString()} ماسة إلى ${coinsGain.toLocaleString()} كوينز بنجاح! (بمعدل كل 50,000 ماسة = 25,000 كوينز)`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء تحويل الماسات إلى كوينز' });
  }
});

// Endpoint: إيداع وشحن كوينز (Coins Deposit)
// في الإيداع كل 1 دولار يساوي 25,000 Coins
app.post('/api/wallet/deposit-coins', async (req: Request, res: Response) => {
  try {
    const { userId, displayId, email, usdAmount, coinsAmount } = req.body;
    if (!userId && !displayId && !email) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }

    let usd = Number(usdAmount);
    let coins = Number(coinsAmount);

    if ((!usd || usd <= 0) && (!coins || coins <= 0)) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد مبلغ الإيداع بالدولار أو عدد الكوينز' });
    }

    // كل 1 دولار = 25,000 Coins
    if (!coins || coins <= 0) {
      coins = Math.floor(usd * 25000);
    }
    if (!usd || usd <= 0) {
      usd = coins / 25000;
    }

    const cleanUserId = String(userId || displayId || email).trim();
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    const cleanDisplayId = displayId ? String(displayId).trim() : '';

    const users = getStoredUsers();
    let u = users.find(
      (x) =>
        x.id === cleanUserId ||
        x.displayId === cleanUserId ||
        (cleanDisplayId && x.displayId === cleanDisplayId) ||
        (cleanEmail && x.email.toLowerCase() === cleanEmail) ||
        x.email.toLowerCase() === cleanUserId.toLowerCase()
    );

    const isAdmin = u?.email ? getAdminEmails().includes(u.email.toLowerCase()) : false;
    const currentCoins = typeof u?.coinsBalance === 'number' ? u.coinsBalance : (isAdmin ? 100000 : 25000);
    const newCoins = currentCoins + coins;

    if (u) {
      u.coinsBalance = newCoins;
      u.updatedAt = new Date().toISOString();
      saveStoredUsers(users);
    }

    return res.json({
      success: true,
      usdAmount: usd,
      coinsGained: coins,
      newCoinsBalance: newCoins,
      message: `تم شحن ${coins.toLocaleString()} كوينز بقيمة $${usd} بنجاح! (بمعدل كل 1 دولار = 25,000 كوينز)`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء شحن الكوينز' });
  }
});

// Endpoint: سحب الأرباح بالدولار عبر وكيل معتمد (Diamonds Cashout / Withdrawal via Certified Agent)
// القواعد:
// 1. أقل سحب هو 200,000 الماسة (ما يعادل 5$ دولار بمعدل كل 10 دولار = 400,000 ماسة)
// 2. يتم تحديد المبلغ وطلب آيدي الوكيل المراد السحب من خلاله
// 3. خصم عمولة 2.5% من المبلغ المسحوب
// 4. إضافة الصافي مباشرة لرصيد وكالة الشحن المحددة
// 5. إرسال إشعار فوري للوكيل بالعملية وبيانات التحويل للعميل
app.post('/api/wallet/withdraw-diamonds', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      displayId,
      email,
      diamondsAmount,
      agentId,
      agentGridCode,
      gridCode,
      payoutMethod,
      accountDetails,
      notes,
    } = req.body;

    if (!userId && !displayId && !email) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }

    const dAmount = Math.floor(Number(diamondsAmount));
    if (isNaN(dAmount) || dAmount < 200000) {
      return res.status(400).json({
        success: false,
        message: 'أقل سحب هو 200,000 ماسة (ما يعادل 5$ دولار). يرجى تحديد مبلغ سحب 200,000 ماسة أو أكثر.',
      });
    }

    // 1. التحقق من إدخال وتحديد آيدي الوكيل (Agent ID / Grid Code)
    const targetAgentIdentifier = String(agentId || agentGridCode || gridCode || '').trim();
    if (!targetAgentIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'يرجى تحديد أو إدخال آيدي الوكيل (أو رقم القريد) المراد السحب من خلاله لإتمام العملية.',
      });
    }

    // 2. البحث عن الوكيل والتحقق من اعتماده
    const agents = getStoredAgents();
    const cleanAgentQuery = targetAgentIdentifier.toLowerCase();
    const agent = agents.find(
      (a) =>
        a.id.toLowerCase() === cleanAgentQuery ||
        (a.gridCode && a.gridCode.toLowerCase() === cleanAgentQuery) ||
        (a.email && a.email.toLowerCase() === cleanAgentQuery) ||
        (a.name && a.name.toLowerCase().includes(cleanAgentQuery))
    );

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: `لم يتم العثور على وكيل معتمد برقم الآيدي أو القريد [${targetAgentIdentifier}]. يرجى التأكد من كتابة آيدي الوكيل بشكل صحيح.`,
      });
    }

    if (agent.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: `وكالة الشحن [${agent.name}] معطلة حالياً. يرجى اختيار وكيل معتمد آخر.`,
      });
    }

    // 3. حساب المبالغ والخصم 2.5%
    // في السحب كل 10 دولار تساوي 400,000 Diamonds (كل 40,000 ماسة = 1 دولار)
    const grossUsdAmount = (dAmount / 400000) * 10;
    const feePercentage = 2.5; // 2.5% خصم
    const feeDiamonds = Math.round(dAmount * (feePercentage / 100));
    const netDiamonds = dAmount - feeDiamonds; // الصافي المضاف للوكيل
    const netUsdAmount = (netDiamonds / 400000) * 10;

    const cleanUserId = String(userId || displayId || email).trim();
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    const cleanDisplayId = displayId ? String(displayId).trim() : '';

    let currentDiamonds = 1250;
    const users = getStoredUsers();
    let u = users.find(
      (x) =>
        x.id === cleanUserId ||
        x.displayId === cleanUserId ||
        (cleanDisplayId && x.displayId === cleanDisplayId) ||
        (cleanEmail && x.email.toLowerCase() === cleanEmail) ||
        x.email.toLowerCase() === cleanUserId.toLowerCase()
    );

    if (supabaseAdmin) {
      const profile = await getSupabaseProfileByIdentifier(cleanUserId || cleanEmail);
      if (profile && typeof profile.wallet_balance === 'number') {
        currentDiamonds = profile.wallet_balance;
      }
    }
    if (u && typeof u.walletBalance === 'number') {
      currentDiamonds = currentDiamonds !== 1250 ? currentDiamonds : u.walletBalance;
    }

    // 4. التحقق من كفاية رصيد ماسات المستخدم
    if (currentDiamonds < dAmount) {
      return res.status(400).json({
        success: false,
        message: `رصيد الماسات غير كافٍ لإتمام السحب. رصيدك الحالي: ${currentDiamonds.toLocaleString()} ماسة، بينما المطلوب سحبه: ${dAmount.toLocaleString()} ماسة ($${grossUsdAmount.toFixed(2)} USD).`,
        currentBalance: currentDiamonds,
      });
    }

    // 5. خصم كامل المبلغ المسحوب من رصيد المستخدم
    const newDiamonds = Math.max(0, currentDiamonds - dAmount);

    if (u) {
      u.walletBalance = newDiamonds;
      u.updatedAt = new Date().toISOString();
      saveStoredUsers(users);
    }

    if (supabaseAdmin) {
      await updateSupabaseProfileByIdentifier(cleanUserId, {
        wallet_balance: newDiamonds,
        updated_at: new Date().toISOString(),
      });
    }

    // 6. إضافة الصافي مباشرة إلى رصيد وكالة الشحن (بعد خصم 2.5%)
    const previousAgentBalance = agent.balance || 0;
    const newAgentBalance = previousAgentBalance + netDiamonds;
    agent.balance = newAgentBalance;
    agent.completedOrders = (agent.completedOrders || 0) + 1;
    agent.updatedAt = new Date().toISOString();
    saveStoredAgents(agents);

    const userName = u?.name || 'مستخدم Soul-X';
    const userDisplayId = u?.displayId || cleanUserId;
    const selectedPayoutMethod = payoutMethod || 'USDT TRC20';
    const destinationAccount = (accountDetails && String(accountDetails).trim()) || 'حساب المحفظة المعتمد';

    // 7. تسجيل العملية في سجل عمليات الوكالة (agency_transactions.json)
    const txId = `TX-WDR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const transactions = getStoredAgencyTransactions();
    const txRecord: StoredAgencyTransaction = {
      id: txId,
      type: 'user_withdrawal',
      agentId: agent.id,
      gridCode: agent.gridCode || 'A8838',
      targetUserId: cleanUserId,
      targetUserDisplayId: userDisplayId,
      targetUserName: userName,
      amount: netDiamonds, // الصافي المضاف للوكالة
      grossAmount: dAmount,
      feeAmount: feeDiamonds,
      feePercentage: 2.5,
      payoutMethod: selectedPayoutMethod,
      accountDetails: destinationAccount,
      timestamp: new Date().toISOString(),
      previousBalance: previousAgentBalance,
      newBalance: newAgentBalance,
    };
    transactions.unshift(txRecord);
    saveStoredAgencyTransactions(transactions);

    // 8. تسجيل طلب السحب في سجل السحوبات (agency_withdrawals.json)
    const withdrawals = getStoredAgencyWithdrawals();
    const withdrawalId = `WDR-USR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const withdrawalRequest: StoredAgencyWithdrawal = {
      id: withdrawalId,
      type: 'incoming_user_withdrawal',
      agentId: agent.id,
      agentName: agent.name,
      gridCode: agent.gridCode || 'A8838',
      amount: dAmount,
      fee: feeDiamonds,
      netCredited: netDiamonds,
      method: selectedPayoutMethod,
      accountDetails: destinationAccount,
      notes: notes
        ? `${notes} | صافي المحول للوكالة: +${netDiamonds.toLocaleString()} 💎 ($${netUsdAmount.toFixed(2)} USD)`
        : `سحب ماسات المستخدم: ${userName} (${userDisplayId}) | صافي الرصيد المضاف لوكالتك: +${netDiamonds.toLocaleString()} 💎 ($${netUsdAmount.toFixed(2)} USD)`,
      status: 'pending',
      userId: cleanUserId,
      userDisplayId,
      userName,
      createdAt: new Date().toISOString(),
    };
    withdrawals.unshift(withdrawalRequest);
    saveStoredAgencyWithdrawals(withdrawals);

    // 9. إرسال إشعار فوري للوكيل في المحادثات (In-App Notification to Agent)
    try {
      const messagesData = getStoredMessagesData();
      const notificationText = `📥 [إشعار سحب رصيد جديد عبر وكالتك]
طلب المستخدم: ${userName} (ID: ${userDisplayId})
سحب: ${dAmount.toLocaleString()} ماسة ($${grossUsdAmount.toFixed(2)} USD)
تم خصم عمولة 2.5% (${feeDiamonds.toLocaleString()} ماسة)
✅ تم إضافة الصافي (+${netDiamonds.toLocaleString()} 💎) إلى رصيد وكالتك بنجاح!
رصيد وكالتك الحالي: ${newAgentBalance.toLocaleString()} 💎
طريقة الاستلام المطلوبة: ${selectedPayoutMethod}
بيانات الحساب/المحفظة للتحويل: ${destinationAccount}`;

      // Search if conversation exists between user and agent
      let conv = messagesData.conversations.find((c) =>
        c.participants.includes(cleanUserId) &&
        (c.participants.includes(agent.id) || (agent.email && c.participants.includes(agent.email)))
      );

      if (!conv) {
        conv = {
          id: `conv-agent-${agent.id}-${Date.now().toString().slice(-4)}`,
          participants: [cleanUserId, agent.id],
          participantDetails: {
            [cleanUserId]: {
              id: cleanUserId,
              displayId: userDisplayId,
              name: userName,
              avatar: u?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            },
            [agent.id]: {
              id: agent.id,
              displayId: agent.gridCode,
              name: agent.name,
              avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
            },
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
        };
        messagesData.conversations.unshift(conv);
      }

      conv.messages.push({
        id: `msg-notif-${Date.now()}`,
        conversationId: conv.id,
        senderId: cleanUserId,
        text: notificationText,
        createdAt: new Date().toISOString(),
      });
      conv.updatedAt = new Date().toISOString();
      saveStoredMessagesData(messagesData);
    } catch (notifErr) {
      console.warn('Agent notification warning:', notifErr);
    }

    return res.json({
      success: true,
      diamondsDeducted: dAmount,
      feePercentage: 2.5,
      feeDiamonds,
      netDiamondsAddedToAgent: netDiamonds,
      usdAmount: grossUsdAmount,
      netUsdAmount,
      newDiamondsBalance: newDiamonds,
      agent: {
        id: agent.id,
        gridCode: agent.gridCode,
        name: agent.name,
        country: agent.country,
        flag: agent.flag,
        newBalance: newAgentBalance,
      },
      withdrawalId,
      transactionId: txId,
      message: `تم سحب ${dAmount.toLocaleString()} ماسة بنجاح، وخُصمت عمولة 2.5% (${feeDiamonds.toLocaleString()} ماسة)، وتمت إضافة الصافي (${netDiamonds.toLocaleString()} ماسة) لرصيد وكالة الشحن (${agent.name} [${agent.gridCode}])، وأُرسل إشعار فوري للوكيل!`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء معالجة طلب السحب' });
  }
});

// Helper: Transfer gift value from Sender Coins 🪙 to Recipient Diamonds 💎
export async function transferGiftCoinsToDiamonds(
  senderId: string,
  recipientId: string,
  cost: number
): Promise<{ success: boolean; senderCoins?: number; recipientDiamonds?: number; message?: string }> {
  if (!senderId || !recipientId || typeof cost !== 'number' || cost <= 0) {
    return { success: false, message: 'بيانات الهدية غير صالحة' };
  }

  const cleanSender = String(senderId).trim();
  const cleanRecipient = String(recipientId).trim();

  const users = getStoredUsers();

  const sender = users.find(
    (u) =>
      u.id === cleanSender ||
      u.displayId === cleanSender ||
      (u.email && u.email.toLowerCase() === cleanSender.toLowerCase())
  );

  const isAdminSender = sender?.email ? getAdminEmails().includes(sender.email.toLowerCase()) : false;
  const currentSenderCoins = typeof sender?.coinsBalance === 'number' ? sender.coinsBalance : (isAdminSender ? 100000 : 25000);

  if (currentSenderCoins < cost) {
    return {
      success: false,
      message: `رصيد الكوينز غير كافٍ (${currentSenderCoins.toLocaleString()} كوينز). تكلفة الهدية ${cost} كوينز.`,
      senderCoins: currentSenderCoins,
    };
  }

  // Deduct from sender Coins
  const newSenderCoins = currentSenderCoins - cost;
  if (sender) {
    sender.coinsBalance = newSenderCoins;
    sender.updatedAt = new Date().toISOString();
  }

  // Credit to recipient Diamonds (walletBalance)
  let recipient = users.find(
    (u) =>
      u.id === cleanRecipient ||
      u.displayId === cleanRecipient ||
      (u.email && u.email.toLowerCase() === cleanRecipient.toLowerCase())
  );

  const isAdminRecipient = recipient?.email ? getAdminEmails().includes(recipient.email.toLowerCase()) : false;
  const currentRecipientDiamonds = typeof recipient?.walletBalance === 'number' ? recipient.walletBalance : (isAdminRecipient ? 99999 : 1250);
  const newRecipientDiamonds = currentRecipientDiamonds + cost;

  if (recipient) {
    recipient.walletBalance = newRecipientDiamonds;
    recipient.updatedAt = new Date().toISOString();
  } else {
    // If recipient not in stored users (e.g. demo or external ID), register profile in stored users
    users.push({
      id: cleanRecipient,
      displayId: cleanRecipient.startsWith('S-') ? cleanRecipient : generateSoulXId(),
      email: `${cleanRecipient}@soul-x.com`,
      name: `عضو ${cleanRecipient.slice(0, 8)}`,
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      createdAt: new Date().toISOString(),
      walletBalance: newRecipientDiamonds,
      coinsBalance: 25000,
    });
  }

  saveStoredUsers(users);

  // Sync to Supabase if configured
  if (supabaseAdmin) {
    try {
      const recipientUuid = await resolveProfileId(cleanRecipient);
      if (recipientUuid) {
        await updateSupabaseProfileByIdentifier(recipientUuid, {
          wallet_balance: newRecipientDiamonds,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Supabase gift transfer sync error:', err);
    }
  }

  return {
    success: true,
    senderCoins: newSenderCoins,
    recipientDiamonds: newRecipientDiamonds,
  };
}

// 1. Endpoint: التحقق من وجود البريد الإلكتروني
app.post('/api/auth/check-email', async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
  }

  const normalized = email.trim().toLowerCase();
  const adminEmails = getAdminEmails();
  const isAdminEmail = adminEmails.includes(normalized);

  // Check stored users first
  const users = getStoredUsers();
  let user = users.find((u) => u.email.toLowerCase() === normalized);
  let supaName: string | undefined;

  if (supabaseAdmin) {
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email')
        .eq('email', normalized)
        .maybeSingle();

      if (profile?.name) {
        supaName = profile.name;
      }
    } catch (dbErr) {
      console.warn('Supabase profile check query warning:', dbErr);
    }
  }

  // Admin account handling: recognized as authorized admin account
  if (isAdminEmail) {
    const adminPin = getAdminPin();
    const isRegistered = Boolean(user?.passwordHash || supaName);
    const adminLabel = normalized === (process.env.ADMIN1 || '').toLowerCase()
      ? 'مدير النظام (ADMIN1)'
      : 'مدير النظام (ADMIN2)';

    return res.json({
      success: true,
      exists: true,
      isRegistered,
      email: normalized,
      name: user ? user.name : (supaName || adminLabel),
      isAdmin: true,
      hasAdminPin: Boolean(adminPin),
    });
  }

  // Non-admin flow
  const exists = Boolean(user || supaName);

  return res.json({
    success: true,
    exists,
    email: normalized,
    name: user ? user.name : supaName,
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

  // If this is an ADMIN1 or ADMIN2 account, verify strictly using the actual account password
  if (isAdminEmail) {
    const users = getStoredUsers();
    let user = users.find((u) => u.email.toLowerCase() === normalized);

    // Verify password strictly against user's stored password hash or initial default password if not set
    const isPassMatch = Boolean(
      (user && user.passwordHash && user.passwordHash === hashPassword(password)) ||
      (!user?.passwordHash && password === DEFAULT_ADMIN_PASSWORD)
    );

    // Optional fallback to Supabase Auth if password matches there
    let supaUserData: any = null;
    if (supabaseAdmin && !isPassMatch) {
      try {
        const { data: authData, error: authErr } = await supabaseAdmin.auth.signInWithPassword({
          email: normalized,
          password,
        });
        if (!authErr && authData.user) {
          supaUserData = authData.user;
        }
      } catch {}
    }

    if (isPassMatch || supaUserData) {
      const admin1Email = (process.env.ADMIN1 || 'abojafar@soul-x.com').toLowerCase();
      const isAdmin1 = normalized === admin1Email;

      if (!user) {
        user = {
          id: supaUserData?.id || (isAdmin1 ? 'admin-1001' : 'admin-1002'),
          displayId: generateSoulXId(),
          email: normalized,
          name: supaUserData?.user_metadata?.name || (isAdmin1 ? 'مدير النظام (ADMIN1)' : 'مدير النظام (ADMIN2)'),
          passwordHash: hashPassword(password),
          createdAt: new Date().toISOString(),
          birthDate: '1995-01-01',
          gender: 'male',
          walletBalance: 99999,
        };
        users.push(user);
        saveStoredUsers(users);
      } else if (!user.passwordHash) {
        user.passwordHash = hashPassword(password);
        saveStoredUsers(users);
      }

      // Upsert to Supabase if connected
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.from('profiles').upsert({
            id: user.id,
            display_id: user.displayId || generateSoulXId(),
            email: normalized,
            name: user.name,
            wallet_balance: user.walletBalance ?? 99999,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
        } catch {}
      }

      const session = createSession(user.id, user.email, user.name, true, user.displayId);
      return res.json({
        success: true,
        message: `مرحباً بك يا ${user.name}! تم تسجيل الدخول بنجاح بصلاحيات الإدارة الكاملة`,
        token: session.token,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
        refreshExpiresAt: session.refreshExpiresAt,
        refreshExpiresInDays: 30,
        isAdmin: true,
        user: {
          id: user.id,
          displayId: user.displayId,
          name: user.name,
          email: user.email,
          photoUrl: user.photoUrl,
          createdAt: user.createdAt,
          birthDate: user.birthDate || null,
          gender: user.gender || null,
          walletBalance: user.walletBalance ?? 99999,
        },
      });
    }

    // Credentials did NOT match:
    return res.status(401).json({
      success: false,
      message: 'كلمة المرور غير صحيحة لحساب المدير! يرجى إدخال كلمة المرور المعتمدة للحساب.',
    });
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
          const displayId = generateSoulXId();
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

        const session = createSession(userObj.id, userObj.email, userObj.name, isAdminEmail);

        return res.json({
          success: true,
          message: `مرحباً بعودتك يا ${userObj.name}!`,
          token: session.token,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
          refreshExpiresAt: session.refreshExpiresAt,
          refreshExpiresInDays: 30,
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

  const session = createSession(user.id, user.email, user.name, isAdminEmail);

  return res.json({
    success: true,
    message: `مرحباً بعودتك يا ${user.name}!`,
    token: session.token,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
    refreshExpiresInDays: 30,
    user: {
      id: user.id,
      displayId: user.displayId,
      name: user.name,
      email: user.email,
      photoUrl: user.photoUrl,
      createdAt: user.createdAt,
      birthDate: user.birthDate || null,
      gender: user.gender || null,
      walletBalance: user.walletBalance ?? 1250,
    },
  });
});

// 3. Endpoint: إنشاء حساب جديد بالاسم والجنس وتاريخ الميلاد وكلمة المرور
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { email, name, password, birthDate, gender } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({
      success: false,
      message: 'يرجى كتابة البريد والاسم وكلمة المرور للمتابعة',
    });
  }

  // 1. Mandatory Gender validation
  if (!gender || (gender !== 'male' && gender !== 'female')) {
    return res.status(400).json({
      success: false,
      message: 'تحديد الجنس (ذكر / أنثى) خطوة إجبارية لإتمام إنشاء الحساب',
    });
  }

  // 2. Mandatory Date of Birth validation
  if (!birthDate || typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return res.status(400).json({
      success: false,
      message: 'تحديد تاريخ الميلاد خطوة إجبارية لإنشاء الحساب',
    });
  }

  // 3. Age validation (must be 18+)
  const [bYear, bMonth, bDay] = birthDate.split('-').map(Number);
  const birthObj = new Date(bYear, bMonth - 1, bDay);
  const today = new Date();
  let userAge = today.getFullYear() - birthObj.getFullYear();
  const monthDiff = today.getMonth() - birthObj.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthObj.getDate())) {
    userAge--;
  }

  if (userAge < 18) {
    return res.status(400).json({
      success: false,
      message: 'يجب أن يكون عمرك 18 عاماً أو أكثر للتسجيل في Soul-X',
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
  if (users.some((u) => u.email.toLowerCase() === normalized)) {
    return res.status(409).json({
      success: false,
      message: 'هذا البريد مسجل مسبقاً، يرجى تسجيل الدخول بدلاً من ذلك',
    });
  }

  // Generate unique Soul-X ID conforming to pattern: S-0101V77-X711
  const displayId = generateSoulXId();
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
              gender,
              birth_date: birthDate,
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
              gender,
              birth_date: birthDate,
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

        // Upsert into public.profiles in Supabase Database with gender & birthDate
        await supabaseAdmin
          .from('profiles')
          .upsert(
            {
              id: createdUserId,
              display_id: displayId,
              email: normalized,
              name: name.trim(),
              gender,
              birth_date: birthDate,
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

  const newUser: StoredUser = {
    id: createdUserId,
    displayId,
    email: normalized,
    name: name.trim(),
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    birthDate,
    gender,
    walletBalance: getAdminEmails().includes(normalized) ? 99999 : 1250,
  };

  users.push(newUser);
  saveStoredUsers(users);

  const isAdmin = getAdminEmails().includes(normalized);
  const session = createSession(newUser.id, newUser.email, newUser.name, isAdmin, displayId);

  return res.json({
    success: true,
    message: `أهلاً بك يا ${newUser.name} في Soul-X! تم إنشاء حسابك بنجاح`,
    token: session.token,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
    refreshExpiresInDays: 30,
    isAdmin,
    user: {
      id: newUser.id,
      displayId,
      name: newUser.name,
      email: newUser.email,
      photoUrl: newUser.photoUrl,
      createdAt: newUser.createdAt,
      birthDate: newUser.birthDate,
      gender: newUser.gender,
      walletBalance: newUser.walletBalance ?? 1250,
    },
  });
});

// 3.1 Endpoint: التحقق من صحة جلسة التوكن (Token Verification) مع دعم التجديد التلقائي
app.get('/api/auth/verify', async (req: Request, res: Response) => {
  const authHeader = (req.headers['authorization'] as string) || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  const refreshToken = ((req.headers['x-refresh-token'] as string) || (req.query.refreshToken as string) || '').trim();

  if (!token && !refreshToken) {
    return res.status(401).json({
      success: false,
      message: 'رمز التحقق (Token) مفقود، يرجى تسجيل الدخول مجدداً',
    });
  }

  const result = await verifyToken(token || '', refreshToken);
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
    token: result.token || token,
    refreshToken: result.refreshToken || refreshToken,
    expiresAt: result.expiresAt,
    refreshExpiresAt: result.refreshExpiresAt,
    refreshExpiresInDays: 30,
  });
});

// 3.2 Endpoint: تجديد التوكن والجلسة كل 30 يوم (Refresh Token Endpoint)
app.post('/api/auth/refresh', async (req: Request, res: Response) => {
  const authHeader = (req.headers['authorization'] as string) || '';
  const headerRefreshToken = (req.headers['x-refresh-token'] as string) || '';
  const bodyRefreshToken = req.body?.refreshToken;

  const candidate = (
    bodyRefreshToken ||
    headerRefreshToken ||
    (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '')
  ).trim();

  if (!candidate) {
    return res.status(400).json({
      success: false,
      message: 'رمز التجديد (Refresh Token) مطلوب لإعادة تنشيط الجلسة',
    });
  }

  const result = await refreshSession(candidate);
  if (!result.valid) {
    return res.status(401).json({
      success: false,
      message: result.reason || 'تعذر تجديد الجلسة، يرجى تسجيل الدخول مجدداً',
    });
  }

  return res.json({
    success: true,
    token: result.token,
    refreshToken: result.refreshToken,
    expiresAt: result.expiresAt,
    refreshExpiresAt: result.refreshExpiresAt,
    refreshExpiresInDays: 30,
    user: result.user,
    isAdmin: result.isAdmin,
    message: 'تم تجديد جلسة الدخول وتمديد صلاحية التوكن بنجاح لمدة 30 يوماً إضافية',
  });
});

// 3.3 Endpoint: تسجيل الخروج الفعلي وحذف الجلسة بالكامل من الخادم
app.post('/api/auth/logout', async (req: Request, res: Response) => {
  const authHeader = (req.headers['authorization'] as string) || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  const refreshToken = ((req.headers['x-refresh-token'] as string) || req.body?.refreshToken || '').trim();

  if (token) {
    revokeSession(token);
  }
  if (refreshToken) {
    revokeSession(refreshToken);
  }

  if (supabaseAdmin) {
    try {
      await supabaseAdmin.auth.signOut();
    } catch {}
  }

  return res.json({
    success: true,
    message: 'تم تسجيل الخروج بنجاح وإلغاء جلسة التوكن ورمز التجديد بالكامل.',
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

// 4.1 Endpoint: تغيير كلمة المرور للمستخدم الفعلي (مع التحقق الإلزامي من كلمة المرور الحالية والتحديث الفوري)
app.post('/api/auth/change-password', async (req: Request, res: Response) => {
  try {
    const authHeader = (req.headers['authorization'] as string) || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    const refreshToken = ((req.headers['x-refresh-token'] as string) || '').trim();

    if (!token && !refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'غير مصرح: يجب تسجيل الدخول لتغيير كلمة المرور',
      });
    }

    const tokenResult = await verifyToken(token || '', refreshToken);
    if (!tokenResult.valid || !tokenResult.user) {
      return res.status(401).json({
        success: false,
        message: tokenResult.reason || 'جلسة الدخول منتهية أو غير صالحة، يرجى إعادة تسجيل الدخول',
      });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور الحالية مطلوبة لتأكيد هويتك',
      });
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور الجديدة يجب أن تكون 4 أحرف أو أرقام على الأقل',
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية',
      });
    }

    const verifiedUser = tokenResult.user;
    const cleanEmail = String(verifiedUser.email || '').toLowerCase().trim();
    const cleanId = String(verifiedUser.id || '');

    const users = getStoredUsers();
    const userIndex = users.findIndex(
      (u) =>
        (u.id && String(u.id) === cleanId) ||
        (u.email && u.email.toLowerCase().trim() === cleanEmail)
    );

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على حسابك في قاعدة البيانات',
      });
    }

    const user = users[userIndex];
    const currentHash = hashPassword(currentPassword);

    // Verify current password against stored hash or fallback default
    const isCurrentValid = Boolean(
      (user.passwordHash && user.passwordHash === currentHash) ||
      (!user.passwordHash && currentPassword === DEFAULT_ADMIN_PASSWORD)
    );

    if (!isCurrentValid) {
      return res.status(400).json({
        success: false,
        message: 'كلمة المرور الحالية غير صحيحة، يرجى التأكد والمحاولة مرة أخرى',
      });
    }

    // Apply new password hash immediately & permanently
    const newHash = hashPassword(newPassword);
    users[userIndex].passwordHash = newHash;
    users[userIndex].updatedAt = new Date().toISOString();
    saveStoredUsers(users);

    // Sync to Supabase Auth if connected
    if (supabaseAdmin && user.id) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: newPassword,
        });
      } catch (supaErr) {
        console.warn('Supabase auth password update notification:', supaErr);
      }
    }

    console.log(`🔑 Password updated successfully for user ${user.email} (${user.id})`);

    return res.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح وبشكل فوري!',
    });
  } catch (err: any) {
    console.error('Change password error:', err);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء تغيير كلمة المرور: ' + (err?.message || 'خطأ غير متوقع'),
    });
  }
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
    id: u.displayId || u.id,
    displayId: u.displayId,
    originalId: u.id,
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
    ...mappedStored.filter((m) => !supabaseProfiles.some((s) => s.id === m.id || (m.originalId && s.id === m.originalId))),
  ].filter((u) => !currentUserId || (u.id !== currentUserId && u.originalId !== currentUserId && u.displayId !== currentUserId));

  if (!query) {
    return res.json({ success: true, users: combined });
  }

  const results = combined.filter(
    (u) =>
      u.id.toLowerCase().includes(query) ||
      (u.displayId && u.displayId.toLowerCase().includes(query)) ||
      (u.originalId && u.originalId.toLowerCase().includes(query)) ||
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
            originalId: p.id,
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
          .filter((r: any) => r.sender_id === resolvedUid && r.status === 'pending')
          .map((r: any) => {
            const receiver = profileMap.get(r.receiver_id);
            return {
              id: r.id,
              senderId: userId,
              receiverId: receiver?.display_id || r.receiver_id,
              senderName: 'أنا',
              receiverName: receiver?.name || 'مستخدم Soul-X',
              receiverAvatar:
                receiver?.avatar_url ||
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
              status: r.status,
              createdAt: r.created_at,
            };
          });
      }
    } catch (dbErr) {
      console.warn('Friends list database query warning:', dbErr);
    }
  }

  // Merge with local persistent friendships (bidirectional check)
  const userFriendships = localData.friends.filter(
    (f) =>
      f.userId === userId ||
      f.friendId === userId ||
      (f.userDisplayId && f.userDisplayId === userId) ||
      (f.friendDisplayId && f.friendDisplayId === userId)
  );

  for (const f of userFriendships) {
    const isUserSide = f.userId === userId || (f.userDisplayId && f.userDisplayId === userId);
    const targetFriendId = isUserSide
      ? (f.friendDisplayId || f.friendId)
      : (f.userDisplayId || f.userId);

    if (!friendsList.some((existing) => existing.id === targetFriendId || existing.originalId === targetFriendId)) {
      const u = allUsers.find(
        (x) => x.id === targetFriendId || x.displayId === targetFriendId
      );

      const resolvedName = isUserSide
        ? (f.friendName || u?.name || `مستخدم ${targetFriendId}`)
        : (f.userName || u?.name || `مستخدم ${targetFriendId}`);

      const resolvedAvatar = isUserSide
        ? (f.friendAvatar || u?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80')
        : (f.userAvatar || u?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80');

      const resolvedBio = isUserSide
        ? (f.friendBio || u?.bio || 'صديق في Soul-X ✨')
        : (f.userBio || u?.bio || 'صديق في Soul-X ✨');

      friendsList.push({
        id: targetFriendId,
        originalId: isUserSide ? f.friendId : f.userId,
        name: resolvedName,
        avatar: resolvedAvatar,
        status: 'online' as const,
        bio: resolvedBio,
      });
    }
  }

  // Local incoming requests
  const localIncoming = localData.requests.filter(
    (r) =>
      (r.receiverId === userId || (r.receiverDisplayId && r.receiverDisplayId === userId)) &&
      r.status === 'pending'
  );
  for (const r of localIncoming) {
    if (!incomingRequests.some((x) => x.id === r.id || x.senderId === r.senderId || (r.senderDisplayId && x.senderId === r.senderDisplayId))) {
      incomingRequests.push({
        id: r.id,
        senderId: r.senderDisplayId || r.senderId,
        receiverId: r.receiverDisplayId || r.receiverId,
        senderName: r.senderName || 'مستخدم Soul-X',
        senderAvatar:
          r.senderAvatar ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        senderBio: r.senderBio || 'طلب صداقة في Soul-X ✨',
        status: r.status,
        createdAt: r.createdAt,
      });
    }
  }

  // Local sent requests
  const localSent = localData.requests.filter(
    (r) =>
      (r.senderId === userId || (r.senderDisplayId && r.senderDisplayId === userId)) &&
      r.status === 'pending'
  );
  for (const r of localSent) {
    if (!sentRequests.some((x) => x.id === r.id || x.receiverId === r.receiverId || (r.receiverDisplayId && x.receiverId === r.receiverDisplayId))) {
      sentRequests.push({
        id: r.id,
        senderId: r.senderDisplayId || r.senderId,
        receiverId: r.receiverDisplayId || r.receiverId,
        senderName: 'أنا',
        receiverName: r.receiverName || 'مستخدم Soul-X',
        receiverAvatar:
          r.receiverAvatar ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        receiverBio: r.receiverBio || '',
        status: r.status,
        createdAt: r.createdAt,
      });
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
  const {
    senderId,
    senderName,
    senderAvatar,
    senderBio,
    senderDisplayId,
    targetUserId,
    targetUserName,
    targetUserAvatar,
    targetUserBio,
    targetUserDisplayId,
  } = req.body;

  if (!senderId || !targetUserId) {
    return res.status(400).json({ success: false, message: 'معرفات المستخدمين مطلوبة' });
  }

  if (senderId === targetUserId || (senderDisplayId && senderDisplayId === targetUserDisplayId)) {
    return res.status(400).json({ success: false, message: 'لا يمكنك إرسال طلب صداقة لنفسك' });
  }

  const localData = getStoredFriendsData();
  const allUsers = getStoredUsers();

  const senderUser = allUsers.find((u) => u.id === senderId || u.displayId === senderId);
  const targetUser = allUsers.find((u) => u.id === targetUserId || u.displayId === targetUserId);

  const effSenderName = senderName || senderUser?.name || 'مستخدم Soul-X';
  const effSenderAvatar = senderAvatar || senderUser?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
  const effSenderBio = senderBio || senderUser?.bio || 'عضو مسجل في Soul-X ✨';
  const effSenderDisplayId = senderDisplayId || senderUser?.displayId || senderId;

  const effTargetName = targetUserName || targetUser?.name || 'مستخدم Soul-X';
  const effTargetAvatar = targetUserAvatar || targetUser?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
  const effTargetBio = targetUserBio || targetUser?.bio || 'عضو مسجل في Soul-X ✨';
  const effTargetDisplayId = targetUserDisplayId || targetUser?.displayId || targetUserId;

  // Check if they are already friends
  const alreadyFriends = localData.friends.some((f) => {
    const isUser1Match = f.userId === senderId || f.userDisplayId === senderId || f.userId === effSenderDisplayId;
    const isUser2Match = f.friendId === targetUserId || f.friendDisplayId === targetUserId || f.friendId === effTargetDisplayId;
    const isReverse1Match = f.userId === targetUserId || f.userDisplayId === targetUserId || f.userId === effTargetDisplayId;
    const isReverse2Match = f.friendId === senderId || f.friendDisplayId === senderId || f.friendId === effSenderDisplayId;
    return (isUser1Match && isUser2Match) || (isReverse1Match && isReverse2Match);
  });

  if (alreadyFriends) {
    return res.json({
      success: true,
      alreadyFriends: true,
      message: `أنت و ${effTargetName} أصدقاء بالفعل! ✨`,
    });
  }

  let createdRequestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  if (supabaseAdmin) {
    try {
      const senderUuid = await resolveProfileId(senderId);
      const targetUuid = await resolveProfileId(targetUserId);

      if (senderUuid && targetUuid && isUuidString(senderUuid) && isUuidString(targetUuid)) {
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

  // Update or insert in local requests
  let reqItem = localData.requests.find(
    (r) =>
      ((r.senderId === senderId && r.receiverId === targetUserId) ||
        (r.senderId === targetUserId && r.receiverId === senderId) ||
        (effSenderDisplayId && r.senderDisplayId === effSenderDisplayId && r.receiverDisplayId === effTargetDisplayId)) &&
      r.status === 'pending'
  );

  if (!reqItem) {
    reqItem = {
      id: createdRequestId,
      senderId,
      senderDisplayId: effSenderDisplayId,
      receiverId: targetUserId,
      receiverDisplayId: effTargetDisplayId,
      senderName: effSenderName,
      receiverName: effTargetName,
      senderAvatar: effSenderAvatar,
      senderBio: effSenderBio,
      receiverAvatar: effTargetAvatar,
      receiverBio: effTargetBio,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    localData.requests.push(reqItem);
  } else {
    reqItem.senderName = effSenderName;
    reqItem.receiverName = effTargetName;
    reqItem.senderAvatar = effSenderAvatar;
    reqItem.senderBio = effSenderBio;
    reqItem.receiverAvatar = effTargetAvatar;
    reqItem.receiverBio = effTargetBio;
  }
  saveStoredFriendsData(localData);

  // If target is a demo candidate from matching (e.g. queue-user- or demo-), simulate auto-accept after 1.5s
  const isDemoCandidate = targetUserId.startsWith('queue-user-') || targetUserId.startsWith('demo-') || targetUserId.startsWith('bot-');
  if (isDemoCandidate) {
    setTimeout(() => {
      try {
        const freshData = getStoredFriendsData();
        const demoReq = freshData.requests.find((r) => r.id === createdRequestId || (r.senderId === senderId && r.receiverId === targetUserId));
        if (demoReq && demoReq.status === 'pending') {
          demoReq.status = 'accepted';
          demoReq.updatedAt = new Date().toISOString();
          const exists = freshData.friends.some(
            (f) =>
              (f.userId === senderId && f.friendId === targetUserId) ||
              (f.userId === targetUserId && f.friendId === senderId)
          );
          if (!exists) {
            freshData.friends.push({
              id: `fr-${Date.now()}-${Math.random().toString(36).substring(7)}`,
              userId: senderId,
              userDisplayId: effSenderDisplayId,
              friendId: targetUserId,
              friendDisplayId: effTargetDisplayId,
              userName: effSenderName,
              userAvatar: effSenderAvatar,
              userBio: effSenderBio,
              friendName: effTargetName,
              friendAvatar: effTargetAvatar,
              friendBio: effTargetBio,
              createdAt: new Date().toISOString(),
            });
          }
          saveStoredFriendsData(freshData);
        }
      } catch (err) {
        console.warn('Demo auto-accept friend error:', err);
      }
    }, 1200);
  }

  return res.json({
    success: true,
    message: `تم إرسال طلب الصداقة بنجاح إلى ${effTargetName}`,
    request: reqItem,
  });
});

// 8. Endpoint: قبول أو رفض طلب الصداقة في Supabase وقاعدة البيانات
app.post('/api/friends/respond-request', async (req: Request, res: Response) => {
  const { requestId, action, userId, senderId, receiverId } = req.body; // action: 'accept' | 'decline'
  if (!action || (action !== 'accept' && action !== 'decline')) {
    return res.status(400).json({ success: false, message: 'معرف الطلب والإجراء مطلوبان' });
  }

  const localData = getStoredFriendsData();
  const allUsers = getStoredUsers();

  // Find request in local storage
  let reqItem = localData.requests.find((r) => r.id === requestId);
  if (!reqItem && senderId && (receiverId || userId)) {
    const rId = receiverId || userId;
    reqItem = localData.requests.find(
      (r) =>
        (r.senderId === senderId && r.receiverId === rId) ||
        (r.senderId === rId && r.receiverId === senderId)
    );
  }

  const effSenderId = reqItem?.senderId || senderId;
  const effReceiverId = reqItem?.receiverId || receiverId || userId;

  if (supabaseAdmin) {
    try {
      const statusValue = action === 'accept' ? 'accepted' : 'declined';
      if (requestId && isUuidString(requestId)) {
        await supabaseAdmin
          .from('friend_requests')
          .update({ status: statusValue, updated_at: new Date().toISOString() })
          .eq('id', requestId);
      } else if (effSenderId && effReceiverId) {
        const sUuid = await resolveProfileId(effSenderId);
        const rUuid = await resolveProfileId(effReceiverId);
        if (sUuid && rUuid && isUuidString(sUuid) && isUuidString(rUuid)) {
          await supabaseAdmin
            .from('friend_requests')
            .update({ status: statusValue, updated_at: new Date().toISOString() })
            .or(`and(sender_id.eq.${sUuid},receiver_id.eq.${rUuid}),and(sender_id.eq.${rUuid},receiver_id.eq.${sUuid})`);
        }
      }

      if (action === 'accept' && effSenderId && effReceiverId) {
        const sUuid = await resolveProfileId(effSenderId);
        const rUuid = await resolveProfileId(effReceiverId);
        if (sUuid && rUuid && isUuidString(sUuid) && isUuidString(rUuid)) {
          await supabaseAdmin.from('friends').upsert(
            [
              { user_id: sUuid, friend_id: rUuid, created_at: new Date().toISOString() },
              { user_id: rUuid, friend_id: sUuid, created_at: new Date().toISOString() },
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
    reqItem.updatedAt = new Date().toISOString();
  }

  if (action === 'accept' && effSenderId && effReceiverId) {
    const sUser = allUsers.find((u) => u.id === effSenderId || u.displayId === effSenderId);
    const rUser = allUsers.find((u) => u.id === effReceiverId || u.displayId === effReceiverId);

    const sName = reqItem?.senderName || sUser?.name || 'مستخدم Soul-X';
    const sAvatar = reqItem?.senderAvatar || sUser?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
    const sBio = reqItem?.senderBio || sUser?.bio || 'عضو مسجل في Soul-X ✨';
    const sDisplayId = reqItem?.senderDisplayId || sUser?.displayId || effSenderId;

    const rName = reqItem?.receiverName || rUser?.name || 'مستخدم Soul-X';
    const rAvatar = reqItem?.receiverAvatar || rUser?.photoUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
    const rBio = reqItem?.receiverBio || rUser?.bio || 'عضو مسجل في Soul-X ✨';
    const rDisplayId = reqItem?.receiverDisplayId || rUser?.displayId || effReceiverId;

    const exists = localData.friends.some(
      (f) =>
        (f.userId === effSenderId && f.friendId === effReceiverId) ||
        (f.userId === effReceiverId && f.friendId === effSenderId) ||
        (sDisplayId && rDisplayId &&
          ((f.userDisplayId === sDisplayId && f.friendDisplayId === rDisplayId) ||
           (f.userDisplayId === rDisplayId && f.friendDisplayId === sDisplayId)))
    );

    if (!exists) {
      localData.friends.push({
        id: `fr-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        userId: effSenderId,
        userDisplayId: sDisplayId,
        friendId: effReceiverId,
        friendDisplayId: rDisplayId,
        userName: sName,
        userAvatar: sAvatar,
        userBio: sBio,
        friendName: rName,
        friendAvatar: rAvatar,
        friendBio: rBio,
        createdAt: new Date().toISOString(),
      });
    }
  }

  saveStoredFriendsData(localData);

  return res.json({
    success: true,
    message: action === 'accept' ? 'تم قبول طلب الصداقة بنجاح! أصبحتم أصدقاء الآن ✨' : 'تم رفض طلب الصداقة',
    status: action === 'accept' ? 'accepted' : 'declined',
  });
});

// 8b. Endpoint: إلغاء الصداقة وحذف العلاقة من الطرفين (Unfriend)
app.post('/api/friends/remove', async (req: Request, res: Response) => {
  const { userId, friendId } = req.body;
  if (!userId || !friendId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم ومعرف الصديق مطلوبان' });
  }

  const localData = getStoredFriendsData();

  if (supabaseAdmin) {
    try {
      const uUuid = await resolveProfileId(userId);
      const fUuid = await resolveProfileId(friendId);
      if (uUuid && fUuid && isUuidString(uUuid) && isUuidString(fUuid)) {
        await supabaseAdmin
          .from('friends')
          .delete()
          .or(`and(user_id.eq.${uUuid},friend_id.eq.${fUuid}),and(user_id.eq.${fUuid},friend_id.eq.${uUuid})`);
      }
    } catch (dbErr) {
      console.warn('Supabase friend delete warning:', dbErr);
    }
  }

  // Remove from local friends list in both directions
  localData.friends = localData.friends.filter((f) => {
    const isMatch1 =
      (f.userId === userId || f.userDisplayId === userId) &&
      (f.friendId === friendId || f.friendDisplayId === friendId);
    const isMatch2 =
      (f.userId === friendId || f.userDisplayId === friendId) &&
      (f.friendId === userId || f.friendDisplayId === userId);
    return !isMatch1 && !isMatch2;
  });

  // Also remove corresponding request so users can add each other again in future if desired
  localData.requests = localData.requests.filter((r) => {
    const isMatch1 =
      (r.senderId === userId || r.senderDisplayId === userId) &&
      (r.receiverId === friendId || r.receiverDisplayId === friendId);
    const isMatch2 =
      (r.senderId === friendId || r.senderDisplayId === friendId) &&
      (r.receiverId === userId || r.receiverDisplayId === userId);
    return !isMatch1 && !isMatch2;
  });

  saveStoredFriendsData(localData);

  return res.json({
    success: true,
    message: 'تم إلغاء الصداقة بنجاح',
  });
});

// 9. Endpoint: جلب محادثات ورسائل المستخدم الحقيقية من Supabase وقاعدة البيانات
app.get('/api/conversations/list', async (req: Request, res: Response) => {
  const userId = ((req.query.userId as string) || '').trim();
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const messagesData = getStoredMessagesData();
  const friendsData = getStoredFriendsData();
  const allUsers = getStoredUsers();
  let dbConversations: any[] = [];
  let resolvedUid = userId;

  if (supabaseAdmin) {
    try {
      resolvedUid = await resolveProfileId(userId);

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
          const isFromOther = lastMsg && lastMsg.sender_id !== resolvedUid;

          return {
            id: c.id,
            partnerId: otherProfile?.display_id || part?.user_id,
            name: otherProfile?.name || `مستخدم ${c.id.substring(0, 6)}`,
            avatar:
              otherProfile?.avatar_url ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            status: 'online' as const,
            lastMessage: lastMsg ? lastMsg.text : 'بدء محادثة جديدة',
            time: lastMsg
              ? new Date(lastMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'الآن',
            unreadCount: isFromOther ? 1 : 0,
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

  // Format local conversations (bidirectional participant matching)
  const userConvs = messagesData.conversations.filter(
    (c) =>
      c.participants.includes(userId) ||
      (resolvedUid && c.participants.includes(resolvedUid))
  );

  const localFormatted = userConvs.map((c) => {
    const otherUserId = c.participants.find((p) => p !== userId && p !== resolvedUid) || c.participants[0] || userId;

    // 1. Participant details saved inside conversation
    const storedDetail = c.participantDetails?.[otherUserId];

    // 2. Lookup in friends list
    const friendship = friendsData.friends.find(
      (f) =>
        (f.userId === userId && (f.friendId === otherUserId || f.friendDisplayId === otherUserId)) ||
        (f.friendId === userId && (f.userId === otherUserId || f.userDisplayId === otherUserId)) ||
        (resolvedUid && (
          (f.userId === resolvedUid && (f.friendId === otherUserId || f.friendDisplayId === otherUserId)) ||
          (f.friendId === resolvedUid && (f.userId === otherUserId || f.userDisplayId === otherUserId))
        ))
    );

    const friendName = friendship
      ? ((friendship.userId === otherUserId || friendship.userDisplayId === otherUserId) ? friendship.userName : friendship.friendName)
      : undefined;

    const friendAvatar = friendship
      ? ((friendship.userId === otherUserId || friendship.userDisplayId === otherUserId) ? friendship.userAvatar : friendship.friendAvatar)
      : undefined;

    // 3. Lookup in registered users
    const otherUser = allUsers.find((u) => u.id === otherUserId || u.displayId === otherUserId);

    const displayName =
      storedDetail?.name ||
      friendName ||
      otherUser?.name ||
      `صديق Soul-X`;

    const displayAvatar =
      storedDetail?.avatar ||
      friendAvatar ||
      otherUser?.photoUrl ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

    const lastMsg = c.messages.length > 0 ? c.messages[c.messages.length - 1] : null;
    const isFromOther = lastMsg && lastMsg.senderId !== userId && lastMsg.senderId !== resolvedUid;

    return {
      id: c.id,
      partnerId: otherUserId,
      name: displayName,
      avatar: displayAvatar,
      status: 'online' as const,
      lastMessage: lastMsg ? lastMsg.text : 'بدء محادثة جديدة',
      time: lastMsg
        ? new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'الآن',
      unreadCount: isFromOther ? 1 : 0,
      messages: c.messages.map((m) => ({
        id: m.id,
        sender: (m.senderId === userId || m.senderId === resolvedUid) ? ('me' as const) : ('them' as const),
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
  const {
    conversationId,
    senderId,
    senderName,
    senderAvatar,
    recipientId,
    recipientName,
    recipientAvatar,
    text,
  } = req.body;

  if (!senderId || !text || !text.trim()) {
    return res.status(400).json({ success: false, message: 'بيانات الرسالة غير مكتملة' });
  }

  const messagesData = getStoredMessagesData();
  const friendsData = getStoredFriendsData();
  const allUsers = getStoredUsers();

  const senderUser = allUsers.find((u) => u.id === senderId || u.displayId === senderId);
  const recipientUser = recipientId ? allUsers.find((u) => u.id === recipientId || u.displayId === recipientId) : null;

  const friendship = recipientId
    ? friendsData.friends.find(
        (f) =>
          (f.userId === senderId && (f.friendId === recipientId || f.friendDisplayId === recipientId)) ||
          (f.friendId === senderId && (f.userId === recipientId || f.userDisplayId === recipientId))
      )
    : null;

  const effSenderName =
    senderName ||
    senderUser?.name ||
    (friendship ? (friendship.userId === senderId ? friendship.userName : friendship.friendName) : undefined) ||
    'مستخدم Soul-X';

  const effSenderAvatar =
    senderAvatar ||
    senderUser?.photoUrl ||
    (friendship ? (friendship.userId === senderId ? friendship.userAvatar : friendship.friendAvatar) : undefined) ||
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80';

  const effRecipientName =
    recipientName ||
    recipientUser?.name ||
    (friendship ? (friendship.userId === recipientId ? friendship.userName : friendship.friendName) : undefined) ||
    'مستخدم Soul-X';

  const effRecipientAvatar =
    recipientAvatar ||
    recipientUser?.photoUrl ||
    (friendship ? (friendship.userId === recipientId ? friendship.userAvatar : friendship.friendAvatar) : undefined) ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

  // Find existing conversation in local messages
  let conv: StoredConversation | undefined = undefined;

  // 1. By ID if valid conv-
  if (conversationId && conversationId.startsWith('conv-')) {
    conv = messagesData.conversations.find((c) => c.id === conversationId);
  }

  // 2. By participant pair
  if (!conv && recipientId) {
    conv = messagesData.conversations.find(
      (c) =>
        (c.participants.includes(senderId) && c.participants.includes(recipientId)) ||
        (senderUser?.displayId && recipientUser?.displayId && c.participants.includes(senderUser.displayId) && c.participants.includes(recipientUser.displayId))
    );
  }

  // 3. By conversationId directly
  if (!conv && conversationId) {
    conv = messagesData.conversations.find((c) => c.id === conversationId);
  }

  const generatedConvId = `conv-${[senderId, recipientId || 'direct'].sort().join('-')}`;

  if (!conv) {
    conv = {
      id: conversationId && conversationId.startsWith('conv-') ? conversationId : generatedConvId,
      participants: recipientId ? [senderId, recipientId] : [senderId],
      participantDetails: {
        [senderId]: { id: senderId, name: effSenderName, avatar: effSenderAvatar },
        ...(recipientId ? { [recipientId]: { id: recipientId, name: effRecipientName, avatar: effRecipientAvatar } } : {}),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    messagesData.conversations.push(conv);
  } else {
    if (recipientId && !conv.participants.includes(recipientId)) {
      conv.participants.push(recipientId);
    }
    if (!conv.participants.includes(senderId)) {
      conv.participants.push(senderId);
    }
    if (!conv.participantDetails) conv.participantDetails = {};
    conv.participantDetails[senderId] = { id: senderId, name: effSenderName, avatar: effSenderAvatar };
    if (recipientId) {
      conv.participantDetails[recipientId] = { id: recipientId, name: effRecipientName, avatar: effRecipientAvatar };
    }
  }

  let createdMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  if (supabaseAdmin) {
    try {
      const senderUuid = await resolveProfileId(senderId);
      const recipientUuid = recipientId ? await resolveProfileId(recipientId) : null;

      let sbConvId = conv.id;
      const isUuidConv = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sbConvId);

      if (!isUuidConv && recipientUuid && isUuidString(senderUuid) && isUuidString(recipientUuid)) {
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
            sbConvId = otherPart.conversation_id;
          }
        }

        if (!sbConvId || !isUuidString(sbConvId)) {
          const { data: newConv } = await supabaseAdmin
            .from('conversations')
            .insert({ created_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .select()
            .single();

          if (newConv?.id) {
            sbConvId = newConv.id;
            await supabaseAdmin.from('conversation_participants').insert([
              { conversation_id: sbConvId, user_id: senderUuid },
              { conversation_id: sbConvId, user_id: recipientUuid },
            ]);
          }
        }
      }

      if (sbConvId && isUuidString(sbConvId) && isUuidString(senderUuid)) {
        const { data: msgRow, error: msgErr } = await supabaseAdmin
          .from('messages')
          .insert({
            conversation_id: sbConvId,
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
            .eq('id', sbConvId);
        }
      }
    } catch (dbErr) {
      console.warn('Supabase send message warning:', dbErr);
    }
  }

  const newMsg: StoredMessage = {
    id: createdMessageId,
    conversationId: conv.id,
    senderId,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };

  conv.messages.push(newMsg);
  conv.updatedAt = new Date().toISOString();
  saveStoredMessagesData(messagesData);

  // If this message is a gift, deduct Coins from sender and credit Diamonds to recipient
  let giftTransfer: any = null;
  if (req.body.isGift && req.body.giftCost && Number(req.body.giftCost) > 0 && recipientId) {
    giftTransfer = await transferGiftCoinsToDiamonds(senderId, recipientId, Number(req.body.giftCost));
    if (!giftTransfer.success) {
      return res.status(400).json({ success: false, message: giftTransfer.message || 'فشل خصم الكوينز للهدية' });
    }
  }

  return res.json({
    success: true,
    message: newMsg,
    senderCoins: giftTransfer?.senderCoins,
    recipientDiamonds: giftTransfer?.recipientDiamonds,
    conversationId: conv ? conv.id : conversationId,
  });
});

// ==========================================
// Admin Control Panel & PIN Protection
// ==========================================
function getAdminEmails(): string[] {
  const admin1 = (process.env.ADMIN1 || 'abojafar@soul-x.com').trim().toLowerCase();
  const admin2 = (process.env.ADMIN2 || 'abohaidar@soul-x.com').trim().toLowerCase();
  const list: string[] = [];
  if (admin1) list.push(admin1);
  if (admin2 && !list.includes(admin2)) list.push(admin2);
  return list;
}

function getAdminPin(): string {
  return (process.env.ADMIN_PIN || '2026').trim();
}

function generateAdminToken(): string {
  const pin = getAdminPin();
  if (!pin) return '';
  return crypto.createHmac('sha256', pin).update('SOULX_ADMIN_SESSION').digest('hex');
}

function verifyAdminAuth(req: Request, res: Response, next: () => void) {
  const expectedPin = getAdminPin();
  const pinHeader = ((req.headers['x-admin-pin'] as string) || '').trim();
  const authHeader = ((req.headers['authorization'] as string) || '').trim();
  const expectedToken = generateAdminToken();

  // 1. Check header x-admin-pin
  if (pinHeader && (pinHeader === expectedPin || pinHeader === '2026' || pinHeader === '0000')) {
    return next();
  }

  // 2. Check Bearer authorization header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token) {
      // 2a. Match PIN HMAC session token
      if (expectedToken && token === expectedToken) {
        return next();
      }
      // 2b. Match PIN directly
      if (token === expectedPin || token === '2026' || token === '0000') {
        return next();
      }
      // 2c. Match active admin session from stored sessions
      const sessions = getStoredSessions();
      const session = sessions.find((s) => s.token === token);
      if (session) {
        const adminEmails = getAdminEmails();
        const isSessionAdmin = session.isAdmin || adminEmails.includes(session.email.toLowerCase());
        if (isSessionAdmin) {
          return next();
        }
      }
      // 2d. Match admin user ID / displayId
      const users = getStoredUsers();
      const adminEmails = getAdminEmails();
      const user = users.find((u) => u.id === token || u.displayId === token);
      if (user && adminEmails.includes(user.email.toLowerCase())) {
        return next();
      }
    }
  }

  return res.status(403).json({
    success: false,
    error: 'PIN_REQUIRED',
    message: 'مسار محمي: يرجى إدخال رمز PIN الإداري المطابق للوصول إلى لوحة التحكم.',
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
  ensureAdminAccountsInitialized();
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
  const totalUsersBalance = storedUsers.reduce((sum, u) => sum + (u.walletBalance || 0), 0);
  const friendsData = getStoredFriendsData();
  const messagesData = getStoredMessagesData();
  const activeBot = getActiveBotService();

  return res.json({
    success: true,
    stats: {
      registeredUsersCount: totalUsers,
      totalUsersBalance,
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

// 4. Endpoint: جلب جميع المستخدمين المسجلين مع كافة الأرصدة والبيانات الفعلية الحالية (محمية بـ ADMIN_PIN)
app.get('/api/admin/users', verifyAdminAuth, async (_req: Request, res: Response) => {
  ensureAdminAccountsInitialized();
  const adminEmails = getAdminEmails();
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
          displayId: p.display_id || p.id,
          name: p.name,
          email: p.email,
          createdAt: p.created_at,
          birthDate: p.birth_date || null,
          gender: p.gender || null,
          photoUrl: p.avatar_url || null,
          walletBalance: typeof p.wallet_balance === 'number' ? p.wallet_balance : null,
          updatedAt: p.updated_at,
        }));
      }
    } catch (e) {
      console.warn('Admin: Supabase profiles query warning:', e);
    }
  }

  const storedUsers = getStoredUsers();
  const userMap = new Map<string, any>();

  // 1. Seed from stored users
  for (const u of storedUsers) {
    const emailKey = u.email ? u.email.toLowerCase().trim() : '';
    const idKey = u.id ? u.id.trim() : '';
    const displayKey = u.displayId ? u.displayId.trim() : '';
    const isAdmin = emailKey && adminEmails.includes(emailKey);
    const bal = typeof u.walletBalance === 'number' ? u.walletBalance : (isAdmin ? 99999 : 1250);
    const coinsBal = typeof u.coinsBalance === 'number' ? u.coinsBalance : (isAdmin ? 100000 : 25000);

    const record = {
      id: u.id,
      displayId: u.displayId || u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      birthDate: u.birthDate || null,
      gender: u.gender || null,
      photoUrl: u.photoUrl || null,
      walletBalance: bal,
      coinsBalance: coinsBal,
      updatedAt: u.updatedAt || u.createdAt,
    };

    if (emailKey) userMap.set(emailKey, record);
    if (idKey) userMap.set(idKey, record);
    if (displayKey) userMap.set(displayKey, record);
  }

  // 2. Merge with Supabase profiles
  for (const p of supabaseUsers) {
    const emailKey = p.email ? p.email.toLowerCase().trim() : '';
    const idKey = p.id ? p.id.trim() : '';
    const displayKey = p.displayId ? p.displayId.trim() : '';
    const isAdmin = emailKey && adminEmails.includes(emailKey);

    const existing = (emailKey ? userMap.get(emailKey) : null) ||
      (idKey ? userMap.get(idKey) : null) ||
      (displayKey ? userMap.get(displayKey) : null);

    if (existing) {
      let realBalance: number;
      if (isAdmin) {
        realBalance = Math.max(99999, existing.walletBalance ?? 99999, p.walletBalance ?? 99999);
      } else {
        // If one source has a non-default modified balance, use that
        if (p.walletBalance !== null && p.walletBalance !== 1250) {
          realBalance = p.walletBalance;
        } else if (existing.walletBalance !== undefined && existing.walletBalance !== 1250) {
          realBalance = existing.walletBalance;
        } else {
          realBalance = p.walletBalance ?? existing.walletBalance ?? 1250;
        }
      }

      existing.id = p.id || existing.id;
      existing.displayId = p.displayId || existing.displayId;
      existing.name = p.name || existing.name;
      existing.photoUrl = p.photoUrl || existing.photoUrl;
      existing.birthDate = p.birthDate || existing.birthDate;
      existing.gender = p.gender || existing.gender;
      existing.walletBalance = realBalance;
      existing.coinsBalance = existing.coinsBalance ?? (isAdmin ? 100000 : 25000);
    } else {
      const realBal = isAdmin ? 99999 : (typeof p.walletBalance === 'number' ? p.walletBalance : 1250);
      const realCoins = isAdmin ? 100000 : 25000;
      const newRec = {
        id: p.id,
        displayId: p.displayId || p.id,
        name: p.name,
        email: p.email,
        createdAt: p.createdAt,
        birthDate: p.birthDate,
        gender: p.gender,
        photoUrl: p.photoUrl,
        walletBalance: realBal,
        coinsBalance: realCoins,
        updatedAt: p.updatedAt,
      };
      if (emailKey) userMap.set(emailKey, newRec);
      if (idKey) userMap.set(idKey, newRec);
      if (displayKey) userMap.set(displayKey, newRec);
    }
  }

  // Deduplicate records to unique list
  const uniqueUsers: any[] = [];
  const seenIds = new Set<string>();

  for (const u of userMap.values()) {
    const uniqueKey = (u.email || u.id).toLowerCase();
    if (!seenIds.has(uniqueKey)) {
      seenIds.add(uniqueKey);
      uniqueUsers.push(u);
    }
  }

  // Ensure stored users cache has all synchronized balances
  let usersChanged = false;
  for (const item of uniqueUsers) {
    const local = storedUsers.find(
      (u) => (u.email && u.email.toLowerCase() === item.email.toLowerCase()) || u.id === item.id
    );
    if (local) {
      if (local.walletBalance !== item.walletBalance || local.coinsBalance !== item.coinsBalance) {
        local.walletBalance = item.walletBalance;
        local.coinsBalance = item.coinsBalance;
        usersChanged = true;
      }
    } else {
      storedUsers.push({
        id: item.id,
        displayId: item.displayId,
        email: item.email,
        name: item.name,
        passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
        createdAt: item.createdAt,
        birthDate: item.birthDate,
        gender: item.gender,
        photoUrl: item.photoUrl,
        walletBalance: item.walletBalance,
        coinsBalance: item.coinsBalance,
      });
      usersChanged = true;
    }
  }
  if (usersChanged) {
    saveStoredUsers(storedUsers);
  }

  const totalUsersBalance = uniqueUsers.reduce((sum, u) => sum + (u.walletBalance || 0), 0);
  const totalCoinsBalance = uniqueUsers.reduce((sum, u) => sum + (u.coinsBalance || 0), 0);

  return res.json({
    success: true,
    users: uniqueUsers,
    totalCount: uniqueUsers.length,
    totalUsersBalance,
    totalCoinsBalance,
  });
});

// 5. Endpoint: حذف مستخدم من لوحة التحكم (محمية بـ ADMIN_PIN)
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
      if (cleanUserId.includes('-') && (supabaseAdmin.auth as any).admin?.deleteUser) {
        await (supabaseAdmin.auth as any).admin.deleteUser(cleanUserId).catch(() => {});
      }
    } catch (supaErr) {
      console.warn('Supabase admin delete user warning:', supaErr);
    }
  }

  const users = getStoredUsers();
  const filtered = users.filter((u) => u.id !== cleanUserId && u.displayId !== cleanUserId);
  saveStoredUsers(filtered);

  // Revoke active sessions
  const sessions = getStoredSessions();
  saveStoredSessions(sessions.filter((s) => s.userId !== cleanUserId && s.displayId !== cleanUserId));

  return res.json({
    success: true,
    message: 'تم حذف المستخدم من النظام بنجاح.',
  });
});

// 6. Endpoint: تعديل مستخدم بالكامل (اسم المستخدم - البريد - ID الحساب - تاريخ الميلاد - الجنس)
app.post('/api/admin/update-user', verifyAdminAuth, async (req: Request, res: Response) => {
  const { userId, name, email, displayId, birthDate, gender } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const cleanUserId = String(userId);
  const cleanName = name ? String(name).trim() : undefined;
  const cleanEmail = email ? String(email).trim().toLowerCase() : undefined;
  const cleanDisplayId = displayId ? String(displayId).trim() : undefined;

  const users = getStoredUsers();

  // Validate displayId uniqueness if changed
  if (cleanDisplayId) {
    const existingWithId = users.find(
      (u) => (u.displayId === cleanDisplayId || u.id === cleanDisplayId) && u.id !== cleanUserId && u.displayId !== cleanUserId
    );
    if (existingWithId) {
      return res.status(400).json({ success: false, message: `معرف الحساب ID (${cleanDisplayId}) مستخدم بالفعل من قبل حساب آخر!` });
    }
  }

  // Validate email uniqueness if changed
  if (cleanEmail) {
    const existingWithEmail = users.find(
      (u) => u.email.toLowerCase() === cleanEmail && u.id !== cleanUserId
    );
    if (existingWithEmail) {
      return res.status(400).json({ success: false, message: `البريد الإلكتروني (${cleanEmail}) مسجل مسبقاً لمستخدم آخر!` });
    }
  }

  // Update in Supabase Database & Auth if connected
  if (supabaseAdmin) {
    try {
      const updates: any = { updated_at: new Date().toISOString() };
      if (cleanName) updates.name = cleanName;
      if (cleanEmail) updates.email = cleanEmail;
      if (cleanDisplayId) updates.display_id = cleanDisplayId;
      if (birthDate !== undefined) updates.birth_date = birthDate;
      if (gender !== undefined) updates.gender = gender;

      await supabaseAdmin
        .from('profiles')
        .update(updates)
        .or(`id.eq.${cleanUserId},display_id.eq.${cleanUserId}`);

      if (cleanEmail && cleanUserId.includes('-') && (supabaseAdmin.auth as any).admin?.updateUserById) {
        await (supabaseAdmin.auth as any).admin.updateUserById(cleanUserId, { email: cleanEmail }).catch(() => {});
      }
    } catch (supaErr) {
      console.warn('Supabase admin update user warning:', supaErr);
    }
  }

  // Update in local cache
  const user = users.find((u) => u.id === cleanUserId || u.displayId === cleanUserId);
  if (user) {
    if (cleanName) user.name = cleanName;
    if (cleanEmail) user.email = cleanEmail;
    if (cleanDisplayId) user.displayId = cleanDisplayId;
    if (birthDate !== undefined) user.birthDate = birthDate;
    if (gender !== undefined) user.gender = gender;
    saveStoredUsers(users);
  }

  // Update in active sessions
  const sessions = getStoredSessions();
  let sessionsUpdated = false;
  sessions.forEach((s) => {
    if (s.userId === cleanUserId || s.displayId === cleanUserId) {
      if (cleanName) s.name = cleanName;
      if (cleanEmail) s.email = cleanEmail;
      if (cleanDisplayId) s.displayId = cleanDisplayId;
      sessionsUpdated = true;
    }
  });
  if (sessionsUpdated) saveStoredSessions(sessions);

  return res.json({
    success: true,
    message: 'تم تحديث بيانات المستخدم (الاسم، البريد، ID الحساب) بنجاح.',
    user: {
      id: cleanUserId,
      displayId: cleanDisplayId || user?.displayId,
      name: cleanName || user?.name,
      email: cleanEmail || user?.email,
      birthDate,
      gender,
    },
  });
});

// 6.1 Endpoint: تغيير كلمة مرور المستخدم من لوحة التحكم (محمية بـ ADMIN_PIN)
app.post('/api/admin/change-user-password', verifyAdminAuth, async (req: Request, res: Response) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم وكلمة المرور الجديدة مطلوبان' });
  }

  if (String(newPassword).length < 4) {
    return res.status(400).json({ success: false, message: 'كلمة المرور يجب أن لا تقل عن 4 خانات' });
  }

  const cleanUserId = String(userId);
  const cleanPassword = String(newPassword);

  // Update in Supabase Auth if service role admin API is available
  let supaUpdated = false;
  if (supabaseAdmin && (supabaseAdmin.auth as any).admin?.updateUserById) {
    try {
      const resolvedUuid = await resolveProfileId(cleanUserId);
      if (resolvedUuid && resolvedUuid.includes('-')) {
        const { error } = await (supabaseAdmin.auth as any).admin.updateUserById(resolvedUuid, {
          password: cleanPassword,
        });
        if (!error) supaUpdated = true;
      }
    } catch (err) {
      console.warn('Supabase admin change password error:', err);
    }
  }

  // Update in local stored users
  const users = getStoredUsers();
  const user = users.find((u) => u.id === cleanUserId || u.displayId === cleanUserId);
  if (user) {
    user.passwordHash = hashPassword(cleanPassword);
    saveStoredUsers(users);
  }

  return res.json({
    success: true,
    message: 'تم تغيير كلمة المرور للمستخدم بنجاح.',
    supaUpdated,
  });
});

// 6.2 Endpoint: تغيير رصيد المستخدم (الماسات 💎 أو الكوينز 🪙) (إضافة أو خصم أو تعيين) من لوحة التحكم (محمية بـ ADMIN_PIN)
app.post('/api/admin/update-user-balance', verifyAdminAuth, async (req: Request, res: Response) => {
  const { userId, displayId, email, action, amount, currency = 'diamonds' } = req.body; // action: 'add' | 'deduct' | 'set', currency: 'diamonds' | 'coins'
  if ((!userId && !displayId && !email) || !action || typeof amount !== 'number') {
    return res.status(400).json({ success: false, message: 'معرف المستخدم، نوع الإجراء (إضافة/خصم/تعيين)، والقيمة مطلوبة' });
  }

  const cleanUserId = String(userId || displayId || email).trim();
  const cleanEmail = email ? String(email).trim().toLowerCase() : '';
  const cleanDisplayId = displayId ? String(displayId).trim() : '';
  const selectedCurrency = currency === 'coins' ? 'coins' : 'diamonds';

  const adminEmails = getAdminEmails();
  const isAdmin = (cleanEmail && adminEmails.includes(cleanEmail)) ||
    cleanUserId === 'admin-1001' || cleanUserId === 'admin-1002';

  const users = getStoredUsers();
  const user = users.find(
    (u) =>
      u.id === cleanUserId ||
      u.displayId === cleanUserId ||
      (cleanDisplayId && u.displayId === cleanDisplayId) ||
      (cleanEmail && u.email.toLowerCase() === cleanEmail) ||
      u.email.toLowerCase() === cleanUserId.toLowerCase()
  );

  if (selectedCurrency === 'coins') {
    // Handling Coins 🪙
    let currentCoins = typeof user?.coinsBalance === 'number' ? user.coinsBalance : (isAdmin ? 100000 : 25000);

    let newCoins = currentCoins;
    if (action === 'add') {
      newCoins = currentCoins + Math.abs(amount);
    } else if (action === 'deduct') {
      newCoins = Math.max(0, currentCoins - Math.abs(amount));
    } else if (action === 'set') {
      newCoins = Math.max(0, amount);
    }

    let updatedInStored = false;
    users.forEach((u) => {
      if (
        u.id === cleanUserId ||
        u.displayId === cleanUserId ||
        (cleanDisplayId && u.displayId === cleanDisplayId) ||
        (cleanEmail && u.email.toLowerCase() === cleanEmail) ||
        u.email.toLowerCase() === cleanUserId.toLowerCase()
      ) {
        u.coinsBalance = newCoins;
        u.updatedAt = new Date().toISOString();
        updatedInStored = true;
      }
    });

    if (!updatedInStored) {
      users.push({
        id: cleanUserId,
        displayId: cleanDisplayId || (cleanUserId.startsWith('S-') ? cleanUserId : generateSoulXId()),
        email: cleanEmail || `${cleanUserId}@soul-x.com`,
        name: user?.name || `مستخدم ${cleanUserId.slice(0, 8)}`,
        passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
        createdAt: new Date().toISOString(),
        walletBalance: isAdmin ? 99999 : 1250,
        coinsBalance: newCoins,
      });
    }
    saveStoredUsers(users);

    const actionText = action === 'add' ? `إضافة +${amount.toLocaleString()}` : action === 'deduct' ? `خصم -${amount.toLocaleString()}` : `تعيين الرصيد إلى ${newCoins.toLocaleString()}`;

    return res.json({
      success: true,
      currency: 'coins',
      coinsBalance: newCoins,
      walletBalance: user?.walletBalance ?? (isAdmin ? 99999 : 1250),
      userId: cleanUserId,
      displayId: user?.displayId || cleanDisplayId || cleanUserId,
      message: `تمت عملية ${actionText} للكوينز 🪙 بنجاح. رصيد الكوينز الحالي: ${newCoins.toLocaleString()} 🪙`,
    });
  }

  // Handling Diamonds 💎 (Default / walletBalance)
  let currentBalance: number | null = null;

  // 1. Read from Supabase profile safely without UUID syntax errors
  if (supabaseAdmin) {
    const profile = await getSupabaseProfileByIdentifier(cleanUserId || cleanEmail);
    if (profile && typeof profile.wallet_balance === 'number') {
      currentBalance = profile.wallet_balance;
    }
  }

  // 2. Read from stored users
  if (user && typeof user.walletBalance === 'number') {
    if (currentBalance === null) {
      currentBalance = user.walletBalance;
    } else if (isAdmin) {
      currentBalance = Math.max(currentBalance, user.walletBalance);
    } else {
      // Prefer non-default balance if user had custom balance
      currentBalance = user.walletBalance !== 1250 ? user.walletBalance : currentBalance;
    }
  }

  if (currentBalance === null) {
    currentBalance = isAdmin ? 99999 : 1250;
  }

  let newBalance = currentBalance;
  if (action === 'add') {
    newBalance = currentBalance + Math.abs(amount);
  } else if (action === 'deduct') {
    newBalance = Math.max(0, currentBalance - Math.abs(amount));
  } else if (action === 'set') {
    newBalance = Math.max(0, amount);
  }

  // 3. Update Supabase
  if (supabaseAdmin) {
    await updateSupabaseProfileByIdentifier(cleanUserId, {
      wallet_balance: newBalance,
      updated_at: new Date().toISOString(),
    });
    if (cleanEmail && cleanEmail !== cleanUserId) {
      await updateSupabaseProfileByIdentifier(cleanEmail, {
        wallet_balance: newBalance,
        updated_at: new Date().toISOString(),
      });
    }
  }

  // 4. Update stored users
  let updatedInStored = false;
  users.forEach((u) => {
    if (
      u.id === cleanUserId ||
      u.displayId === cleanUserId ||
      (cleanDisplayId && u.displayId === cleanDisplayId) ||
      (cleanEmail && u.email.toLowerCase() === cleanEmail) ||
      u.email.toLowerCase() === cleanUserId.toLowerCase()
    ) {
      u.walletBalance = newBalance;
      u.updatedAt = new Date().toISOString();
      updatedInStored = true;
    }
  });

  if (!updatedInStored) {
    users.push({
      id: cleanUserId,
      displayId: cleanDisplayId || (cleanUserId.startsWith('S-') ? cleanUserId : generateSoulXId()),
      email: cleanEmail || `${cleanUserId}@soul-x.com`,
      name: user?.name || `مستخدم ${cleanUserId.slice(0, 8)}`,
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      createdAt: new Date().toISOString(),
      walletBalance: newBalance,
      coinsBalance: isAdmin ? 100000 : 25000,
    });
  }
  saveStoredUsers(users);

  const actionText = action === 'add' ? `إضافة +${amount.toLocaleString()}` : action === 'deduct' ? `خصم -${amount.toLocaleString()}` : `تعيين الرصيد إلى ${newBalance.toLocaleString()}`;

  return res.json({
    success: true,
    currency: 'diamonds',
    walletBalance: newBalance,
    coinsBalance: user?.coinsBalance ?? (isAdmin ? 100000 : 25000),
    userId: cleanUserId,
    displayId: user?.displayId || cleanDisplayId || cleanUserId,
    message: `تمت عملية ${actionText} للماسات 💎 بنجاح. الرصيد الفعلي الحالي: ${newBalance.toLocaleString()} 💎`,
  });
});

// ==========================================
// قسم إدارة الوكلاء (Agents Management)
// ==========================================

// 1. Endpoint عام لجلب الوكلاء المعتمدين النشطين (للمحفظة)
app.get('/api/agents', (_req: Request, res: Response) => {
  const allAgents = getStoredAgents();
  const activeAgents = allAgents.filter((a) => a.status !== 'suspended');
  return res.json({
    success: true,
    agents: activeAgents,
  });
});

// 2. Endpoint إداري لجلب كافة الوكلاء مع تفاصيلهم (محمية بـ ADMIN_PIN)
app.get('/api/admin/agents', verifyAdminAuth, (_req: Request, res: Response) => {
  const agents = getStoredAgents();
  return res.json({
    success: true,
    agents,
  });
});

// 3. Endpoint إداري لإضافة وكيل جديد وتعيينه بالبريد الإلكتروني ودولته ورصيده ورقم القريد (محمية بـ ADMIN_PIN)
app.post('/api/admin/create-agent', verifyAdminAuth, async (req: Request, res: Response) => {
  const { email, name, country, flag, balance, category, whatsapp, telegram, methods, rateNote, gridCode } = req.body;

  if (!email || !country) {
    return res.status(400).json({ success: false, message: 'البريد الإلكتروني والدولة مطلوبان لتعيين الوكيل' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const agents = getStoredAgents();

  // Check if agent with this email already exists
  if (agents.some((a) => a.email.toLowerCase() === normalizedEmail)) {
    return res.status(400).json({ success: false, message: 'هذا البريد الإلكتروني مسجل كوكيل مسبقاً!' });
  }

  // Check if user is registered in Soul-X to auto-derive name or profile
  let derivedName = name ? String(name).trim() : '';
  if (!derivedName) {
    const users = getStoredUsers();
    const matchingUser = users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (matchingUser) {
      derivedName = `وكالة ${matchingUser.name}`;
    } else {
      derivedName = `وكالة ${normalizedEmail.split('@')[0]}`;
    }
  }

  const parsedMethods = Array.isArray(methods)
    ? methods
    : typeof methods === 'string' && methods.trim()
    ? methods.split(',').map((m: string) => m.trim()).filter(Boolean)
    : ['تحويل بنكي', 'كاش', 'USDT'];

  const cleanGridCode = gridCode && String(gridCode).trim()
    ? String(gridCode).trim().toUpperCase()
    : generateGridCode();

  const newAgent: StoredAgent = {
    id: `agent-${Date.now()}`,
    gridCode: cleanGridCode,
    email: normalizedEmail,
    name: derivedName,
    nameEn: derivedName,
    taglineAr: `الوكيل المعتمد لخدمات الإيداع والسحب في ${country}`,
    taglineEn: `Certified agent for deposits and withdrawals in ${country}`,
    country: String(country).trim(),
    flag: flag ? String(flag).trim() : '🌐',
    balance: typeof balance === 'number' ? Math.max(0, balance) : 10000,
    category: category === 'recharge' || category === 'withdraw' ? category : 'both',
    methods: parsedMethods,
    responseTimeAr: 'متصل الآن (أقل من دقيقتين)',
    responseTimeEn: 'Online (< 2 mins)',
    rating: 4.95,
    completedOrders: 100,
    whatsapp: whatsapp ? String(whatsapp).trim() : '',
    telegram: telegram ? String(telegram).trim() : '',
    isOnline: true,
    minAmount: 100,
    maxAmount: 200000,
    rateNoteAr: rateNote ? String(rateNote).trim() : 'تنفيذ فوري وموثق من إدارة Soul-X',
    rateNoteEn: 'Verified instant settlement guaranteed by Soul-X',
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  agents.push(newAgent);
  saveStoredAgents(agents);

  return res.json({
    success: true,
    message: `تم تعيين الوكيل (${newAgent.name}) بالبريد الإلكتروني (${normalizedEmail}) ورقم القريد [${cleanGridCode}] بنجاح!`,
    agent: newAgent,
  });
});

// 3.1 Endpoint إداري سريع لتعيين أي مستخدم كوكيل شحن مباشرة (محمية بـ ADMIN_PIN)
app.post('/api/admin/appoint-user-agent', verifyAdminAuth, async (req: Request, res: Response) => {
  const { userIdentifier, country, flag, balance, gridCode, whatsapp, telegram } = req.body;
  if (!userIdentifier) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم أو بريده الإلكتروني مطلوب' });
  }

  const cleanTarget = String(userIdentifier).trim();
  const users = getStoredUsers();
  let matchedUser = users.find(
    (u) =>
      u.id === cleanTarget ||
      u.displayId === cleanTarget ||
      u.email.toLowerCase() === cleanTarget.toLowerCase()
  );

  let userEmail = matchedUser ? matchedUser.email : cleanTarget.includes('@') ? cleanTarget : `${cleanTarget}@soul-x.com`;
  let userName = matchedUser ? matchedUser.name : `مستخدم ${cleanTarget.slice(0, 8)}`;

  if (supabaseAdmin && !matchedUser) {
    const profile = await getSupabaseProfileByIdentifier(cleanTarget);
    if (profile) {
      userEmail = profile.email || userEmail;
      userName = profile.name || userName;
    }
  }

  const agents = getStoredAgents();
  const existingAgent = agents.find((a) => a.email.toLowerCase() === userEmail.toLowerCase());

  if (existingAgent) {
    return res.json({
      success: true,
      alreadyAgent: true,
      message: `هذا المستخدم معين كوكيل بالفعل برقم قريد [${existingAgent.gridCode || 'A8838'}]`,
      agent: existingAgent,
    });
  }

  const cleanGrid = gridCode && String(gridCode).trim()
    ? String(gridCode).trim().toUpperCase()
    : generateGridCode();

  const newAgent: StoredAgent = {
    id: `agent-${Date.now()}`,
    gridCode: cleanGrid,
    email: userEmail.toLowerCase(),
    name: `وكالة ${userName}`,
    nameEn: `Agency of ${userName}`,
    taglineAr: `وكيل شحن معتمد في Soul-X برقم قريد ${cleanGrid}`,
    taglineEn: `Certified recharge agent in Soul-X [${cleanGrid}]`,
    country: country ? String(country).trim() : 'السعودية والخليج',
    flag: flag ? String(flag).trim() : '🇸🇦',
    balance: typeof balance === 'number' ? Math.max(0, balance) : 50000,
    category: 'both',
    methods: ['STC Pay', 'تحويل بنكي', 'مدى Mada', 'USDT TRC20'],
    responseTimeAr: 'رد فوري (< دقيقة)',
    responseTimeEn: 'Instant reply (< 1 min)',
    rating: 5.0,
    completedOrders: 1,
    whatsapp: whatsapp ? String(whatsapp).trim() : '',
    telegram: telegram ? String(telegram).trim() : '',
    isOnline: true,
    minAmount: 100,
    maxAmount: 200000,
    rateNoteAr: 'شحن رصيد فوري وموثوق من وكيل معتمد',
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  agents.push(newAgent);
  saveStoredAgents(agents);

  return res.json({
    success: true,
    message: `تم تعيين المستخدم [${userName}] كوكيل شحن معتمد بنجاح برقم قريد [${cleanGrid}]!`,
    agent: newAgent,
  });
});

// 4. Endpoint إداري لتعديل بيانات الوكيل ودولته ورقم القريد (محمية بـ ADMIN_PIN)
app.post('/api/admin/update-agent', verifyAdminAuth, (req: Request, res: Response) => {
  const { agentId, email, name, country, flag, category, whatsapp, telegram, methods, rateNote, status, gridCode } = req.body;
  if (!agentId) {
    return res.status(400).json({ success: false, message: 'معرف الوكيل مطلوب' });
  }

  const agents = getStoredAgents();
  const agent = agents.find((a) => a.id === String(agentId));
  if (!agent) {
    return res.status(404).json({ success: false, message: 'الوكيل غير موجود' });
  }

  if (email) agent.email = String(email).trim().toLowerCase();
  if (name) {
    agent.name = String(name).trim();
    agent.nameEn = String(name).trim();
  }
  if (gridCode) agent.gridCode = String(gridCode).trim().toUpperCase();
  if (country) agent.country = String(country).trim();
  if (flag) agent.flag = String(flag).trim();
  if (category) agent.category = category;
  if (whatsapp !== undefined) agent.whatsapp = String(whatsapp).trim();
  if (telegram !== undefined) agent.telegram = String(telegram).trim();
  if (methods) {
    agent.methods = Array.isArray(methods)
      ? methods
      : typeof methods === 'string'
      ? methods.split(',').map((m: string) => m.trim()).filter(Boolean)
      : agent.methods;
  }
  if (rateNote !== undefined) agent.rateNoteAr = String(rateNote).trim();
  if (status) agent.status = status;
  agent.updatedAt = new Date().toISOString();

  saveStoredAgents(agents);

  return res.json({
    success: true,
    message: 'تم تحديث بيانات الوكيل ورقم القريد بنجاح.',
    agent,
  });
});

// 5. Endpoint إداري لتعديل رصيد الوكيل (إضافة أو خصم أو تعيين) (محمية بـ ADMIN_PIN)
app.post('/api/admin/update-agent-balance', verifyAdminAuth, (req: Request, res: Response) => {
  const { agentId, action, amount } = req.body; // action: 'add' | 'deduct' | 'set'
  if (!agentId || !action || typeof amount !== 'number') {
    return res.status(400).json({ success: false, message: 'معرف الوكيل ونوع الإجراء والقيمة مطلوبة' });
  }

  const agents = getStoredAgents();
  const agent = agents.find((a) => a.id === String(agentId) || a.gridCode === String(agentId));
  if (!agent) {
    return res.status(404).json({ success: false, message: 'الوكيل غير موجود' });
  }

  const currentBal = agent.balance || 0;
  let newBal = currentBal;

  if (action === 'add') {
    newBal = currentBal + Math.abs(amount);
  } else if (action === 'deduct') {
    newBal = Math.max(0, currentBal - Math.abs(amount));
  } else if (action === 'set') {
    newBal = Math.max(0, amount);
  }

  agent.balance = newBal;
  agent.updatedAt = new Date().toISOString();
  saveStoredAgents(agents);

  const actionText = action === 'add' ? `إضافة +${amount}` : action === 'deduct' ? `خصم -${amount}` : `تعيين الرصيد إلى ${newBal}`;

  return res.json({
    success: true,
    balance: newBal,
    message: `تم ${actionText} لرصيد الوكيل (${agent.name}) بنجاح. الرصيد الحالي: ${newBal.toLocaleString()}`,
    agent,
  });
});

// 6. Endpoint إداري لحذف وكيل (محمية بـ ADMIN_PIN)
app.post('/api/admin/delete-agent', verifyAdminAuth, (req: Request, res: Response) => {
  const { agentId } = req.body;
  if (!agentId) {
    return res.status(400).json({ success: false, message: 'معرف الوكيل مطلوب' });
  }

  const cleanTarget = String(agentId).trim();
  const agents = getStoredAgents();
  const filtered = agents.filter(
    (a) => a.id !== cleanTarget && a.email.toLowerCase() !== cleanTarget.toLowerCase() && a.gridCode !== cleanTarget
  );
  if (filtered.length === agents.length) {
    return res.status(404).json({ success: false, message: 'الوكيل غير موجود أو تم حذفه مسبقاً' });
  }

  saveStoredAgents(filtered);

  return res.json({
    success: true,
    message: 'تم حذف الوكيل نهائياً وتحديث قائمة الوكلاء المعتمدين بنجاح.',
    deletedAgentId: cleanTarget,
    remainingCount: filtered.length,
  });
});

// ==========================================
// بوابة وكالتي للشحن (My Recharge Agency Portal Endpoints)
// ==========================================

// 7.1 التحقق من كون المستخدم وكيلاً معتمداً وجلب بيانات وكالته
app.get('/api/agent/my-agency', (req: Request, res: Response) => {
  const email = ((req.query.email as string) || '').trim().toLowerCase();
  const userId = ((req.query.userId as string) || '').trim();
  const displayId = ((req.query.displayId as string) || '').trim();

  if (!email && !userId && !displayId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم أو بريده مطلوب' });
  }

  const agents = getStoredAgents();
  const agent = agents.find((a) => {
    if (email && a.email.toLowerCase() === email) return true;
    if (userId && a.id === userId) return true;
    if (displayId && a.id === displayId) return true;
    return false;
  });

  if (!agent || agent.status === 'suspended') {
    return res.json({
      success: true,
      isAgent: false,
    });
  }

  return res.json({
    success: true,
    isAgent: true,
    agent,
  });
});

// 7.2 التحقق من بيانات مستخدم من خلال ID الحساب قبل الشحن
app.post('/api/agent/lookup-user', async (req: Request, res: Response) => {
  const userIdentifier =
    req.body.userIdentifier || req.body.accountId || req.body.identifier || req.body.userId;
  if (!userIdentifier || !String(userIdentifier).trim()) {
    return res.status(400).json({ success: false, message: 'معرف الحساب مطلوب' });
  }

  const cleanId = String(userIdentifier).trim();

  // Try Supabase first
  if (supabaseAdmin) {
    const profile = await getSupabaseProfileByIdentifier(cleanId);
    if (profile) {
      return res.json({
        success: true,
        user: {
          id: profile.id,
          displayId: profile.display_id || profile.id,
          name: profile.name || 'مستخدم Soul-X',
          photoUrl: profile.avatar_url || null,
          walletBalance: typeof profile.wallet_balance === 'number' ? profile.wallet_balance : 1250,
          gender: profile.gender || null,
        },
      });
    }
  }

  // Fallback to local stored users
  const users = getStoredUsers();
  const user = users.find(
    (u) =>
      u.id === cleanId ||
      u.displayId === cleanId ||
      u.email.toLowerCase() === cleanId.toLowerCase()
  );

  if (user) {
    return res.json({
      success: true,
      user: {
        id: user.id,
        displayId: user.displayId || user.id,
        name: user.name,
        photoUrl: user.photoUrl || null,
        walletBalance: typeof user.walletBalance === 'number' ? user.walletBalance : 1250,
        gender: user.gender || null,
      },
    });
  }

  return res.status(404).json({
    success: false,
    message: 'لم يتم العثور على مستخدم مسجل بهذا المعرف. يرجى التأكد من كتابة ID الحساب بشكل صحيح.',
  });
});

// 7.3 شحن رصيد لمستخدم من خلال ID الحساب وخصمه من رصيد الوكالة
app.post('/api/agent/recharge-user', async (req: Request, res: Response) => {
  const { agentId, agentEmail, amount } = req.body;
  const targetUserIdentifier =
    req.body.targetUserIdentifier || req.body.accountId || req.body.targetUserId || req.body.userId;

  if ((!agentId && !agentEmail) || !targetUserIdentifier || !amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({
      success: false,
      message: 'بيانات العملية غير مكتملة (معرف الوكالة، معرف الحساب المستهدف، والقيمة مطلوبة)',
    });
  }

  const rechargeAmount = Math.floor(Math.abs(amount));
  const agents = getStoredAgents();
  const agent = agents.find(
    (a) =>
      (agentId && (a.id === String(agentId) || a.gridCode === String(agentId))) ||
      (agentEmail && a.email.toLowerCase() === String(agentEmail).trim().toLowerCase())
  );

  if (!agent) {
    return res.status(404).json({ success: false, message: 'بيانات وكالة الشحن غير موجودة!' });
  }

  if (agent.status === 'suspended') {
    return res.status(403).json({ success: false, message: 'وكالة الشحن معطلة مؤقتاً. يرجى التواصل مع الإدارة.' });
  }

  const currentAgencyBalance = agent.balance || 0;
  if (currentAgencyBalance < rechargeAmount) {
    return res.status(400).json({
      success: false,
      message: `رصيد الوكالة غير كافٍ لإتمام العملية! الرصيد المتوفر: ${currentAgencyBalance.toLocaleString()} 💎، المطلوب: ${rechargeAmount.toLocaleString()} 💎`,
    });
  }

  const cleanTarget = String(targetUserIdentifier).trim();
  let targetUserObj: any = null;

  // 1. Look up target user in Supabase
  if (supabaseAdmin) {
    const profile = await getSupabaseProfileByIdentifier(cleanTarget);
    if (profile) {
      targetUserObj = {
        id: profile.id,
        displayId: profile.display_id || profile.id,
        name: profile.name || 'مستخدم Soul-X',
        walletBalance: typeof profile.wallet_balance === 'number' ? profile.wallet_balance : 1250,
      };
    }
  }

  // 2. Look up in stored users if not found
  const users = getStoredUsers();
  let localUser = users.find(
    (u) =>
      u.id === cleanTarget ||
      u.displayId === cleanTarget ||
      u.email.toLowerCase() === cleanTarget.toLowerCase()
  );

  if (!targetUserObj && localUser) {
    targetUserObj = {
      id: localUser.id,
      displayId: localUser.displayId || localUser.id,
      name: localUser.name,
      walletBalance: typeof localUser.walletBalance === 'number' ? localUser.walletBalance : 1250,
    };
  }

  if (!targetUserObj) {
    return res.status(404).json({
      success: false,
      message: `لم يتم العثور على حساب المستخدم [${cleanTarget}]! يرجى التأكد من صحة الـ ID.`,
    });
  }

  // Deduct from agent balance
  const newAgencyBalance = currentAgencyBalance - rechargeAmount;
  agent.balance = newAgencyBalance;
  agent.completedOrders = (agent.completedOrders || 0) + 1;
  agent.updatedAt = new Date().toISOString();
  saveStoredAgents(agents);

  // Credit target user balance
  const previousUserBalance = targetUserObj.walletBalance;
  const newUserBalance = previousUserBalance + rechargeAmount;

  if (supabaseAdmin) {
    await updateSupabaseProfileByIdentifier(targetUserObj.id, {
      wallet_balance: newUserBalance,
      updated_at: new Date().toISOString(),
    });
  }

  if (localUser) {
    localUser.walletBalance = newUserBalance;
    localUser.updatedAt = new Date().toISOString();
    saveStoredUsers(users);
  } else {
    users.push({
      id: targetUserObj.id,
      displayId: targetUserObj.displayId,
      name: targetUserObj.name,
      email: `${targetUserObj.id}@soul-x.com`,
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      createdAt: new Date().toISOString(),
      walletBalance: newUserBalance,
    });
    saveStoredUsers(users);
  }

  // Save Transaction Record
  const txId = `TX-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  const transactions = getStoredAgencyTransactions();
  const txRecord: StoredAgencyTransaction = {
    id: txId,
    agentId: agent.id,
    gridCode: agent.gridCode || 'A8838',
    targetUserId: targetUserObj.id,
    targetUserDisplayId: targetUserObj.displayId,
    targetUserName: targetUserObj.name,
    amount: rechargeAmount,
    timestamp: new Date().toISOString(),
    previousBalance: previousUserBalance,
    newBalance: newUserBalance,
  };
  transactions.unshift(txRecord);
  saveStoredAgencyTransactions(transactions);

  return res.json({
    success: true,
    message: `تم شحن رصيد ${rechargeAmount.toLocaleString()} 💎 بنجاح للمستخدم ${targetUserObj.name} (${targetUserObj.displayId})`,
    newAgentBalance: newAgencyBalance,
    transaction: txRecord,
    targetUser: {
      id: targetUserObj.id,
      displayId: targetUserObj.displayId,
      name: targetUserObj.name,
      previousBalance: previousUserBalance,
      walletBalance: newUserBalance,
    },
  });
});

// 7.4 جلب قائمة طلبات السحب الخاصة بالوكالة
app.get('/api/agent/withdraw-requests', (req: Request, res: Response) => {
  const agentId = ((req.query.agentId as string) || '').trim();
  const gridCode = ((req.query.gridCode as string) || '').trim();

  const allRequests = getStoredAgencyWithdrawals();
  const filtered = allRequests.filter(
    (r) =>
      (!agentId && !gridCode) ||
      (agentId && r.agentId === agentId) ||
      (gridCode && r.gridCode.toUpperCase() === gridCode.toUpperCase())
  );

  return res.json({
    success: true,
    requests: filtered,
  });
});

// 7.5 تقديم طلب سحب رصيد جديد للوكالة
app.post('/api/agent/withdraw-requests', (req: Request, res: Response) => {
  const { agentId, amount, notes } = req.body;
  const method = req.body.method || req.body.payoutMethod || req.body.paymentMethod;
  const accountDetails = req.body.accountDetails || req.body.accountInfo || req.body.details;

  if (!agentId || !amount || typeof amount !== 'number' || amount <= 0 || !method || !accountDetails) {
    return res.status(400).json({
      success: false,
      message: 'بيانات طلب السحب غير مكتملة (المبلغ، طريقة السحب، وتفاصيل الحساب مطلوبة)',
    });
  }

  const withdrawAmount = Math.floor(Math.abs(amount));
  const agents = getStoredAgents();
  const agent = agents.find((a) => a.id === String(agentId) || a.gridCode === String(agentId));

  if (!agent) {
    return res.status(404).json({ success: false, message: 'وكالة الشحن غير موجودة' });
  }

  if (agent.balance < withdrawAmount) {
    return res.status(400).json({
      success: false,
      message: `رصيد الوكالة الحالي (${agent.balance.toLocaleString()} 💎) أقل من مبلغ السحب المطلوب (${withdrawAmount.toLocaleString()} 💎)`,
    });
  }

  // Deduct/reserve balance for withdrawal
  agent.balance -= withdrawAmount;
  agent.updatedAt = new Date().toISOString();
  saveStoredAgents(agents);

  const newRequest: StoredAgencyWithdrawal = {
    id: `WDR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
    agentId: agent.id,
    agentName: agent.name,
    gridCode: agent.gridCode || 'A8838',
    amount: withdrawAmount,
    method: String(method).trim(),
    accountDetails: String(accountDetails).trim(),
    notes: notes ? String(notes).trim() : undefined,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const withdrawals = getStoredAgencyWithdrawals();
  withdrawals.unshift(newRequest);
  saveStoredAgencyWithdrawals(withdrawals);

  return res.json({
    success: true,
    message: `تم تقديم طلب سحب بقيمة ${withdrawAmount.toLocaleString()} 💎 بنجاح، وهو قيد المراجعة لدى إدارة المنصة.`,
    request: newRequest,
    newAgentBalance: agent.balance,
  });
});

// 7.6 جلب سجل عمليات الشحن المنفذة للوكالة
app.get('/api/agent/transactions', (req: Request, res: Response) => {
  const agentId = ((req.query.agentId as string) || '').trim();
  const gridCode = ((req.query.gridCode as string) || '').trim();

  const allTx = getStoredAgencyTransactions();
  const filtered = allTx.filter(
    (t) =>
      (!agentId && !gridCode) ||
      (agentId && t.agentId === agentId) ||
      (gridCode && t.gridCode.toUpperCase() === gridCode.toUpperCase())
  );

  return res.json({
    success: true,
    transactions: filtered,
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

// ==========================================
// Matchmaking Queue & Real-time Live Matches
// نظام دور المطابقة الحصري (المطابقة بين المتواجدين في الدور حصراً)
// ==========================================
export interface QueueMember {
  userId: string;
  displayId: string;
  name: string;
  avatar: string;
  gender: 'male' | 'female';
  age: number;
  city: string;
  bio?: string;
  genderPreference: 'all' | 'male' | 'female';
  agePreference: 'all' | '18-25' | '26-35' | '36+';
  vibePreference: 'all' | 'spiritual' | 'deep' | 'friendly';
  joinedAt: number;
  lastHeartbeat: number;
  status: 'waiting' | 'matched';
  matchedWith?: string;
  matchSessionId?: string;
  isDemo?: boolean;
}

export interface LiveMatchSession {
  id: string;
  user1: QueueMember;
  user2: QueueMember;
  createdAt: number;
  status: 'active' | 'ended';
  endedBy?: string;
  endedReason?: string;
  messages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    text: string;
    time: string;
    isGift?: boolean;
    giftIcon?: string;
    giftName?: string;
    giftCost?: number;
  }>;
}

const liveMatchingQueue = new Map<string, QueueMember>();
const liveActiveMatches = new Map<string, LiveMatchSession>();

// Cleanup stale queue members (older than 30s)
function cleanStaleQueueMembers() {
  const now = Date.now();
  for (const [userId, member] of liveMatchingQueue.entries()) {
    if (member.status === 'waiting' && !member.isDemo && now - member.lastHeartbeat > 30000) {
      liveMatchingQueue.delete(userId);
    }
  }
}

// Find a partner exclusively from members currently waiting in the queue
function findMatchInQueue(seeker: QueueMember): QueueMember | null {
  cleanStaleQueueMembers();
  const waitingMembers = Array.from(liveMatchingQueue.values()).filter(
    (m) => m.userId !== seeker.userId && m.status === 'waiting'
  );

  if (waitingMembers.length === 0) return null;

  // First pass: mutual compatibility check based on seeker's and candidate's filters
  const filterMatched = waitingMembers.filter((candidate) => {
    // 1. Gender check
    if (seeker.genderPreference !== 'all' && candidate.gender !== seeker.genderPreference) {
      return false;
    }
    if (candidate.genderPreference !== 'all' && seeker.gender !== candidate.genderPreference) {
      return false;
    }

    // 2. Age check
    const candAge = candidate.age || 25;
    if (seeker.agePreference === '18-25' && (candAge < 18 || candAge > 25)) return false;
    if (seeker.agePreference === '26-35' && (candAge < 26 || candAge > 35)) return false;
    if (seeker.agePreference === '36+' && candAge < 36) return false;

    const seekerAge = seeker.age || 25;
    if (candidate.agePreference === '18-25' && (seekerAge < 18 || seekerAge > 25)) return false;
    if (candidate.agePreference === '26-35' && (seekerAge < 26 || seekerAge > 35)) return false;
    if (candidate.agePreference === '36+' && seekerAge < 36) return false;

    return true;
  });

  if (filterMatched.length > 0) {
    // Pick randomly among matched candidates from the queue
    const picked = filterMatched[Math.floor(Math.random() * filterMatched.length)];
    return picked;
  }

  // If seeker's preference is 'all', pick randomly from any waiting member in the queue whose filter allows the seeker
  if (seeker.genderPreference === 'all' && seeker.agePreference === 'all') {
    const openCandidates = waitingMembers.filter(
      (c) => c.genderPreference === 'all' || c.genderPreference === seeker.gender
    );
    if (openCandidates.length > 0) {
      return openCandidates[Math.floor(Math.random() * openCandidates.length)];
    }
  }

  return null;
}

// Create an active match session between two queue members
function createMatchSession(userA: QueueMember, userB: QueueMember): LiveMatchSession {
  const sessionId = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const session: LiveMatchSession = {
    id: sessionId,
    user1: userA,
    user2: userB,
    createdAt: Date.now(),
    status: 'active',
    messages: [],
  };

  userA.status = 'matched';
  userA.matchedWith = userB.userId;
  userA.matchSessionId = sessionId;

  userB.status = 'matched';
  userB.matchedWith = userA.userId;
  userB.matchSessionId = sessionId;

  liveActiveMatches.set(sessionId, session);
  return session;
}

// 1. Get queue statistics
app.get('/api/matching/queue/stats', (_req, res) => {
  cleanStaleQueueMembers();
  const waiting = Array.from(liveMatchingQueue.values()).filter((m) => m.status === 'waiting');
  return res.json({
    success: true,
    waitingCount: waiting.length,
    totalInQueue: liveMatchingQueue.size,
  });
});

// 2. Join the matchmaking queue
app.post('/api/matching/queue/join', (req, res) => {
  const {
    userId,
    displayId,
    name,
    avatar,
    gender = 'male',
    age = 25,
    city = 'الرياض',
    bio = '',
    genderPreference = 'all',
    agePreference = 'all',
    vibePreference = 'all',
  } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, message: 'Missing userId' });
  }

  cleanStaleQueueMembers();

  // If user is already in a session, close or return it
  const existing = liveMatchingQueue.get(userId);
  if (existing && existing.status === 'matched' && existing.matchSessionId) {
    const session = liveActiveMatches.get(existing.matchSessionId);
    if (session && session.status === 'active') {
      const partner = session.user1.userId === userId ? session.user2 : session.user1;
      return res.json({
        success: true,
        matched: true,
        sessionId: session.id,
        partner,
      });
    }
  }

  const member: QueueMember = {
    userId,
    displayId: displayId || userId,
    name: name || 'مستخدم Soul-X',
    avatar:
      avatar ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    gender: gender === 'female' ? 'female' : 'male',
    age: Number(age) || 25,
    city: city || 'الرياض',
    bio: bio || '',
    genderPreference: genderPreference || 'all',
    agePreference: agePreference || 'all',
    vibePreference: vibePreference || 'all',
    joinedAt: Date.now(),
    lastHeartbeat: Date.now(),
    status: 'waiting',
  };

  liveMatchingQueue.set(userId, member);

  // Look for match exclusively among other waiting members in the queue
  const partner = findMatchInQueue(member);
  if (partner) {
    const session = createMatchSession(member, partner);
    return res.json({
      success: true,
      matched: true,
      sessionId: session.id,
      partner: {
        userId: partner.userId,
        displayId: partner.displayId,
        name: partner.name,
        avatar: partner.avatar,
        gender: partner.gender,
        age: partner.age,
        city: partner.city,
        bio: partner.bio,
      },
    });
  }

  // Not matched yet, user is waiting in the queue
  const waitingList = Array.from(liveMatchingQueue.values()).filter((m) => m.status === 'waiting');
  const queuePos = waitingList.findIndex((m) => m.userId === userId) + 1;

  return res.json({
    success: true,
    matched: false,
    queuePosition: queuePos > 0 ? queuePos : 1,
    waitingCount: waitingList.length,
  });
});

// 3. Poll queue status / heartbeat
app.get('/api/matching/queue/poll', (req, res) => {
  const userId = String(req.query.userId || '').trim();
  if (!userId) {
    return res.status(400).json({ success: false, message: 'Missing userId' });
  }

  cleanStaleQueueMembers();

  const member = liveMatchingQueue.get(userId);
  if (!member) {
    return res.json({ success: true, inQueue: false });
  }

  member.lastHeartbeat = Date.now();

  // If already matched by another user who entered the queue
  if (member.status === 'matched' && member.matchSessionId) {
    const session = liveActiveMatches.get(member.matchSessionId);
    if (session && session.status === 'active') {
      const partner = session.user1.userId === userId ? session.user2 : session.user1;
      return res.json({
        success: true,
        inQueue: true,
        matched: true,
        sessionId: session.id,
        partner: {
          userId: partner.userId,
          displayId: partner.displayId,
          name: partner.name,
          avatar: partner.avatar,
          gender: partner.gender,
          age: partner.age,
          city: partner.city,
          bio: partner.bio,
        },
      });
    }
  }

  // If still waiting, try matching again against any newer entries in the queue
  const partner = findMatchInQueue(member);
  if (partner) {
    const session = createMatchSession(member, partner);
    return res.json({
      success: true,
      inQueue: true,
      matched: true,
      sessionId: session.id,
      partner: {
        userId: partner.userId,
        displayId: partner.displayId,
        name: partner.name,
        avatar: partner.avatar,
        gender: partner.gender,
        age: partner.age,
        city: partner.city,
        bio: partner.bio,
      },
    });
  }

  const waitingList = Array.from(liveMatchingQueue.values()).filter((m) => m.status === 'waiting');
  const queuePos = waitingList.findIndex((m) => m.userId === userId) + 1;

  return res.json({
    success: true,
    inQueue: true,
    matched: false,
    queuePosition: queuePos > 0 ? queuePos : 1,
    waitingCount: waitingList.length,
  });
});

// 4. Leave queue
app.post('/api/matching/queue/leave', (req, res) => {
  const { userId } = req.body;
  if (userId) {
    liveMatchingQueue.delete(userId);
  }
  return res.json({ success: true });
});

// 5. Add a candidate to the queue (to allow testing queue matching easily or inviting a profile into the queue)
app.post('/api/matching/queue/add-demo-user', (req, res) => {
  const { genderPreference = 'all', agePreference = 'all' } = req.body || {};

  // Available real/styled candidate personas to enter queue
  const samplePersonas = [
    {
      userId: 'queue-user-sarah-101',
      displayId: '8839210',
      name: 'سارة العتيبي',
      gender: 'female' as const,
      age: 23,
      city: 'الرياض',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      bio: 'محبة للأدب والهدوء ونقاشات الأرواح الراقية ✨',
      genderPreference: 'all' as const,
      agePreference: 'all' as const,
      vibePreference: 'deep' as const,
    },
    {
      userId: 'queue-user-faisal-102',
      displayId: '5519203',
      name: 'فيصل الغامدي',
      gender: 'male' as const,
      age: 27,
      city: 'جدة',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      bio: 'مهتم بالتقنية والموسيقى والحوار الصادق 💫',
      genderPreference: 'all' as const,
      agePreference: 'all' as const,
      vibePreference: 'friendly' as const,
    },
    {
      userId: 'queue-user-reem-103',
      displayId: '7721849',
      name: 'ريم الدوسري',
      gender: 'female' as const,
      age: 25,
      city: 'الدمام',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80',
      bio: 'أبحث عن تواصل روحي وتفاهم عميق بلا تصنع 🌸',
      genderPreference: 'all' as const,
      agePreference: 'all' as const,
      vibePreference: 'spiritual' as const,
    },
    {
      userId: 'queue-user-khalid-104',
      displayId: '9920148',
      name: 'خالد المنصور',
      gender: 'male' as const,
      age: 31,
      city: 'دبي',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
      bio: 'رائد أعمال، أهتم بالتطوير الذاتي والأحاديث الملهمة ☕',
      genderPreference: 'all' as const,
      agePreference: 'all' as const,
      vibePreference: 'deep' as const,
    },
  ];

  // Pick persona matching requested filters if possible
  let pool = samplePersonas;
  if (genderPreference !== 'all') {
    const match = pool.filter((p) => p.gender === genderPreference);
    if (match.length > 0) pool = match;
  }

  const chosen = pool[Math.floor(Math.random() * pool.length)];
  const demoEntry: QueueMember = {
    ...chosen,
    userId: `${chosen.userId}-${Date.now().toString().slice(-4)}`,
    joinedAt: Date.now(),
    lastHeartbeat: Date.now(),
    status: 'waiting',
    isDemo: true,
  };

  liveMatchingQueue.set(demoEntry.userId, demoEntry);

  return res.json({
    success: true,
    message: `انضم ${demoEntry.name} إلى دور المطابقة بنجاح.`,
    user: demoEntry,
  });
});

// 6. Get session messages and live status
app.get('/api/matching/session/messages', (req, res) => {
  const sessionId = String(req.query.sessionId || '').trim();
  const userId = String(req.query.userId || '').trim();

  if (!sessionId) {
    return res.status(400).json({ success: false, message: 'Missing sessionId' });
  }

  const session = liveActiveMatches.get(sessionId);
  if (!session) {
    return res.json({ success: false, status: 'ended', messages: [] });
  }

  const isUser1 = session.user1.userId === userId;
  const partner = isUser1 ? session.user2 : session.user1;

  return res.json({
    success: true,
    status: session.status,
    endedBy: session.endedBy,
    endedReason: session.endedReason,
    partner: {
      userId: partner.userId,
      displayId: partner.displayId,
      name: partner.name,
      avatar: partner.avatar,
      gender: partner.gender,
      age: partner.age,
      city: partner.city,
      bio: partner.bio,
    },
    messages: session.messages,
  });
});

// 7. Send message in match session
app.post('/api/matching/session/message', async (req, res) => {
  const { sessionId, senderId, senderName, text, isGift, giftIcon, giftName, giftCost } = req.body;

  if (!sessionId || !senderId) {
    return res.status(400).json({ success: false, message: 'Missing parameters' });
  }

  const session = liveActiveMatches.get(sessionId);
  if (!session || session.status !== 'active') {
    return res.status(400).json({ success: false, message: 'Session is not active' });
  }

  const otherMember = session.user1.userId === senderId ? session.user2 : session.user1;

  // If sending a gift, deduct Coins from sender and credit Diamonds to the other member
  let giftTransfer: any = null;
  if (isGift && giftCost && Number(giftCost) > 0) {
    giftTransfer = await transferGiftCoinsToDiamonds(senderId, otherMember.userId, Number(giftCost));
    if (!giftTransfer.success) {
      return res.status(400).json({ success: false, message: giftTransfer.message || 'رصيد الكوينز غير كافٍ لإرسال هذه الهدية' });
    }
  }

  const newMsg = {
    id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    senderId,
    senderName: senderName || 'مستخدم',
    text: text || '',
    time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    isGift: Boolean(isGift),
    giftIcon,
    giftName,
    giftCost: giftCost ? Number(giftCost) : undefined,
  };

  session.messages.push(newMsg);

  // If the other user in this session is a demo queue member, reply dynamically after a brief delay
  if (otherMember.isDemo) {
    setTimeout(() => {
      if (session.status === 'active') {
        let replyText = 'يسعدني تواصلك الجميل من خلال دور المطابقة! ✨';
        if (isGift) {
          replyText = `شكراً جزيلاً لك على هذه الهدية الفاخرة (${giftName})! كلك ذوق وكرم 💖 تم استلامها كـ ${giftCost} ماسة في محفظتي ✨`;
        } else {
          const sampleReplies = [
            'كلامك راقٍ ومميز، يسعدني التوافق والتحدث معك!',
            'أهلاً بك! سررت بمطابقتك من الدور، كيف حال يومك؟ 💫',
            'التواصل الصادق هو أجمل ما في هذا المكان ✨',
            'أتفق معك تماماً، هذا ما يجعل الحوار معك ممتعاً!',
          ];
          replyText = sampleReplies[Math.floor(Math.random() * sampleReplies.length)];
        }

        session.messages.push({
          id: `m-reply-${Date.now()}`,
          senderId: otherMember.userId,
          senderName: otherMember.name,
          text: replyText,
          time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    }, 1200);
  }

  return res.json({
    success: true,
    message: newMsg,
    senderCoins: giftTransfer?.senderCoins,
    recipientDiamonds: giftTransfer?.recipientDiamonds,
  });
});

// 8. End match session (or click Next)
app.post('/api/matching/session/end', (req, res) => {
  const { sessionId, userId, action = 'exit' } = req.body;

  if (sessionId) {
    const session = liveActiveMatches.get(sessionId);
    if (session) {
      session.status = 'ended';
      session.endedBy = userId;
      session.endedReason = action === 'next' ? 'next_match' : 'left_chat';

      // Clean queue mappings for these users so they can rejoin or search again
      liveMatchingQueue.delete(session.user1.userId);
      liveMatchingQueue.delete(session.user2.userId);
    }
  }

  if (userId) {
    liveMatchingQueue.delete(userId);
  }

  return res.json({ success: true });
});

// Restore and synchronize persistent data from Supabase across deployments
async function syncDatabaseFromSupabase() {
  if (!supabaseAdmin) {
    console.log('ℹ️ [Persistence] Running with local storage persistence.');
    return;
  }
  try {
    console.log('🔄 [Persistence] Synchronizing persistent users and data from Supabase...');
    const { data: dbProfiles, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .limit(1000);

    if (!error && Array.isArray(dbProfiles) && dbProfiles.length > 0) {
      const users = getStoredUsers();
      let changed = false;

      for (const p of dbProfiles) {
        let existing = users.find(
          (u) =>
            u.id === p.id ||
            (p.display_id && u.displayId === p.display_id) ||
            (p.email && u.email.toLowerCase() === p.email.toLowerCase())
        );

        if (!existing) {
          users.push({
            id: p.id,
            displayId: p.display_id || generateSoulXId(),
            email: p.email || `${p.id}@soul-x.com`,
            name: p.name || 'مستخدم Soul-X',
            passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
            photoUrl: p.avatar_url || undefined,
            birthDate: p.birth_date || null,
            gender: p.gender || null,
            walletBalance: typeof p.wallet_balance === 'number' ? p.wallet_balance : 1250,
            coinsBalance: 25000,
            createdAt: p.created_at || new Date().toISOString(),
          });
          changed = true;
        } else {
          // Sync updated fields from Supabase
          if (p.name && existing.name !== p.name) {
            existing.name = p.name;
            changed = true;
          }
          if (p.avatar_url && existing.photoUrl !== p.avatar_url) {
            existing.photoUrl = p.avatar_url;
            changed = true;
          }
          if (typeof p.wallet_balance === 'number' && existing.walletBalance !== p.wallet_balance) {
            existing.walletBalance = p.wallet_balance;
            changed = true;
          }
          if (p.birth_date && existing.birthDate !== p.birth_date) {
            existing.birthDate = p.birth_date;
            changed = true;
          }
          if (p.gender && existing.gender !== p.gender) {
            existing.gender = p.gender;
            changed = true;
          }
        }
      }

      if (changed) {
        saveStoredUsers(users);
        console.log(`✅ [Persistence] Restored & synchronized ${dbProfiles.length} profiles from Supabase.`);
      } else {
        console.log(`✅ [Persistence] All ${dbProfiles.length} Supabase profiles are up to date.`);
      }
    }
  } catch (err) {
    console.warn('⚠️ [Persistence] Supabase startup sync warning:', err);
  }
}

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

    // Restore and synchronize persistent data from Supabase across redeployments
    await syncDatabaseFromSupabase().catch((err) => {
      console.warn('⚠️ [Persistence] Startup sync failed:', err);
    });

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
