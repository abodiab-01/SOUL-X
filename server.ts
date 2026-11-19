import express from 'express';
import type { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;
import QRCode from 'qrcode';
import { TelegramBotService } from './botService.ts';
import {
  generateTotpSecret,
  generateBackupCodes,
  generateTOTP,
  verifyTOTP,
  generateTotpUri,
} from './totpService.ts';
import {
  initSupremeNeonTables,
  archiveDeletedChatSnapshot,
  recordMatchCreated,
  recordMatchMessage,
  recordMatchEnded,
  recordUserActivityLog,
  recordAdmin2ActivityLog,
  recordGeneralSiteLog,
  registerSupremeRoutes,
  getAdmin1Email,
  getAdmin2Email,
  getClientIp,
} from './supremeVault.ts';
import { registerGoldenTreeRoutes } from './goldenTreeEngine.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ==========================================
// Neon Database (Serverless PostgreSQL) Integration
// ==========================================
function withTimeout<T>(promise: PromiseLike<T> | Promise<T>, ms = 6000): Promise<T | null> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// Database connection: DATABASE_URL1 is the official environment variable for Neon PostgreSQL
export let DATABASE_URL = (process.env.DATABASE_URL1 || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '').trim();
const NEON_CONFIG_FILE = path.resolve(__dirname, 'data', 'neon_config.json');

// Read stored Neon config if env vars are missing
function loadStoredNeonConfig() {
  try {
    if (fs.existsSync(NEON_CONFIG_FILE)) {
      const raw = fs.readFileSync(NEON_CONFIG_FILE, 'utf-8');
      const cfg = JSON.parse(raw);
      if (cfg && cfg.databaseUrl && !DATABASE_URL) {
        DATABASE_URL = String(cfg.databaseUrl).trim();
      }
    }
  } catch (e) {
    console.warn('Error reading data/neon_config.json:', e);
  }
}

loadStoredNeonConfig();

export let neonPool: pg.Pool | null = null;

// Legacy Supabase references permanently unlinked
export let supabaseAdmin: any = null;
export let SUPABASE_URL = '';
export let SUPABASE_ANON_KEY = '';
export let SUPABASE_SERVICE_ROLE_KEY = '';

export const verifiedNeonTables = {
  profiles: false,
  agents: false,
  friends: false,
  friend_requests: false,
  conversations: false,
  conversation_participants: false,
  messages: false,
  agency_withdrawals: false,
  agency_transactions: false,
  tombstones: false,
  feedback_reports: false,
  password_reset_requests: false,
  verification_requests: false,
  lastChecked: 0,
};

export const verifiedTablesState = verifiedNeonTables;

export async function checkNeonTableLive(tableName: string): Promise<{ ok: boolean; count: number; error?: string }> {
  if (!neonPool) return { ok: false, count: 0, error: 'Neon database pool not connected' };
  try {
    const res: any = await withTimeout(
      neonPool.query(`SELECT count(*)::int as count FROM "${tableName}"`),
      2500
    );
    if (!res) {
      return { ok: false, count: 0, error: 'Query timeout (2500ms)' };
    }
    const count = res.rows?.[0]?.count ?? 0;
    return { ok: true, count };
  } catch (err: any) {
    return { ok: false, count: 0, error: err?.message };
  }
}

export async function verifyAllNeonTables(): Promise<void> {
  if (!neonPool) return;
  try {
    const [p, a, f, fr, c, cp, m, w, tx, t, fbr, prr, vr] = await Promise.all([
      checkNeonTableLive('profiles'),
      checkNeonTableLive('agents'),
      checkNeonTableLive('friends'),
      checkNeonTableLive('friend_requests'),
      checkNeonTableLive('conversations'),
      checkNeonTableLive('conversation_participants'),
      checkNeonTableLive('messages'),
      checkNeonTableLive('agency_withdrawals'),
      checkNeonTableLive('agency_transactions'),
      checkNeonTableLive('tombstones'),
      checkNeonTableLive('feedback_reports'),
      checkNeonTableLive('password_reset_requests'),
      checkNeonTableLive('verification_requests'),
    ]);
    verifiedNeonTables.profiles = p.ok;
    verifiedNeonTables.agents = a.ok;
    verifiedNeonTables.friends = f.ok;
    verifiedNeonTables.friend_requests = fr.ok;
    verifiedNeonTables.conversations = c.ok;
    verifiedNeonTables.conversation_participants = cp.ok;
    verifiedNeonTables.messages = m.ok;
    verifiedNeonTables.agency_withdrawals = w.ok;
    verifiedNeonTables.agency_transactions = tx.ok;
    verifiedNeonTables.tombstones = t.ok;
    verifiedNeonTables.feedback_reports = fbr.ok;
    verifiedNeonTables.password_reset_requests = prr.ok;
    verifiedNeonTables.verification_requests = vr.ok;
    verifiedNeonTables.lastChecked = Date.now();
  } catch {}
}

export function parseDbNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : fallback;
  if (typeof val === 'bigint') return Number(val);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return fallback;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function parseOptionalDbNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'bigint') return Number(val);
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function autoMigrateNeonSchema(): Promise<{ success: boolean; error?: string }> {
  if (!neonPool) return { success: false, error: 'Neon not connected' };
  try {
    const schemaPath = path.resolve(__dirname, 'data', 'neon_schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      await neonPool.query(sql);
      await neonPool.query(`
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_type TEXT;
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS media_url TEXT;
        ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_duration INT;
        ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'telegram';
        ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS user_id TEXT;
        ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS user_display_id TEXT;
        ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS user_email TEXT;
        ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS user_name TEXT;
        ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS contact_note TEXT;
        ALTER TABLE password_reset_requests ADD COLUMN IF NOT EXISTS resolved_by TEXT;
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS min_amount NUMERIC(18, 2) DEFAULT 100;
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS max_amount NUMERIC(18, 2) DEFAULT 2000000;
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS rate_note_ar TEXT;
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS rate_note_en TEXT;
        ALTER TABLE agents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
        ALTER TABLE agents ALTER COLUMN balance TYPE NUMERIC(18, 2) USING COALESCE(balance, 0)::NUMERIC(18, 2);
        ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS order_id TEXT;
        ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS order_number TEXT;
        ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS agent_name TEXT;
        ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS amount NUMERIC(18, 2) DEFAULT 0;
        ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS fee NUMERIC(18, 2) DEFAULT 0;
        ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS net_credited NUMERIC(18, 2) DEFAULT 0;
        ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS net_usd_amount NUMERIC(12, 2) DEFAULT 0;
        ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS method TEXT;
        ALTER TABLE agency_withdrawals ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE agency_withdrawals ALTER COLUMN diamonds_amount DROP NOT NULL;
        ALTER TABLE agency_withdrawals ALTER COLUMN usd_amount DROP NOT NULL;
        ALTER TABLE agency_withdrawals ALTER COLUMN payment_method DROP NOT NULL;
        ALTER TABLE agency_transactions ADD COLUMN IF NOT EXISTS order_id TEXT;
        ALTER TABLE agency_transactions ADD COLUMN IF NOT EXISTS order_number TEXT;
        ALTER TABLE agency_transactions ADD COLUMN IF NOT EXISTS usd_amount NUMERIC(12, 2);
        ALTER TABLE agency_transactions ADD COLUMN IF NOT EXISTS net_usd_amount NUMERIC(12, 2);
        ALTER TABLE agency_transactions ALTER COLUMN amount TYPE NUMERIC(18, 2) USING COALESCE(amount, 0)::NUMERIC(18, 2);
        ALTER TABLE agency_transactions ALTER COLUMN gross_amount TYPE NUMERIC(18, 2) USING gross_amount::NUMERIC(18, 2);
        ALTER TABLE agency_transactions ALTER COLUMN fee_amount TYPE NUMERIC(18, 2) USING fee_amount::NUMERIC(18, 2);
        ALTER TABLE agency_transactions ALTER COLUMN previous_balance TYPE NUMERIC(18, 2) USING previous_balance::NUMERIC(18, 2);
        ALTER TABLE agency_transactions ALTER COLUMN new_balance TYPE NUMERIC(18, 2) USING new_balance::NUMERIC(18, 2);
        ALTER TABLE games_settings ADD COLUMN IF NOT EXISTS olympus_profit_level NUMERIC(4, 2) DEFAULT 5;
        ALTER TABLE games_settings ADD COLUMN IF NOT EXISTS boxes_profit_level NUMERIC(4, 2) DEFAULT 5;
        ALTER TABLE games_settings ADD COLUMN IF NOT EXISTS winter_slots_profit_level NUMERIC(4, 2) DEFAULT 5;
        ALTER TABLE games_settings ADD COLUMN IF NOT EXISTS algorithm_config JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
      `).catch(() => {});
      console.log('⚡ [Neon Database] Schema tables & indexes migrated successfully.');
      return { success: true };
    }
  } catch (err: any) {
    console.warn('Neon auto migration warning:', err?.message || err);
    return { success: false, error: err?.message };
  }
  return { success: false, error: 'Schema file not found' };
}

export async function initNeonClient(connString?: string): Promise<boolean> {
  if (connString) DATABASE_URL = connString.trim();
  if (!DATABASE_URL) {
    loadStoredNeonConfig();
  }

  if (neonPool) {
    try {
      await neonPool.end();
    } catch {}
    neonPool = null;
  }

  const cleanUrl = DATABASE_URL.trim();
  const isPostgresUrl = cleanUrl.startsWith('postgres://') || cleanUrl.startsWith('postgresql://');

  if (isPostgresUrl) {
    try {
      neonPool = new Pool({
        connectionString: cleanUrl,
        ssl: {
          rejectUnauthorized: false,
        },
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        max: 10,
      });

      const testRes = await withTimeout(neonPool.query('SELECT NOW() as now, version() as version'), 4000);
      if (testRes && testRes.rows && testRes.rows.length > 0) {
        console.log(`⚡ [Neon Database] Connected to Neon PostgreSQL: ${testRes.rows[0].version}`);
        await autoMigrateNeonSchema().catch(() => {});
        await verifyAllNeonTables().catch(() => {});
        await purgeMockDataFromNeon().catch(() => {});
        await syncDatabaseFromNeon().catch(() => {});
        await syncAgentsWithNeon().catch(() => {});
        await syncAgencyTransactionsWithNeon().catch(() => {});
        await syncAgencyWithdrawalsWithNeon().catch(() => {});
        await syncMessagesWithNeon().catch(() => {});
        await syncFeedbackReportsWithNeon().catch(() => {});
        await syncPasswordResetsWithNeon().catch(() => {});
        await syncBotReferralsWithNeon().catch(() => {});
        await syncGamesSettingsWithNeon().catch(() => {});
        await syncAppSettingsWithNeon().catch(() => {});
        await syncVerificationRequestsWithNeon().catch(() => {});
        await initSupremeNeonTables(neonPool).catch(() => {});
        return true;
      }
    } catch (err: any) {
      console.error('Neon database connection error:', err?.message || err);
      neonPool = null;
      return false;
    }
  }

  neonPool = null;
  console.log('ℹ️ Neon Database credentials not detected yet in env, running in resilient fallback mode.');
  return false;
}

const neonInitPromise: Promise<boolean> = initNeonClient().catch(() => false);

// Helper to resolve displayId or uuid to profile UUID
function isUuidString(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val || '').trim());
}

async function resolveProfileId(userIdOrDisplayId: string): Promise<string> {
  const clean = String(userIdOrDisplayId || '').trim();
  if (!clean) return clean;
  // If already in uuid format
  if (isUuidString(clean)) {
    return clean;
  }
  // Check local users first (instant)
  try {
    const users = getStoredUsers();
    const match = users.find((u) => u.id === clean || u.displayId === clean || u.email.toLowerCase() === clean.toLowerCase());
    if (match?.id && isUuidString(match.id)) {
      return match.id;
    }
  } catch {}

  if (neonPool && verifiedNeonTables.profiles) {
    try {
      const res: any = await withTimeout(
        neonPool.query(
          'SELECT id FROM profiles WHERE display_id = $1 OR email = LOWER($1) LIMIT 1',
          [clean]
        ),
        1200
      );
      if (res?.rows?.[0]?.id) return res.rows[0].id;
    } catch {}
  }
  return clean;
}

// Helper to resolve all alias keys for a user (ID, displayId, email, UUID) across local users & Neon
export async function getUserIdentifierSet(
  identifier: string,
  optionalEmail?: string,
  optionalDisplayId?: string
): Promise<Set<string>> {
  const set = new Set<string>();
  const addKey = (val?: string | null) => {
    if (val && typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed) {
        set.add(trimmed);
        set.add(trimmed.toLowerCase());
      }
    }
  };

  addKey(identifier);
  addKey(optionalEmail);
  addKey(optionalDisplayId);

  try {
    const users = getStoredUsers();
    for (const u of users) {
      const match =
        (u.id && (set.has(u.id) || set.has(u.id.toLowerCase()))) ||
        (u.displayId && (set.has(u.displayId) || set.has(u.displayId.toLowerCase()))) ||
        (u.email && set.has(u.email.toLowerCase()));
      if (match) {
        addKey(u.id);
        addKey(u.displayId);
        addKey(u.email);
      }
    }
  } catch {}

  if (neonPool && verifiedNeonTables.profiles) {
    try {
      const candidates = Array.from(set).filter((k) => k.length > 2);
      for (const cand of candidates.slice(0, 3)) {
        const profile = await getNeonProfileByIdentifier(cand);
        if (profile) {
          addKey(profile.id);
          addKey(profile.display_id);
          addKey(profile.email);
        }
      }
    } catch {}
  }

  return set;
}

// Safely query Neon profile by ID, Display ID, or Email
async function getNeonProfileByIdentifier(identifier: string) {
  if (!neonPool || !identifier) return null;
  const clean = String(identifier).trim();
  try {
    const res: any = await withTimeout(
      neonPool.query(
        'SELECT * FROM profiles WHERE id = $1 OR display_id = $1 OR email = LOWER($1) LIMIT 1',
        [clean]
      ),
      5000
    );
    if (res?.rows?.[0]) {
      const r = res.rows[0];
      verifiedNeonTables.profiles = true;
      const walletBal = parseDbNumber(r.wallet_balance, 0);
      const coinsBal = parseDbNumber(r.coins_balance, 0);
      const bDate = r.birth_date
        ? (r.birth_date instanceof Date ? r.birth_date.toISOString().split('T')[0] : String(r.birth_date).split('T')[0])
        : null;
      return {
        id: r.id,
        displayId: r.display_id,
        display_id: r.display_id,
        name: r.name,
        email: r.email,
        passwordHash: r.password_hash,
        password_hash: r.password_hash,
        photoUrl: r.avatar_url,
        avatar_url: r.avatar_url,
        birthDate: bDate,
        gender: r.gender,
        country: r.country,
        bio: r.bio,
        walletBalance: walletBal,
        wallet_balance: walletBal,
        coinsBalance: coinsBal,
        coins_balance: coinsBal,
        birth_date: bDate,
        isAdmin: Boolean(r.is_admin),
        is_admin: Boolean(r.is_admin),
        isVerified: Boolean(r.is_verified),
        is_verified: Boolean(r.is_verified),
        createdAt: r.created_at,
        created_at: r.created_at,
        updatedAt: r.updated_at,
        updated_at: r.updated_at,
      };
    }
  } catch (err) {
    console.warn('Neon get profile warning:', err);
  }
  return null;
}
const getSupabaseProfileByIdentifier = getNeonProfileByIdentifier;

// Safely update Neon profile by ID, Display ID, or Email (auto-upserts if row missing in Neon)
async function updateNeonProfileByIdentifier(identifier: string, updates: Record<string, any>): Promise<boolean> {
  if (!neonPool || !identifier) return false;
  const clean = String(identifier).trim();
  try {
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.name !== undefined) { sets.push(`name = $${idx++}`); values.push(updates.name); }
    if (updates.email !== undefined) { sets.push(`email = LOWER($${idx++})`); values.push(String(updates.email).trim().toLowerCase()); }
    if (updates.displayId !== undefined || updates.display_id !== undefined) {
      sets.push(`display_id = $${idx++}`);
      values.push(updates.displayId || updates.display_id);
    }
    if (updates.photoUrl !== undefined || updates.avatar_url !== undefined) {
      sets.push(`avatar_url = $${idx++}`);
      values.push(updates.photoUrl || updates.avatar_url);
    }
    if (updates.walletBalance !== undefined || updates.wallet_balance !== undefined) {
      const wb = Math.max(0, Math.round(parseDbNumber(updates.walletBalance ?? updates.wallet_balance, 0)));
      sets.push(`wallet_balance = $${idx++}`);
      values.push(wb);
    }
    if (updates.coinsBalance !== undefined || updates.coins_balance !== undefined) {
      const cb = Math.max(0, Math.round(parseDbNumber(updates.coinsBalance ?? updates.coins_balance, 0)));
      sets.push(`coins_balance = $${idx++}`);
      values.push(cb);
    }
    if (updates.bio !== undefined) { sets.push(`bio = $${idx++}`); values.push(updates.bio); }
    if (updates.country !== undefined) { sets.push(`country = $${idx++}`); values.push(updates.country); }
    if (updates.gender !== undefined) { sets.push(`gender = $${idx++}`); values.push(updates.gender); }
    if (updates.birthDate !== undefined || updates.birth_date !== undefined) {
      const bDate = updates.birthDate ?? updates.birth_date;
      sets.push(`birth_date = $${idx++}::date`);
      values.push(bDate ? String(bDate).split('T')[0] : null);
    }
    if (updates.passwordHash !== undefined || updates.password_hash !== undefined) {
      sets.push(`password_hash = $${idx++}`);
      values.push(updates.passwordHash ?? updates.password_hash);
    }
    if (updates.isVerified !== undefined || updates.is_verified !== undefined) {
      sets.push(`is_verified = $${idx++}`);
      values.push(Boolean(updates.isVerified ?? updates.is_verified));
    }

    if (sets.length === 0) return true;
    sets.push(`updated_at = NOW()`);
    values.push(clean);
    const sql = `UPDATE profiles SET ${sets.join(', ')} WHERE id = $${idx} OR display_id = $${idx} OR email = LOWER($${idx})`;
    const res: any = await withTimeout(neonPool.query(sql, values), 5000);
    verifiedNeonTables.profiles = true;

    // If 0 rows existed in Neon yet, upsert full local profile so balances are never silently dropped
    if (res && (res.rowCount ?? 0) === 0) {
      const localUser = getStoredUsers().find(
        (u) =>
          u.id === clean ||
          u.displayId === clean ||
          (u.email && u.email.toLowerCase() === clean.toLowerCase())
      );
      if (localUser) {
        const mergedWallet =
          updates.walletBalance !== undefined || updates.wallet_balance !== undefined
            ? Math.max(0, Math.round(parseDbNumber(updates.walletBalance ?? updates.wallet_balance, 0)))
            : localUser.walletBalance;
        const mergedCoins =
          updates.coinsBalance !== undefined || updates.coins_balance !== undefined
            ? Math.max(0, Math.round(parseDbNumber(updates.coinsBalance ?? updates.coins_balance, 0)))
            : localUser.coinsBalance;
        await saveProfileToNeon({
          ...localUser,
          name: updates.name ?? localUser.name,
          email: updates.email ?? localUser.email,
          displayId: updates.displayId ?? updates.display_id ?? localUser.displayId,
          photoUrl: updates.photoUrl ?? updates.avatar_url ?? localUser.photoUrl,
          birthDate:
            updates.birthDate !== undefined || updates.birth_date !== undefined
              ? (updates.birthDate ?? updates.birth_date)
              : localUser.birthDate,
          gender: updates.gender !== undefined ? updates.gender : localUser.gender,
          country: updates.country !== undefined ? updates.country : localUser.country,
          bio: updates.bio !== undefined ? updates.bio : localUser.bio,
          walletBalance: mergedWallet,
          coinsBalance: mergedCoins,
          isVerified:
            updates.isVerified !== undefined || updates.is_verified !== undefined
              ? Boolean(updates.isVerified ?? updates.is_verified)
              : Boolean(localUser.isVerified),
        });
      }
    }
    return true;
  } catch (err: any) {
    console.warn('Neon update profile warning:', err?.message || err);
    return false;
  }
}
const updateSupabaseProfileByIdentifier = updateNeonProfileByIdentifier;

// Safely insert or upsert a user profile directly into Neon PostgreSQL
export async function saveProfileToNeon(user: {
  id: string;
  displayId?: string;
  email: string;
  name: string;
  passwordHash?: string;
  photoUrl?: string;
  birthDate?: string | null;
  gender?: string | null;
  country?: string | null;
  bio?: string;
  walletBalance?: number;
  coinsBalance?: number;
  isAdmin?: boolean;
  isVerified?: boolean;
  createdAt?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!neonPool) {
    return { success: false, error: 'Neon database pool not connected' };
  }

  const cleanEmail = String(user.email || '').trim().toLowerCase();
  const cleanId = String(user.id || '').trim();
  const cleanDisplayId = user.displayId ? String(user.displayId).trim() : generateSoulXId();
  const cleanBirthDate = user.birthDate ? String(user.birthDate).split('T')[0] : null;
  const isUserAdmin = Boolean(user.isAdmin || getAdminEmails().includes(cleanEmail));

  try {
    // 1. Check if user already exists in Neon profiles table by ID, displayId, or email
    const checkRes: any = await withTimeout(
      neonPool.query(
        'SELECT id, display_id, email FROM profiles WHERE id = $1 OR display_id = $2 OR email = LOWER($3) LIMIT 1',
        [cleanId, cleanDisplayId, cleanEmail]
      ),
      5000
    ).catch(async (e: any) => {
      if (e?.message && (e.message.includes('relation "profiles" does not exist') || e.message.includes('does not exist'))) {
        console.log('⚡ [Neon Database] Profiles table missing, auto-running migration...');
        await autoMigrateNeonSchema().catch(() => {});
        return await withTimeout(
          neonPool!.query(
            'SELECT id, display_id, email FROM profiles WHERE id = $1 OR display_id = $2 OR email = LOWER($3) LIMIT 1',
            [cleanId, cleanDisplayId, cleanEmail]
          ),
          5000
        );
      }
      throw e;
    });

    if (checkRes?.rows && checkRes.rows.length > 0) {
      // Row exists -> Update profile in Neon
      const existingRow = checkRes.rows[0];
      await withTimeout(
        neonPool.query(
          `UPDATE profiles SET
             name = $1,
             display_id = $2,
             email = LOWER($3),
             password_hash = COALESCE($4, password_hash),
             avatar_url = COALESCE($5, avatar_url),
             birth_date = COALESCE($6::date, birth_date),
             gender = COALESCE($7, gender),
             country = COALESCE($8, country),
             bio = COALESCE($9, bio),
             wallet_balance = COALESCE($10, wallet_balance),
             coins_balance = COALESCE($11, coins_balance),
             is_admin = $12,
             is_verified = COALESCE($14, is_verified),
             updated_at = NOW()
           WHERE id = $13`,
          [
            user.name ? user.name.trim() : 'مستخدم Soul-X',
            cleanDisplayId,
            cleanEmail,
            user.passwordHash || null,
            user.photoUrl || null,
            cleanBirthDate,
            user.gender || null,
            user.country || null,
            user.bio || null,
            typeof user.walletBalance === 'number' ? user.walletBalance : null,
            typeof user.coinsBalance === 'number' ? user.coinsBalance : null,
            isUserAdmin,
            existingRow.id,
            typeof user.isVerified === 'boolean' ? user.isVerified : null,
          ]
        ),
        5000
      );
      verifiedNeonTables.profiles = true;
      console.log(`⚡ [Neon Database] Profile updated in Neon: ${cleanEmail} (${cleanDisplayId})`);
      return { success: true };
    } else {
      // Row does NOT exist -> Insert fresh profile record into Neon
      await withTimeout(
        neonPool.query(
          `INSERT INTO profiles (
             id, display_id, email, name, password_hash, avatar_url, birth_date, gender, country, bio, wallet_balance, coins_balance, is_admin, is_verified, created_at, updated_at
           ) VALUES (
             $1, $2, LOWER($3), $4, $5, $6, $7::date, $8, $9, $10, $11, $12, $13, $15, $14, NOW()
           )`,
          [
            cleanId,
            cleanDisplayId,
            cleanEmail,
            user.name ? user.name.trim() : 'مستخدم Soul-X',
            user.passwordHash || null,
            user.photoUrl || null,
            cleanBirthDate,
            user.gender || null,
            user.country || null,
            user.bio || null,
            typeof user.walletBalance === 'number' ? user.walletBalance : (isUserAdmin ? 99999 : 0),
            typeof user.coinsBalance === 'number' ? user.coinsBalance : (isUserAdmin ? 100000 : 0),
            isUserAdmin,
            user.createdAt || new Date().toISOString(),
            Boolean(user.isVerified),
          ]
        ),
        5000
      );
      verifiedNeonTables.profiles = true;
      console.log(`✅ [Neon Database] User registered and saved to Neon profiles table: ${cleanEmail} (${cleanDisplayId})`);
      return { success: true };
    }
  } catch (err: any) {
    console.error('❌ [Neon Database] saveProfileToNeon error:', err?.message || err);
    return { success: false, error: err?.message };
  }
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
  country?: string | null;
  walletBalance?: number;
  coinsBalance?: number;
  bio?: string;
  updatedAt?: string;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string;
  twoFactorBackupCodes?: string[];
  twoFactorEnabledAt?: string;
  isBanned?: boolean;
  bannedAt?: string | null;
  banReason?: string | null;
  isFrozen?: boolean;
  frozenAt?: string | null;
  freezeDurationMinutes?: number | null;
  freezeExpiresAt?: string | null;
  freezeReason?: string | null;
  isVerified?: boolean;
  lastVerificationOutcome?: {
    status: 'approved' | 'rejected';
    rejectionReason?: string | null;
    submittedAt?: string | null;
    reviewedAt?: string | null;
  } | null;
}

export function checkAndExpireUserFreeze(user: StoredUser): boolean {
  if (!user.isFrozen) return false;

  let expiresTime = user.freezeExpiresAt ? new Date(user.freezeExpiresAt).getTime() : NaN;
  if ((!Number.isFinite(expiresTime) || !user.freezeExpiresAt) && user.frozenAt && user.freezeDurationMinutes) {
    const startMs = new Date(user.frozenAt).getTime();
    if (Number.isFinite(startMs)) {
      expiresTime = startMs + Number(user.freezeDurationMinutes) * 60 * 1000;
      user.freezeExpiresAt = new Date(expiresTime).toISOString();
    }
  }

  if (!Number.isFinite(expiresTime) || Date.now() >= expiresTime) {
    user.isFrozen = false;
    user.frozenAt = null;
    user.freezeDurationMinutes = null;
    user.freezeExpiresAt = null;
    user.freezeReason = null;
    return true;
  }
  return false;
}

interface Temp2FALogin {
  userId: string;
  email: string;
  name: string;
  displayId?: string;
  isAdmin: boolean;
  rememberDevice?: boolean;
  expiresAt: number;
}
const temp2FALoginStore = new Map<string, Temp2FALogin>();
const pending2FASetup = new Map<string, { secret: string; backupCodes: string[]; expiresAt: number }>();

// Periodic cleanup of expired 2FA temp states
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of temp2FALoginStore.entries()) {
    if (v.expiresAt < now) temp2FALoginStore.delete(k);
  }
  for (const [k, v] of pending2FASetup.entries()) {
    if (v.expiresAt < now) pending2FASetup.delete(k);
  }
}, 60 * 1000);

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
  country?: string;
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
const AGENCY_NOTIFICATIONS_FILE = path.resolve(DATA_DIR, 'agency_notifications.json');
const USER_NOTIFICATIONS_FILE = path.resolve(DATA_DIR, 'user_notifications.json');
const DELETED_AGENTS_FILE = path.resolve(DATA_DIR, 'deleted_agents.json');
const DELETED_USERS_FILE = path.resolve(DATA_DIR, 'deleted_users.json');
const FEEDBACK_REPORTS_FILE = path.resolve(DATA_DIR, 'feedback_reports.json');
const PASSWORD_RESET_REQUESTS_FILE = path.resolve(DATA_DIR, 'password_reset_requests.json');
const VERIFICATION_REQUESTS_FILE = path.resolve(DATA_DIR, 'verification_requests.json');
const APP_SETTINGS_FILE = path.resolve(DATA_DIR, 'app_settings.json');
const BLOCKED_USERS_FILE = path.resolve(DATA_DIR, 'blocked_users.json');
const BOT_REFERRALS_FILE = path.resolve(DATA_DIR, 'bot_referrals.json');
const GAMES_SETTINGS_FILE = path.resolve(DATA_DIR, 'games_settings.json');
const GAMES_ALGO_STATE_FILE = path.resolve(DATA_DIR, 'games_algo_state.json');

export function getVerifiedIdentifierSet(usersList?: StoredUser[]): Set<string> {
  const verifiedSet = new Set<string>();
  const list = usersList || getStoredUsers();
  for (const u of list) {
    if (u.isVerified) {
      if (u.id) verifiedSet.add(String(u.id).trim().toLowerCase());
      if (u.displayId) verifiedSet.add(String(u.displayId).trim().toLowerCase());
      if (u.email) verifiedSet.add(String(u.email).trim().toLowerCase());
    }
  }
  return verifiedSet;
}

export function isUserIdentifierVerified(identifier?: string | null, verifiedSet?: Set<string>): boolean {
  if (!identifier) return false;
  const set = verifiedSet || getVerifiedIdentifierSet();
  return set.has(String(identifier).trim().toLowerCase());
}

export interface StoredBlockedUser {
  id: string;
  blockerId: string;
  blockerDisplayId?: string;
  blockedId: string;
  blockedDisplayId?: string;
  blockedName?: string;
  blockedAvatar?: string;
  blockedAt: string;
}

export function getStoredBlockedUsers(): StoredBlockedUser[] {
  try {
    if (fs.existsSync(BLOCKED_USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(BLOCKED_USERS_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (err) {
    console.error('Error reading blocked users file:', err);
  }
  return [];
}

export function saveStoredBlockedUsers(blocked: StoredBlockedUser[]) {
  try {
    fs.writeFileSync(BLOCKED_USERS_FILE, JSON.stringify(blocked, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving blocked users file:', err);
  }
}

export async function isUserBlockedPair(userAId: string, userBId: string): Promise<{
  isBlocked: boolean;
  blockedByA: boolean;
  blockedByB: boolean;
}> {
  if (!userAId || !userBId) {
    return { isBlocked: false, blockedByA: false, blockedByB: false };
  }
  try {
    const setA = await getUserIdentifierSet(userAId);
    const setB = await getUserIdentifierSet(userBId);
    const blockedList = getStoredBlockedUsers();
    let blockedByA = false;
    let blockedByB = false;

    for (const item of blockedList) {
      const blockerIds = [item.blockerId, item.blockerDisplayId].filter(Boolean) as string[];
      const blockedIds = [item.blockedId, item.blockedDisplayId].filter(Boolean) as string[];

      const blockerIsA = blockerIds.some((k) => setA.has(k) || setA.has(k.toLowerCase()));
      const blockedIsB = blockedIds.some((k) => setB.has(k) || setB.has(k.toLowerCase()));
      if (blockerIsA && blockedIsB) {
        blockedByA = true;
      }

      const blockerIsB = blockerIds.some((k) => setB.has(k) || setB.has(k.toLowerCase()));
      const blockedIsA = blockedIds.some((k) => setA.has(k) || setA.has(k.toLowerCase()));
      if (blockerIsB && blockedIsA) {
        blockedByB = true;
      }
    }

    return {
      isBlocked: blockedByA || blockedByB,
      blockedByA,
      blockedByB,
    };
  } catch (err) {
    console.error('Error checking block status:', err);
    return { isBlocked: false, blockedByA: false, blockedByB: false };
  }
}

const DEFAULT_INITIAL_BIO = 'مرحباً أنا مستخدم جديد في Soul-X و لم أقم بتعيين الوصف حتى الأن';
const DEFAULT_INITIAL_BIO_EN = "Hello, I am a new user in Soul-X and haven't set my bio yet.";

export interface AppSettings {
  defaultBio: string;
  defaultBioEn: string;
  gamesEnabled: boolean;
  storeEnabled: boolean;
  updatedAt?: string;
}

export function getAppSettings(): AppSettings {
  try {
    if (fs.existsSync(APP_SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(APP_SETTINGS_FILE, 'utf-8'));
      return {
        defaultBio: (data.defaultBio && typeof data.defaultBio === 'string' && data.defaultBio.trim())
          ? data.defaultBio.trim()
          : DEFAULT_INITIAL_BIO,
        defaultBioEn: data.defaultBioEn || DEFAULT_INITIAL_BIO_EN,
        gamesEnabled: data.gamesEnabled !== false,
        storeEnabled: data.storeEnabled !== false,
        updatedAt: data.updatedAt,
      };
    }
  } catch (e) {
    console.warn('Failed to read app_settings.json:', e);
  }
  return {
    defaultBio: DEFAULT_INITIAL_BIO,
    defaultBioEn: DEFAULT_INITIAL_BIO_EN,
    gamesEnabled: true,
    storeEnabled: true,
  };
}

async function saveAppSettingsToNeon(settings: AppSettings): Promise<void> {
  if (!neonPool) return;
  try {
    await neonPool.query(
      `INSERT INTO app_settings (id, default_bio, default_bio_en, games_enabled, store_enabled, updated_at)
       VALUES ('default', $1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         default_bio = EXCLUDED.default_bio,
         default_bio_en = EXCLUDED.default_bio_en,
         games_enabled = EXCLUDED.games_enabled,
         store_enabled = EXCLUDED.store_enabled,
         updated_at = EXCLUDED.updated_at`,
      [
        settings.defaultBio,
        settings.defaultBioEn,
        settings.gamesEnabled,
        settings.storeEnabled,
        settings.updatedAt || new Date().toISOString(),
      ]
    );
  } catch (err: any) {
    console.warn('Neon saveAppSettings warning:', err?.message || err);
  }
}

export async function syncAppSettingsWithNeon(): Promise<void> {
  if (!neonPool) return;
  try {
    const resDb: any = await withTimeout(
      neonPool.query("SELECT * FROM app_settings WHERE id = 'default' LIMIT 1"),
      4000
    );
    if (resDb?.rows?.[0]) {
      const row = resDb.rows[0];
      const current = getAppSettings();
      const synced: AppSettings = {
        defaultBio:
          row.default_bio && typeof row.default_bio === 'string' && row.default_bio.trim()
            ? row.default_bio.trim()
            : current.defaultBio,
        defaultBioEn: row.default_bio_en || current.defaultBioEn,
        gamesEnabled: row.games_enabled !== false,
        storeEnabled: row.store_enabled !== false,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      };
      fs.writeFileSync(APP_SETTINGS_FILE, JSON.stringify(synced, null, 2), 'utf-8');
    } else {
      await saveAppSettingsToNeon(getAppSettings());
    }
  } catch (err: any) {
    console.warn('Neon syncAppSettings warning:', err?.message || err);
  }
}

export function saveAppSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getAppSettings();
  const data: AppSettings = {
    defaultBio:
      settings.defaultBio !== undefined && typeof settings.defaultBio === 'string' && settings.defaultBio.trim()
        ? settings.defaultBio.trim()
        : current.defaultBio,
    defaultBioEn:
      settings.defaultBioEn !== undefined && typeof settings.defaultBioEn === 'string' && settings.defaultBioEn.trim()
        ? settings.defaultBioEn.trim()
        : current.defaultBioEn,
    gamesEnabled:
      typeof settings.gamesEnabled === 'boolean' ? settings.gamesEnabled : current.gamesEnabled,
    storeEnabled:
      typeof settings.storeEnabled === 'boolean' ? settings.storeEnabled : current.storeEnabled,
    updatedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(APP_SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save app_settings.json:', e);
  }
  saveAppSettingsToNeon(data).catch(() => {});
  return data;
}

export function getDefaultUserBio(): string {
  return getAppSettings().defaultBio;
}

// ==========================================
// Games Settings & Smart Algorithmic Profit-Loss Engine
// ==========================================
export type GameAlgorithmMode =
  | 'smart_cycle'      // الترتيب الذكي: ربح قليل وخسارة أكثر بدورات متغيرة
  | 'custom_sequence'  // دورة مخصصة: تحديد عدد مرات الربح مقابل الخسارة
  | 'house_edge'       // سحب تدريجي وأفضلية مستمرة للمنصة
  | 'classic_level';   // المستوى التقليدي 0-10

export type CycleOrderPattern = 'smart_shuffle' | 'win_first' | 'loss_first';

export interface SmartAlgorithmSettings {
  algorithmMode: GameAlgorithmMode;
  targetWinRatePercent: number;    // 0..85
  maxAllowedMultiplier: number;    // 1..50
  smallWinBiasPercent: number;     // 0..100
  cycleWinsCount: number;          // 0..5
  cycleLossesCount: number;        // 1..15
  cycleOrderPattern: CycleOrderPattern;
  maxConsecutiveWins: number;      // 1..5
  highBetThreshold: number;        // 500..1000000
  highBetLossBoostPercent: number; // 0..100
  sessionProfitCapCoins: number;   // 0 = disabled, max cumulative net profit before forced recovery
  lossRecoveryIntensity: number;   // 0..100
}

export type AiStrategyProfile =
  | 'smart_retention'
  | 'aggressive_drain'
  | 'high_engagement'
  | 'fortress_protection'
  | 'custom';

export interface AiGameMonitorConfig {
  enabled: boolean;
  aiVersion: string;
  strategyProfile: AiStrategyProfile;
  bigWinMultiplierTrigger: number;      // >= multiplier counts as a big win (default 3.5)
  bigWinBalanceGainPercent: number;     // >= % gain above baseline counts as big win (default 25)
  postBigWinDrainRounds: number;        // number of rounds to focus on losses after big win (default 8)
  postBigWinLossFocusPercent: number;   // % loss focus after big win (default 80)
  heavyLossStreakTrigger: number;       // consecutive losses to trigger comeback eligibility (default 5)
  heavyLossDrawdownPercent: number;     // % balance drop from baseline to trigger comeback eligibility (default 45)
  comebackMinPercent: number;           // min % of initial baseline balance granted on comeback (default 20)
  comebackMaxPercent: number;           // max % of initial baseline balance granted on comeback (default 70)
  comebackTriggerChancePercent: number; // occasional chance % to trigger comeback (default 38)
  comebackCooldownRounds: number;       // minimum rounds between comebacks (default 7)
  nearMissTeaserPercent: number;        // % chance to give anti-boredom small win/near-win feeling (default 32)
  antiBoredomSensitivity: number;       // 0..100 boredom detection sensitivity (default 65)
  logicalHitIntervalRounds: number;     // rounds before a logical med-big hit becomes eligible (default 12)
  logicalHitMinMultiplier: number;      // min multiplier for logical med-big hit (default 2.2)
  logicalHitMaxMultiplier: number;      // max multiplier for logical med-big hit (default 5.5)
  platformProtectionStrength: number;   // 0..100 platform net profit shield strength (default 80)
  evolutionNotes: string;
  lastEvolvedAt?: string;
}

export interface GameMaintenanceEntry {
  enabled: boolean;
  reasonAr: string;
  reasonEn: string;
  updatedAt: string;
}

export const DEFAULT_SMART_ALGORITHM: SmartAlgorithmSettings = {
  algorithmMode: 'smart_cycle',
  targetWinRatePercent: 25,
  maxAllowedMultiplier: 3,
  smallWinBiasPercent: 85,
  cycleWinsCount: 1,
  cycleLossesCount: 3,
  cycleOrderPattern: 'smart_shuffle',
  maxConsecutiveWins: 1,
  highBetThreshold: 10000,
  highBetLossBoostPercent: 75,
  sessionProfitCapCoins: 25000,
  lossRecoveryIntensity: 75,
};

export const DEFAULT_AI_GAME_MONITOR: AiGameMonitorConfig = {
  enabled: true,
  aiVersion: '2.0',
  strategyProfile: 'smart_retention',
  bigWinMultiplierTrigger: 3.5,
  bigWinBalanceGainPercent: 25,
  postBigWinDrainRounds: 8,
  postBigWinLossFocusPercent: 80,
  heavyLossStreakTrigger: 5,
  heavyLossDrawdownPercent: 45,
  comebackMinPercent: 20,
  comebackMaxPercent: 70,
  comebackTriggerChancePercent: 38,
  comebackCooldownRounds: 7,
  nearMissTeaserPercent: 32,
  antiBoredomSensitivity: 65,
  logicalHitIntervalRounds: 12,
  logicalHitMinMultiplier: 2.2,
  logicalHitMaxMultiplier: 5.5,
  platformProtectionStrength: 80,
  evolutionNotes: 'النموذج الافتراضي: مراقبة ذكية للاستنزاف بعد الربح الكبير وتعويض محسوب 20%–70% عند الخسارة المتكررة مع حماية المنصة.',
  lastEvolvedAt: undefined,
};

export const AI_STRATEGY_PRESETS: Record<Exclude<AiStrategyProfile, 'custom'>, Partial<AiGameMonitorConfig>> = {
  smart_retention: {
    bigWinMultiplierTrigger: 3.5,
    bigWinBalanceGainPercent: 25,
    postBigWinDrainRounds: 8,
    postBigWinLossFocusPercent: 80,
    heavyLossStreakTrigger: 5,
    heavyLossDrawdownPercent: 45,
    comebackMinPercent: 20,
    comebackMaxPercent: 70,
    comebackTriggerChancePercent: 38,
    comebackCooldownRounds: 7,
    nearMissTeaserPercent: 32,
    antiBoredomSensitivity: 65,
    logicalHitIntervalRounds: 12,
    logicalHitMinMultiplier: 2.2,
    logicalHitMaxMultiplier: 5.5,
    platformProtectionStrength: 80,
  },
  aggressive_drain: {
    bigWinMultiplierTrigger: 2.5,
    bigWinBalanceGainPercent: 15,
    postBigWinDrainRounds: 12,
    postBigWinLossFocusPercent: 88,
    heavyLossStreakTrigger: 6,
    heavyLossDrawdownPercent: 55,
    comebackMinPercent: 20,
    comebackMaxPercent: 45,
    comebackTriggerChancePercent: 26,
    comebackCooldownRounds: 10,
    nearMissTeaserPercent: 22,
    antiBoredomSensitivity: 55,
    logicalHitIntervalRounds: 16,
    logicalHitMinMultiplier: 1.8,
    logicalHitMaxMultiplier: 3.5,
    platformProtectionStrength: 92,
  },
  high_engagement: {
    bigWinMultiplierTrigger: 4.0,
    bigWinBalanceGainPercent: 35,
    postBigWinDrainRounds: 6,
    postBigWinLossFocusPercent: 72,
    heavyLossStreakTrigger: 4,
    heavyLossDrawdownPercent: 38,
    comebackMinPercent: 25,
    comebackMaxPercent: 70,
    comebackTriggerChancePercent: 48,
    comebackCooldownRounds: 5,
    nearMissTeaserPercent: 45,
    antiBoredomSensitivity: 80,
    logicalHitIntervalRounds: 9,
    logicalHitMinMultiplier: 2.5,
    logicalHitMaxMultiplier: 7.0,
    platformProtectionStrength: 68,
  },
  fortress_protection: {
    bigWinMultiplierTrigger: 2.0,
    bigWinBalanceGainPercent: 10,
    postBigWinDrainRounds: 14,
    postBigWinLossFocusPercent: 92,
    heavyLossStreakTrigger: 7,
    heavyLossDrawdownPercent: 60,
    comebackMinPercent: 20,
    comebackMaxPercent: 35,
    comebackTriggerChancePercent: 20,
    comebackCooldownRounds: 12,
    nearMissTeaserPercent: 18,
    antiBoredomSensitivity: 45,
    logicalHitIntervalRounds: 20,
    logicalHitMinMultiplier: 1.6,
    logicalHitMaxMultiplier: 2.8,
    platformProtectionStrength: 98,
  },
};

export interface GamesSettings {
  plinkoProfitLevel: number; // 0 to 10
  minesProfitLevel: number; // 0 to 10
  diceProfitLevel: number; // 0 to 10
  olympusProfitLevel: number; // 0 to 10
  boxesProfitLevel: number; // 0 to 10
  winterSlotsProfitLevel: number; // 0 to 10
  absoluteStopProfit: boolean;
  maintenanceGames: Record<string, GameMaintenanceEntry>;
  algorithm: SmartAlgorithmSettings;
  aiMonitor: AiGameMonitorConfig;
  updatedAt: string;
}

export function normalizeAiGameMonitor(raw: unknown): AiGameMonitorConfig {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const validProfiles: AiStrategyProfile[] = [
    'smart_retention',
    'aggressive_drain',
    'high_engagement',
    'fortress_protection',
    'custom',
  ];
  const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  };
  const clampNum = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n * 100) / 100));
  };

  const cMin = clampInt(src.comebackMinPercent, 5, 80, DEFAULT_AI_GAME_MONITOR.comebackMinPercent);
  const cMaxRaw = clampInt(src.comebackMaxPercent, 10, 95, DEFAULT_AI_GAME_MONITOR.comebackMaxPercent);
  const cMax = Math.max(cMin, cMaxRaw);

  const lMin = clampNum(src.logicalHitMinMultiplier, 1.2, 20, DEFAULT_AI_GAME_MONITOR.logicalHitMinMultiplier);
  const lMaxRaw = clampNum(src.logicalHitMaxMultiplier, 1.5, 50, DEFAULT_AI_GAME_MONITOR.logicalHitMaxMultiplier);
  const lMax = Math.max(lMin, lMaxRaw);

  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : DEFAULT_AI_GAME_MONITOR.enabled,
    aiVersion: typeof src.aiVersion === 'string' && src.aiVersion.trim() ? src.aiVersion.trim() : DEFAULT_AI_GAME_MONITOR.aiVersion,
    strategyProfile: validProfiles.includes(src.strategyProfile as AiStrategyProfile)
      ? (src.strategyProfile as AiStrategyProfile)
      : DEFAULT_AI_GAME_MONITOR.strategyProfile,
    bigWinMultiplierTrigger: clampNum(src.bigWinMultiplierTrigger, 1.5, 50, DEFAULT_AI_GAME_MONITOR.bigWinMultiplierTrigger),
    bigWinBalanceGainPercent: clampInt(src.bigWinBalanceGainPercent, 5, 200, DEFAULT_AI_GAME_MONITOR.bigWinBalanceGainPercent),
    postBigWinDrainRounds: clampInt(src.postBigWinDrainRounds, 1, 40, DEFAULT_AI_GAME_MONITOR.postBigWinDrainRounds),
    postBigWinLossFocusPercent: clampInt(src.postBigWinLossFocusPercent, 40, 98, DEFAULT_AI_GAME_MONITOR.postBigWinLossFocusPercent),
    heavyLossStreakTrigger: clampInt(src.heavyLossStreakTrigger, 2, 20, DEFAULT_AI_GAME_MONITOR.heavyLossStreakTrigger),
    heavyLossDrawdownPercent: clampInt(src.heavyLossDrawdownPercent, 15, 90, DEFAULT_AI_GAME_MONITOR.heavyLossDrawdownPercent),
    comebackMinPercent: cMin,
    comebackMaxPercent: cMax,
    comebackTriggerChancePercent: clampInt(src.comebackTriggerChancePercent, 0, 100, DEFAULT_AI_GAME_MONITOR.comebackTriggerChancePercent),
    comebackCooldownRounds: clampInt(src.comebackCooldownRounds, 1, 30, DEFAULT_AI_GAME_MONITOR.comebackCooldownRounds),
    nearMissTeaserPercent: clampInt(src.nearMissTeaserPercent, 0, 90, DEFAULT_AI_GAME_MONITOR.nearMissTeaserPercent),
    antiBoredomSensitivity: clampInt(src.antiBoredomSensitivity, 0, 100, DEFAULT_AI_GAME_MONITOR.antiBoredomSensitivity),
    logicalHitIntervalRounds: clampInt(src.logicalHitIntervalRounds, 3, 50, DEFAULT_AI_GAME_MONITOR.logicalHitIntervalRounds),
    logicalHitMinMultiplier: lMin,
    logicalHitMaxMultiplier: lMax,
    platformProtectionStrength: clampInt(src.platformProtectionStrength, 0, 100, DEFAULT_AI_GAME_MONITOR.platformProtectionStrength),
    evolutionNotes: typeof src.evolutionNotes === 'string' && src.evolutionNotes.trim()
      ? src.evolutionNotes.trim()
      : DEFAULT_AI_GAME_MONITOR.evolutionNotes,
    lastEvolvedAt: typeof src.lastEvolvedAt === 'string' ? src.lastEvolvedAt : undefined,
  };
}

export function normalizeMaintenanceGames(raw: unknown): Record<string, GameMaintenanceEntry> {
  const result: Record<string, GameMaintenanceEntry> = {};
  if (!raw || typeof raw !== 'object') return result;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const cleanId = String(k || '').trim().toLowerCase();
    if (!cleanId || !v || typeof v !== 'object') continue;
    const entry = v as Record<string, unknown>;
    result[cleanId] = {
      enabled: Boolean(entry.enabled),
      reasonAr:
        typeof entry.reasonAr === 'string' && entry.reasonAr.trim()
          ? entry.reasonAr.trim()
          : 'اللعبة تحت الصيانة والتطوير حالياً، يرجى المحاولة لاحقاً',
      reasonEn:
        typeof entry.reasonEn === 'string' && entry.reasonEn.trim()
          ? entry.reasonEn.trim()
          : 'This game is currently under maintenance for development. Please check back soon.',
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : new Date().toISOString(),
    };
  }
  return result;
}

export function normalizeSmartAlgorithm(raw: unknown): SmartAlgorithmSettings {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const validModes: GameAlgorithmMode[] = ['smart_cycle', 'custom_sequence', 'house_edge', 'classic_level'];
  const validPatterns: CycleOrderPattern[] = ['smart_shuffle', 'win_first', 'loss_first'];

  const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  };
  const clampNum = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n * 100) / 100));
  };

  return {
    algorithmMode: validModes.includes(src.algorithmMode as GameAlgorithmMode)
      ? (src.algorithmMode as GameAlgorithmMode)
      : DEFAULT_SMART_ALGORITHM.algorithmMode,
    targetWinRatePercent: clampInt(src.targetWinRatePercent, 0, 85, DEFAULT_SMART_ALGORITHM.targetWinRatePercent),
    maxAllowedMultiplier: clampNum(src.maxAllowedMultiplier, 1, 50, DEFAULT_SMART_ALGORITHM.maxAllowedMultiplier),
    smallWinBiasPercent: clampInt(src.smallWinBiasPercent, 0, 100, DEFAULT_SMART_ALGORITHM.smallWinBiasPercent),
    cycleWinsCount: clampInt(src.cycleWinsCount, 0, 5, DEFAULT_SMART_ALGORITHM.cycleWinsCount),
    cycleLossesCount: clampInt(src.cycleLossesCount, 1, 15, DEFAULT_SMART_ALGORITHM.cycleLossesCount),
    cycleOrderPattern: validPatterns.includes(src.cycleOrderPattern as CycleOrderPattern)
      ? (src.cycleOrderPattern as CycleOrderPattern)
      : DEFAULT_SMART_ALGORITHM.cycleOrderPattern,
    maxConsecutiveWins: clampInt(src.maxConsecutiveWins, 1, 5, DEFAULT_SMART_ALGORITHM.maxConsecutiveWins),
    highBetThreshold: clampInt(src.highBetThreshold, 500, 1000000, DEFAULT_SMART_ALGORITHM.highBetThreshold),
    highBetLossBoostPercent: clampInt(src.highBetLossBoostPercent, 0, 100, DEFAULT_SMART_ALGORITHM.highBetLossBoostPercent),
    sessionProfitCapCoins: clampInt(src.sessionProfitCapCoins, 0, 10000000, DEFAULT_SMART_ALGORITHM.sessionProfitCapCoins),
    lossRecoveryIntensity: clampInt(src.lossRecoveryIntensity, 0, 100, DEFAULT_SMART_ALGORITHM.lossRecoveryIntensity),
  };
}

export const PLINKO_ROWS = 10;
export const PLINKO_MULTIPLIERS = [15, 5, 2, 1.2, 0.5, 0.2, 0.5, 1.2, 2, 5, 15] as const;

export const MINES_GRID_SIZE = 25;
export const MINES_COUNT_OPTIONS = [1, 3, 5, 10, 15, 20] as const;

export const DICE_MIN_TARGET = 2;
export const DICE_MAX_TARGET = 98;

export const BOXES_COUNT = 8;
export const BOXES_MIN_MULTIPLIER = 1;
export const BOXES_MAX_MULTIPLIER = 50;

// Weight distribution across the 11 buckets for each integer profit level 0..10
const PLINKO_WEIGHT_TABLE: number[][] = [
  [0,   0,   0,   0,   0, 100,  0,  0,   0,   0,   0],   // 0: 0% profit (center 0.2x slot only)
  [0,   0,   1,   4,  30, 40, 30,  4,   1,   0,   0],   // 1: very low profit
  [0,   1,   2,   7,  28, 34, 28,  7,   2,   1,   0],   // 2: low profit
  [0.5, 1.5, 4,  10,  26, 26, 26, 10,   4,  1.5, 0.5], // 3: modest-low
  [1,   2,   6,  14,  23, 20, 23, 14,   6,   2,   1],   // 4: slightly below even
  [1.5, 3.5, 8,  16,  20, 14, 20, 16,   8,  3.5, 1.5], // 5: balanced
  [2,   5,  11,  18,  17, 10, 17, 18,  11,   5,   2],   // 6: slightly favorable
  [3,   7,  14,  20,  14,  7, 14, 20,  14,   7,   3],   // 7: favorable
  [4,  10,  18,  21,  10,  5, 10, 21,  18,  10,   4],   // 8: high profit
  [6,  13,  22,  21,   6,  3,  6, 21,  22,  13,   6],   // 9: very high profit
  [8,  16,  26,  20,   4,  2,  4, 20,  26,  16,   8],   // 10: maximum profit
];

function clampProfitLevel(val: unknown): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return 5;
  return Math.max(0, Math.min(10, Math.round(num * 100) / 100));
}

export function getGamesSettings(): GamesSettings {
  try {
    if (fs.existsSync(GAMES_SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(GAMES_SETTINGS_FILE, 'utf-8'));
      const plinko = clampProfitLevel(parsed?.plinkoProfitLevel ?? 5);
      const mines = clampProfitLevel(parsed?.minesProfitLevel ?? plinko);
      const dice = clampProfitLevel(parsed?.diceProfitLevel ?? plinko);
      const olympus = clampProfitLevel(parsed?.olympusProfitLevel ?? plinko);
      const boxes = clampProfitLevel(parsed?.boxesProfitLevel ?? plinko);
      const winterSlots = clampProfitLevel(parsed?.winterSlotsProfitLevel ?? plinko);
      const algorithm = normalizeSmartAlgorithm(parsed?.algorithm);
      const aiMonitor = normalizeAiGameMonitor(parsed?.aiMonitor);
      const maintenanceGames = normalizeMaintenanceGames(parsed?.maintenanceGames);
      return {
        plinkoProfitLevel: plinko,
        minesProfitLevel: mines,
        diceProfitLevel: dice,
        olympusProfitLevel: olympus,
        boxesProfitLevel: boxes,
        winterSlotsProfitLevel: winterSlots,
        absoluteStopProfit: Boolean(parsed?.absoluteStopProfit),
        maintenanceGames,
        algorithm,
        aiMonitor,
        updatedAt: parsed?.updatedAt || new Date().toISOString(),
      };
    }
  } catch (e) {
    console.warn('Failed to read games_settings.json:', e);
  }
  return {
    plinkoProfitLevel: 5,
    minesProfitLevel: 5,
    diceProfitLevel: 5,
    olympusProfitLevel: 5,
    boxesProfitLevel: 5,
    winterSlotsProfitLevel: 5,
    absoluteStopProfit: false,
    maintenanceGames: {},
    algorithm: { ...DEFAULT_SMART_ALGORITHM },
    aiMonitor: { ...DEFAULT_AI_GAME_MONITOR },
    updatedAt: new Date().toISOString(),
  };
}

export function getGameMaintenanceStatus(gameId: string): GameMaintenanceEntry {
  const settings = getGamesSettings();
  const key = String(gameId || '').trim().toLowerCase();
  const entry = settings.maintenanceGames?.[key];
  if (entry && entry.enabled) {
    return entry;
  }
  return {
    enabled: false,
    reasonAr: 'اللعبة تحت الصيانة والتطوير حالياً، يرجى المحاولة لاحقاً',
    reasonEn: 'This game is currently under maintenance for development. Please check back soon.',
    updatedAt: settings.updatedAt,
  };
}

async function saveGamesSettingsToNeon(settings: GamesSettings): Promise<void> {
  if (!neonPool) return;
  try {
    const algoWithExtras = {
      ...(settings.algorithm || DEFAULT_SMART_ALGORITHM),
      __extras: {
        absoluteStopProfit: Boolean(settings.absoluteStopProfit),
        maintenanceGames: settings.maintenanceGames || {},
        aiMonitor: settings.aiMonitor || DEFAULT_AI_GAME_MONITOR,
      },
    };
    await neonPool.query(
      `INSERT INTO games_settings (id, plinko_profit_level, mines_profit_level, dice_profit_level, olympus_profit_level, boxes_profit_level, winter_slots_profit_level, algorithm_config, updated_at)
       VALUES ('default', $1, $2, $3, $4, $5, $6, $7::jsonb, $8)
       ON CONFLICT (id) DO UPDATE SET
         plinko_profit_level = EXCLUDED.plinko_profit_level,
         mines_profit_level = EXCLUDED.mines_profit_level,
         dice_profit_level = EXCLUDED.dice_profit_level,
         olympus_profit_level = EXCLUDED.olympus_profit_level,
         boxes_profit_level = EXCLUDED.boxes_profit_level,
         winter_slots_profit_level = EXCLUDED.winter_slots_profit_level,
         algorithm_config = EXCLUDED.algorithm_config,
         updated_at = EXCLUDED.updated_at`,
      [
        settings.plinkoProfitLevel,
        settings.minesProfitLevel,
        settings.diceProfitLevel,
        settings.olympusProfitLevel,
        settings.boxesProfitLevel,
        settings.winterSlotsProfitLevel,
        JSON.stringify(algoWithExtras),
        settings.updatedAt,
      ]
    );
  } catch (err: any) {
    console.warn('Neon saveGamesSettings warning:', err?.message || err);
  }
}

export function saveGamesSettings(next: Partial<GamesSettings>): GamesSettings {
  const current = getGamesSettings();
  const updated: GamesSettings = {
    plinkoProfitLevel:
      next.plinkoProfitLevel !== undefined
        ? clampProfitLevel(next.plinkoProfitLevel)
        : current.plinkoProfitLevel,
    minesProfitLevel:
      next.minesProfitLevel !== undefined
        ? clampProfitLevel(next.minesProfitLevel)
        : current.minesProfitLevel,
    diceProfitLevel:
      next.diceProfitLevel !== undefined
        ? clampProfitLevel(next.diceProfitLevel)
        : current.diceProfitLevel,
    olympusProfitLevel:
      next.olympusProfitLevel !== undefined
        ? clampProfitLevel(next.olympusProfitLevel)
        : current.olympusProfitLevel,
    boxesProfitLevel:
      next.boxesProfitLevel !== undefined
        ? clampProfitLevel(next.boxesProfitLevel)
        : current.boxesProfitLevel,
    winterSlotsProfitLevel:
      next.winterSlotsProfitLevel !== undefined
        ? clampProfitLevel(next.winterSlotsProfitLevel)
        : current.winterSlotsProfitLevel,
    absoluteStopProfit:
      typeof next.absoluteStopProfit === 'boolean'
        ? next.absoluteStopProfit
        : current.absoluteStopProfit,
    maintenanceGames:
      next.maintenanceGames !== undefined
        ? normalizeMaintenanceGames({ ...current.maintenanceGames, ...next.maintenanceGames })
        : current.maintenanceGames,
    algorithm:
      next.algorithm !== undefined
        ? normalizeSmartAlgorithm({ ...current.algorithm, ...next.algorithm })
        : current.algorithm,
    aiMonitor:
      next.aiMonitor !== undefined
        ? normalizeAiGameMonitor({ ...current.aiMonitor, ...next.aiMonitor })
        : current.aiMonitor,
    updatedAt: new Date().toISOString(),
  };
  try {
    fs.writeFileSync(GAMES_SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save games_settings.json:', e);
  }
  saveGamesSettingsToNeon(updated).catch(() => {});
  return updated;
}

export async function syncGamesSettingsWithNeon(): Promise<void> {
  if (!neonPool) return;
  try {
    const localSettings = getGamesSettings();
    const localHasFile = fs.existsSync(GAMES_SETTINGS_FILE);
    const localUpdatedMs = localHasFile && localSettings.updatedAt ? new Date(localSettings.updatedAt).getTime() : 0;

    const resDb: any = await withTimeout(
      neonPool.query("SELECT * FROM games_settings WHERE id = 'default' LIMIT 1"),
      4000
    );
    if (resDb?.rows?.[0]) {
      const row = resDb.rows[0];
      const dbUpdatedMs = row.updated_at ? new Date(row.updated_at).getTime() : 0;
      if (localHasFile && localUpdatedMs > dbUpdatedMs) {
        await saveGamesSettingsToNeon(localSettings);
        return;
      }
      const plinko = clampProfitLevel(row.plinko_profit_level ?? 5);
      const mines = clampProfitLevel(row.mines_profit_level ?? plinko);
      const dice = clampProfitLevel(row.dice_profit_level ?? plinko);
      const olympus = clampProfitLevel(row.olympus_profit_level ?? plinko);
      const boxes = clampProfitLevel(row.boxes_profit_level ?? plinko);
      const winterSlots = clampProfitLevel(row.winter_slots_profit_level ?? plinko);
      const rawAlgo =
        row.algorithm_config && typeof row.algorithm_config === 'object' && Object.keys(row.algorithm_config).length > 0
          ? (row.algorithm_config as Record<string, unknown>)
          : (localSettings.algorithm as unknown as Record<string, unknown>);
      const extras = rawAlgo.__extras && typeof rawAlgo.__extras === 'object'
        ? (rawAlgo.__extras as Record<string, unknown>)
        : {};
      const synced: GamesSettings = {
        plinkoProfitLevel: plinko,
        minesProfitLevel: mines,
        diceProfitLevel: dice,
        olympusProfitLevel: olympus,
        boxesProfitLevel: boxes,
        winterSlotsProfitLevel: winterSlots,
        absoluteStopProfit:
          typeof extras.absoluteStopProfit === 'boolean'
            ? extras.absoluteStopProfit
            : localSettings.absoluteStopProfit,
        maintenanceGames:
          extras.maintenanceGames !== undefined
            ? normalizeMaintenanceGames(extras.maintenanceGames)
            : localSettings.maintenanceGames,
        algorithm: normalizeSmartAlgorithm(rawAlgo),
        aiMonitor:
          extras.aiMonitor !== undefined
            ? normalizeAiGameMonitor(extras.aiMonitor)
            : localSettings.aiMonitor,
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      };
      fs.writeFileSync(GAMES_SETTINGS_FILE, JSON.stringify(synced, null, 2), 'utf-8');
    } else {
      await saveGamesSettingsToNeon(localSettings);
    }
  } catch (err: any) {
    console.warn('Neon syncGamesSettings warning:', err?.message || err);
  }
}

// ------------------------------------------
// Smart Player Cycle + AI Behavioral Monitor State & Real Telemetry
// ------------------------------------------
interface PlayerGameCycleState {
  cyclePlan: ('win' | 'loss')[];
  cycleCursor: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  rollingNetProfit: number;
  totalRounds: number;
  totalWins: number;
  totalLosses: number;
  lastPlayedAt: string;
  // AI Player Behavioral Monitoring fields
  initialBaselineCoins?: number;
  peakBalanceCoins?: number;
  lastKnownBalanceCoins?: number;
  sessionWageredCoins?: number;
  sessionPayoutCoins?: number;
  sessionNetProfit?: number;
  postBigWinDrainRemaining?: number;
  roundsSinceBigWin?: number;
  roundsSinceComeback?: number;
  roundsSinceLogicalHit?: number;
  boredomScore?: number;
  lastBetAmount?: number;
  lastAiPhase?: string;
  lastOutcomeReason?: string;
  sessionStartedAt?: string;
}

export interface RecentGameOutcomeLog {
  game: string;
  betAmount: number;
  payout: number;
  multiplier: number;
  won: boolean;
  reason: string;
  timestamp: string;
}

export interface GamesAlgorithmTelemetry {
  totalRounds: number;
  totalWins: number;
  totalLosses: number;
  totalWageredCoins: number;
  totalPayoutCoins: number;
  houseNetProfitCoins: number;
  recentOutcomes: RecentGameOutcomeLog[];
  updatedAt: string;
}

interface PersistedAlgoRuntimeState {
  players: Record<string, PlayerGameCycleState>;
  telemetry: GamesAlgorithmTelemetry;
}

let algoRuntimeStateCache: PersistedAlgoRuntimeState | null = null;
let saveAlgoStateTimer: ReturnType<typeof setTimeout> | null = null;

function createEmptyTelemetry(): GamesAlgorithmTelemetry {
  return {
    totalRounds: 0,
    totalWins: 0,
    totalLosses: 0,
    totalWageredCoins: 0,
    totalPayoutCoins: 0,
    houseNetProfitCoins: 0,
    recentOutcomes: [],
    updatedAt: new Date().toISOString(),
  };
}

function getAlgoRuntimeState(): PersistedAlgoRuntimeState {
  if (algoRuntimeStateCache) return algoRuntimeStateCache;
  try {
    if (fs.existsSync(GAMES_ALGO_STATE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(GAMES_ALGO_STATE_FILE, 'utf-8'));
      algoRuntimeStateCache = {
        players: parsed?.players && typeof parsed.players === 'object' ? parsed.players : {},
        telemetry: {
          ...createEmptyTelemetry(),
          ...(parsed?.telemetry || {}),
          recentOutcomes: Array.isArray(parsed?.telemetry?.recentOutcomes)
            ? parsed.telemetry.recentOutcomes.slice(0, 25)
            : [],
        },
      };
      return algoRuntimeStateCache;
    }
  } catch (e) {
    console.warn('Failed to load games_algo_state.json:', e);
  }
  algoRuntimeStateCache = {
    players: {},
    telemetry: createEmptyTelemetry(),
  };
  return algoRuntimeStateCache;
}

function scheduleSaveAlgoRuntimeState() {
  if (saveAlgoStateTimer) return;
  saveAlgoStateTimer = setTimeout(() => {
    saveAlgoStateTimer = null;
    try {
      const state = getAlgoRuntimeState();
      // Keep recent 400 most active players to bound disk usage
      const entries = Object.entries(state.players);
      if (entries.length > 400) {
        entries.sort((a, b) => (b[1].lastPlayedAt || '').localeCompare(a[1].lastPlayedAt || ''));
        state.players = Object.fromEntries(entries.slice(0, 400));
      }
      fs.writeFileSync(GAMES_ALGO_STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to persist games_algo_state.json:', e);
    }
  }, 400);
}

export function getGamesAlgorithmTelemetry(): GamesAlgorithmTelemetry {
  const t = getAlgoRuntimeState().telemetry;
  return {
    ...t,
    houseNetProfitCoins: Math.round(t.totalWageredCoins - t.totalPayoutCoins),
  };
}

export function resetGamesAlgorithmTelemetry(): GamesAlgorithmTelemetry {
  const state = getAlgoRuntimeState();
  state.telemetry = createEmptyTelemetry();
  state.players = {};
  scheduleSaveAlgoRuntimeState();
  return state.telemetry;
}

function buildSmartCyclePlan(algo: SmartAlgorithmSettings): ('win' | 'loss')[] {
  const wins = Math.max(0, Math.min(5, Math.round(algo.cycleWinsCount)));
  const losses = Math.max(1, Math.min(15, Math.round(algo.cycleLossesCount)));

  if (algo.cycleOrderPattern === 'win_first') {
    return [
      ...Array<'win'>(wins).fill('win'),
      ...Array<'loss'>(losses).fill('loss'),
    ];
  }
  if (algo.cycleOrderPattern === 'loss_first') {
    return [
      ...Array<'loss'>(losses).fill('loss'),
      ...Array<'win'>(wins).fill('win'),
    ];
  }

  // smart_shuffle: distribute wins inside losses cleanly, avoiding consecutive wins when maxConsecutiveWins === 1
  if (wins === 0) {
    return Array<'loss'>(losses).fill('loss');
  }
  if (algo.maxConsecutiveWins <= 1 && losses >= wins) {
    const slots = Array<'win' | 'loss'>(wins + losses).fill('loss');
    const bucketSize = (wins + losses) / wins;
    for (let w = 0; w < wins; w++) {
      const start = Math.floor(w * bucketSize);
      const end = Math.max(start, Math.floor((w + 1) * bucketSize) - 1);
      let pos = start + Math.floor(Math.random() * (end - start + 1));
      if (pos > 0 && slots[pos - 1] === 'win') {
        pos = Math.min(slots.length - 1, pos + 1);
      }
      slots[pos] = 'win';
    }
    return slots;
  }

  const arr: ('win' | 'loss')[] = [
    ...Array<'win'>(wins).fill('win'),
    ...Array<'loss'>(losses).fill('loss'),
  ];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface SmartGameDecision {
  useClassicLevel: boolean;
  allowWin: boolean;
  tier: 'loss' | 'small_win' | 'medium_win';
  maxMultiplierCap: number;
  reason: string;
  forceZeroPayout?: boolean;
  targetMultiplierHint?: number;
  minMultiplierHint?: number;
  nearMissVisual?: boolean;
  aiPhase?: string;
}

function evaluateDecisionOnState(
  state: PlayerGameCycleState,
  betAmount: number,
  profitLevel: number,
  algo: SmartAlgorithmSettings
): SmartGameDecision {
  const level = clampProfitLevel(profitLevel);
  if (level <= 0) {
    return {
      useClassicLevel: false,
      allowWin: false,
      tier: 'loss',
      maxMultiplierCap: 0,
      forceZeroPayout: true,
      aiPhase: 'absolute_stop',
      reason: 'profit_level_zero',
    };
  }

  if (algo.algorithmMode === 'classic_level') {
    return {
      useClassicLevel: true,
      allowWin: true,
      tier: 'medium_win',
      maxMultiplierCap: 50,
      reason: 'classic_level',
    };
  }

  // Determine base schedule intent ('win' or 'loss')
  let scheduledWin = false;
  let baseReason = 'cycle_loss';

  if (algo.algorithmMode === 'house_edge') {
    const levelFactor = 0.45 + (level / 10) * 0.75; // 0.45x at 0 -> 1.2x at 10
    const effectiveProb = Math.max(0, Math.min(0.85, (algo.targetWinRatePercent / 100) * levelFactor));
    scheduledWin = Math.random() < effectiveProb;
    baseReason = scheduledWin ? 'house_edge_win' : 'house_edge_loss';
  } else {
    // smart_cycle or custom_sequence
    const expectedLen = Math.max(1, algo.cycleWinsCount + algo.cycleLossesCount);
    if (!Array.isArray(state.cyclePlan) || state.cyclePlan.length !== expectedLen || state.cycleCursor >= state.cyclePlan.length) {
      state.cyclePlan = buildSmartCyclePlan(algo);
      state.cycleCursor = 0;
    }
    const slot = state.cyclePlan[state.cycleCursor] || 'loss';
    state.cycleCursor += 1;
    scheduledWin = slot === 'win';
    baseReason = scheduledWin ? 'cycle_win' : 'cycle_loss';

    if (scheduledWin && algo.algorithmMode === 'smart_cycle') {
      if (algo.targetWinRatePercent <= 0) {
        scheduledWin = false;
        baseReason = 'win_rate_zero';
      } else {
        const cycleRatio = (algo.cycleWinsCount / expectedLen) * 100;
        const levelScale = Math.max(0.25, Math.min(1.25, (level / 5) * 0.6 + 0.4));
        const throttleProb = Math.min(1, ((algo.targetWinRatePercent / Math.max(1, cycleRatio)) * levelScale));
        if (Math.random() > throttleProb) {
          scheduledWin = false;
          baseReason = 'smart_rate_throttle';
        }
      }
    }
  }

  // Apply smart guardrails on any candidate win
  if (scheduledWin) {
    if (state.consecutiveWins >= algo.maxConsecutiveWins) {
      scheduledWin = false;
      baseReason = 'consecutive_wins_cap';
    } else if (algo.sessionProfitCapCoins > 0 && state.rollingNetProfit >= algo.sessionProfitCapCoins) {
      scheduledWin = false;
      baseReason = 'profit_cap_recovery';
    } else if (betAmount >= algo.highBetThreshold && Math.random() * 100 < algo.highBetLossBoostPercent) {
      scheduledWin = false;
      baseReason = 'high_bet_protection';
    } else if (state.rollingNetProfit > 0 && algo.lossRecoveryIntensity > 0) {
      const suppressChance = (algo.lossRecoveryIntensity / 100) * 0.65;
      if (Math.random() < suppressChance) {
        scheduledWin = false;
        baseReason = 'recovery_drain';
      }
    }
  }

  if (!scheduledWin) {
    return {
      useClassicLevel: false,
      allowWin: false,
      tier: 'loss',
      maxMultiplierCap: 0.5,
      reason: baseReason,
    };
  }

  const isSmallWin = Math.random() * 100 < algo.smallWinBiasPercent;
  const maxCap = Math.max(1, algo.maxAllowedMultiplier);
  const smallCap = maxCap >= 2 ? Math.min(maxCap, 2.5) : maxCap;

  return {
    useClassicLevel: false,
    allowWin: true,
    tier: isSmallWin ? 'small_win' : 'medium_win',
    maxMultiplierCap: isSmallWin ? smallCap : maxCap,
    reason: isSmallWin ? `${baseReason}_small` : baseReason,
  };
}

function refreshPlayerAiBaseline(
  pState: PlayerGameCycleState,
  currentBalanceCoins?: number,
  betAmount = 500
): number {
  const nowMs = Date.now();
  const lastPlayedMs = pState.lastPlayedAt ? new Date(pState.lastPlayedAt).getTime() : 0;
  const sessionExpired = !lastPlayedMs || nowMs - lastPlayedMs > 4 * 60 * 60 * 1000;

  let effectiveBalance =
    typeof currentBalanceCoins === 'number' && Number.isFinite(currentBalanceCoins) && currentBalanceCoins >= 0
      ? currentBalanceCoins
      : typeof pState.lastKnownBalanceCoins === 'number'
      ? pState.lastKnownBalanceCoins
      : betAmount * 5;

  if (sessionExpired || typeof pState.initialBaselineCoins !== 'number' || pState.initialBaselineCoins <= 0) {
    pState.initialBaselineCoins = Math.max(betAmount, Math.round(effectiveBalance));
    pState.peakBalanceCoins = pState.initialBaselineCoins;
    pState.sessionWageredCoins = 0;
    pState.sessionPayoutCoins = 0;
    pState.sessionNetProfit = 0;
    pState.postBigWinDrainRemaining = 0;
    pState.roundsSinceBigWin = 0;
    pState.roundsSinceComeback = 0;
    pState.roundsSinceLogicalHit = 0;
    pState.boredomScore = 0;
    pState.sessionStartedAt = new Date(nowMs).toISOString();
  } else if (
    typeof pState.lastKnownBalanceCoins === 'number' &&
    effectiveBalance > pState.lastKnownBalanceCoins + Math.max(betAmount * 2, pState.initialBaselineCoins * 0.15)
  ) {
    // Player externally recharged/deposited coins -> smoothly raise baseline
    const depositDelta = effectiveBalance - pState.lastKnownBalanceCoins;
    pState.initialBaselineCoins = Math.round(pState.initialBaselineCoins + depositDelta);
  }

  pState.lastKnownBalanceCoins = Math.round(effectiveBalance);
  if ((pState.peakBalanceCoins || 0) < effectiveBalance) {
    pState.peakBalanceCoins = Math.round(effectiveBalance);
  }
  return effectiveBalance;
}

function applyAiMonitorLayer(
  pState: PlayerGameCycleState,
  baseDecision: SmartGameDecision,
  betAmount: number,
  profitLevel: number,
  algo: SmartAlgorithmSettings,
  ai: AiGameMonitorConfig,
  telemetry: GamesAlgorithmTelemetry,
  currentBalanceCoins?: number
): SmartGameDecision {
  const activeBalance = refreshPlayerAiBaseline(pState, currentBalanceCoins, betAmount);
  const baseline = Math.max(betAmount, pState.initialBaselineCoins || activeBalance || betAmount);
  const sessionNet = pState.sessionNetProfit ?? 0;
  const drawdownCoins = Math.max(0, baseline - activeBalance);
  const drawdownPercent = baseline > 0 ? (drawdownCoins / baseline) * 100 : 0;
  const sessionGainPercent = baseline > 0 ? ((activeBalance - baseline) / baseline) * 100 : 0;
  const maxCap = Math.max(1.2, algo.maxAllowedMultiplier);
  const boredom = Math.max(0, Math.min(100, pState.boredomScore ?? 0));
  const shieldStrength = ai.platformProtectionStrength / 100; // 0..1

  // Platform net buffer sanity check
  const houseNet = telemetry.totalWageredCoins - telemetry.totalPayoutCoins;
  const playerIsAhead = sessionNet > 0 || pState.rollingNetProfit > betAmount;

  // 1. Post-Big-Win Smart Drain: focus on losses with controlled small/medium wins
  if (
    (pState.postBigWinDrainRemaining ?? 0) > 0 ||
    sessionGainPercent >= ai.bigWinBalanceGainPercent
  ) {
    if ((pState.postBigWinDrainRemaining ?? 0) <= 0) {
      pState.postBigWinDrainRemaining = Math.max(3, Math.round(ai.postBigWinDrainRounds * 0.7));
    }
    const lossProb = Math.max(0.4, Math.min(0.98, ai.postBigWinLossFocusPercent / 100));
    if (Math.random() < lossProb) {
      const teaseVisual = boredom >= 35 || Math.random() * 100 < ai.nearMissTeaserPercent;
      pState.lastAiPhase = 'post_big_win_drain';
      return {
        useClassicLevel: false,
        allowWin: false,
        tier: 'loss',
        maxMultiplierCap: 0.5,
        nearMissVisual: teaseVisual,
        aiPhase: 'post_big_win_drain',
        reason: 'ai_post_bigwin_loss',
      };
    }
    // Controlled small or occasional medium win so user stays engaged while draining overall
    const giveMedium = Math.random() < 0.28 && maxCap >= 2;
    const controlledCap = giveMedium
      ? Math.min(maxCap, 3.2)
      : Math.min(maxCap, 1.9);
    pState.lastAiPhase = 'post_big_win_drain';
    return {
      useClassicLevel: false,
      allowWin: true,
      tier: giveMedium ? 'medium_win' : 'small_win',
      maxMultiplierCap: Math.max(1.2, controlledCap),
      nearMissVisual: false,
      aiPhase: 'post_big_win_drain',
      reason: giveMedium ? 'ai_post_bigwin_medium' : 'ai_post_bigwin_small',
    };
  }

  // 2. Heavy & Repeated Losses -> Occasional Comeback of 20% to 70% of Initial Baseline Balance
  const heavyLossTriggered =
    pState.consecutiveLosses >= ai.heavyLossStreakTrigger ||
    (drawdownPercent >= ai.heavyLossDrawdownPercent && pState.consecutiveLosses >= 2);
  const comebackReady = (pState.roundsSinceComeback ?? 99) >= ai.comebackCooldownRounds;
  const safeToGrantComeback = sessionNet < 0 || drawdownCoins > betAmount;

  if (heavyLossTriggered && comebackReady && safeToGrantComeback && (pState.totalRounds ?? 0) >= 3) {
    const boredomBonus = boredom >= 70 ? 0.14 : 0;
    const triggerChance = Math.max(0, Math.min(0.95, ai.comebackTriggerChancePercent / 100 + boredomBonus));
    if (Math.random() < triggerChance) {
      const minPct = Math.max(5, Math.min(80, ai.comebackMinPercent));
      const maxPct = Math.max(minPct, Math.min(95, ai.comebackMaxPercent));
      const chosenPct = minPct + Math.random() * (maxPct - minPct);
      let targetCoins = Math.round(baseline * (chosenPct / 100));

      // Platform Protection: keep player overall below or safely near break-even when shield is strong
      const maxSafeReturn = Math.max(
        betAmount * 1.5,
        Math.round((Math.abs(sessionNet) + drawdownCoins * 0.35) * (1.08 - shieldStrength * 0.3))
      );
      if (shieldStrength >= 0.5) {
        targetCoins = Math.min(targetCoins, maxSafeReturn);
      }

      const desiredMult = Math.max(1.5, Math.round((targetCoins / Math.max(1, betAmount)) * 10) / 10);
      const effectiveComebackCap = Math.min(
        50,
        Math.max(maxCap, Math.min(25, Math.ceil(desiredMult * 1.25)))
      );
      const finalTargetMult = Math.min(effectiveComebackCap, desiredMult);

      pState.lastAiPhase = 'comeback_recovery';
      return {
        useClassicLevel: false,
        allowWin: true,
        tier: 'medium_win',
        maxMultiplierCap: effectiveComebackCap,
        targetMultiplierHint: finalTargetMult,
        minMultiplierHint: Math.max(1.3, Math.round(finalTargetMult * 0.72 * 10) / 10),
        aiPhase: 'comeback_recovery',
        reason: `ai_comeback_${Math.round(chosenPct)}pct`,
      };
    }
  }

  // 3. Platform Shield: if player is net ahead and protection is active, throttle back wins intelligently
  if (playerIsAhead && baseDecision.allowWin) {
    const suppressProb = shieldStrength * 0.72;
    if (Math.random() < suppressProb) {
      pState.lastAiPhase = 'platform_shield';
      return {
        useClassicLevel: false,
        allowWin: false,
        tier: 'loss',
        maxMultiplierCap: 0.5,
        nearMissVisual: Math.random() * 100 < ai.nearMissTeaserPercent,
        aiPhase: 'platform_shield',
        reason: 'ai_platform_shield',
      };
    }
    // Cap win small if player is already in profit
    pState.lastAiPhase = 'platform_shield';
    return {
      ...baseDecision,
      useClassicLevel: false,
      tier: 'small_win',
      maxMultiplierCap: Math.min(baseDecision.maxMultiplierCap, 2.0),
      aiPhase: 'platform_shield',
      reason: 'ai_platform_shield_cap',
    };
  }

  // 4. Calculated Logical Medium-to-Big Hit (keeps hope alive & feels logical while house remains net positive)
  const intervalReached = (pState.roundsSinceLogicalHit ?? 0) >= ai.logicalHitIntervalRounds;
  const roomInHouseMargin = houseNet >= -betAmount * 2 || sessionNet <= -betAmount * 2;
  if (intervalReached && roomInHouseMargin && !playerIsAhead) {
    const hitChance = Math.min(0.75, 0.25 + (boredom / 100) * 0.45);
    if (Math.random() < hitChance) {
      const hitMin = Math.max(1.5, ai.logicalHitMinMultiplier);
      const hitMax = Math.max(hitMin, Math.min(50, Math.max(maxCap, ai.logicalHitMaxMultiplier)));
      const targetMult = Math.round((hitMin + Math.random() * (hitMax - hitMin)) * 10) / 10;
      pState.lastAiPhase = 'logical_hit';
      return {
        useClassicLevel: false,
        allowWin: true,
        tier: 'medium_win',
        maxMultiplierCap: Math.max(maxCap, Math.ceil(targetMult * 1.15)),
        targetMultiplierHint: targetMult,
        minMultiplierHint: hitMin,
        aiPhase: 'logical_hit',
        reason: 'ai_logical_hit',
      };
    }
  }

  // 5. Anti-Boredom & Constant Near-Win Teasers
  if (!baseDecision.allowWin) {
    const boredomThreshold = Math.max(20, 100 - ai.antiBoredomSensitivity);
    if (
      pState.consecutiveLosses >= 2 &&
      (boredom >= boredomThreshold || Math.random() * 100 < ai.nearMissTeaserPercent * 0.55)
    ) {
      const teaserRoll = Math.random() * 100;
      if (teaserRoll < ai.nearMissTeaserPercent) {
        const teaserMult = Math.round((1.2 + Math.random() * 0.7) * 10) / 10;
        pState.lastAiPhase = 'near_miss_teaser';
        return {
          useClassicLevel: false,
          allowWin: true,
          tier: 'small_win',
          maxMultiplierCap: Math.max(1.4, Math.min(maxCap, 2.2)),
          targetMultiplierHint: Math.min(maxCap, teaserMult),
          aiPhase: 'near_miss_teaser',
          reason: 'ai_near_win_teaser',
        };
      }
    }

    pState.lastAiPhase = 'observing';
    return {
      ...baseDecision,
      nearMissVisual: Math.random() * 100 < ai.nearMissTeaserPercent + 20,
      aiPhase: 'observing',
    };
  }

  // Respect baseline decision under AI observation, keeping big-bet protection active
  if (betAmount >= algo.highBetThreshold && shieldStrength >= 0.6 && Math.random() < 0.45) {
    pState.lastAiPhase = 'platform_shield';
    return {
      useClassicLevel: false,
      allowWin: false,
      tier: 'loss',
      maxMultiplierCap: 0.5,
      nearMissVisual: true,
      aiPhase: 'platform_shield',
      reason: 'ai_high_bet_shield',
    };
  }

  pState.lastAiPhase = 'observing';
  return {
    ...baseDecision,
    aiPhase: 'observing',
  };
}

export interface ConnectedGameMeta {
  id: string;
  nameAr: string;
  nameEn: string;
}

const BUILTIN_CONNECTED_GAMES: readonly ConnectedGameMeta[] = [
  { id: 'golden-tree', nameAr: 'Golden Tree', nameEn: 'Golden Tree' },
  { id: 'winter-slots', nameAr: 'Winter Slots', nameEn: 'Winter Slots' },
  { id: 'boxes', nameAr: 'صناديق الحظ', nameEn: 'Mystery Boxes' },
  { id: 'olympus', nameAr: 'Olympus Gates', nameEn: 'Olympus Gates' },
  { id: 'plinko', nameAr: 'Plinko', nameEn: 'Plinko' },
  { id: 'mines', nameAr: 'Mines', nameEn: 'Mines' },
  { id: 'dice', nameAr: 'Dice', nameEn: 'Dice' },
];

const dynamicConnectedGameNames = new Set<string>();

export function registerConnectedGameName(gameName: string): void {
  const clean = String(gameName || '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  if (!clean) return;
  const lower = clean.toLowerCase();
  const isBuiltin = BUILTIN_CONNECTED_GAMES.some(
    (g) => g.id === lower || g.nameEn.toLowerCase() === lower || g.nameAr.toLowerCase() === lower
  );
  if (!isBuiltin) {
    dynamicConnectedGameNames.add(clean);
  }
}

export function getConnectedGamesList(): ConnectedGameMeta[] {
  const extras: ConnectedGameMeta[] = Array.from(dynamicConnectedGameNames).map((name) => ({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    nameAr: name,
    nameEn: name,
  }));
  return [...BUILTIN_CONNECTED_GAMES, ...extras];
}

export function evaluateSmartGameDecision(
  playerId: string,
  gameName: string,
  betAmount: number,
  profitLevel: number,
  algo: SmartAlgorithmSettings,
  playerBalanceCoins?: number
): SmartGameDecision {
  registerConnectedGameName(gameName);
  const gameSettings = getGamesSettings();
  const runtime = getAlgoRuntimeState();
  const key = playerId || 'anonymous';
  if (!runtime.players[key]) {
    runtime.players[key] = {
      cyclePlan: buildSmartCyclePlan(algo),
      cycleCursor: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      rollingNetProfit: 0,
      totalRounds: 0,
      totalWins: 0,
      totalLosses: 0,
      lastPlayedAt: new Date().toISOString(),
    };
  }

  // Absolute & Final Zero-Profit Kill Switch overrides everything
  if (gameSettings.absoluteStopProfit || clampProfitLevel(profitLevel) <= 0) {
    runtime.players[key].lastAiPhase = 'absolute_stop';
    return {
      useClassicLevel: false,
      allowWin: false,
      tier: 'loss',
      maxMultiplierCap: 0,
      forceZeroPayout: true,
      nearMissVisual: false,
      aiPhase: 'absolute_stop',
      reason: gameSettings.absoluteStopProfit ? 'absolute_stop_profit' : 'profit_level_zero',
    };
  }

  const baseDecision = evaluateDecisionOnState(runtime.players[key], betAmount, profitLevel, algo);
  if (!gameSettings.aiMonitor?.enabled) {
    runtime.players[key].lastAiPhase = 'algorithm_only';
    return baseDecision;
  }

  return applyAiMonitorLayer(
    runtime.players[key],
    baseDecision,
    betAmount,
    profitLevel,
    algo,
    gameSettings.aiMonitor,
    runtime.telemetry,
    playerBalanceCoins
  );
}

/**
 * Universal entry point for any current or future game to obey the unified
 * Admin profit algorithm + AI Monitor and register itself automatically in telemetry.
 */
export function evaluateUnifiedGameDecision(
  playerId: string,
  gameKey: string,
  betAmount: number,
  playerBalanceCoins?: number
): SmartGameDecision & { profitLevel: number; targetWinRatePercent: number } {
  const gameSettings = getGamesSettings();
  const unifiedLevel = gameSettings.absoluteStopProfit
    ? 0
    : clampProfitLevel(gameSettings.plinkoProfitLevel);
  const decision = evaluateSmartGameDecision(
    playerId,
    gameKey,
    betAmount,
    unifiedLevel,
    gameSettings.algorithm,
    playerBalanceCoins
  );
  return {
    ...decision,
    profitLevel: unifiedLevel,
    targetWinRatePercent: gameSettings.algorithm.targetWinRatePercent,
  };
}

export function recordPlayerGameOutcome(
  playerId: string,
  game: string,
  betAmount: number,
  payout: number,
  multiplier: number,
  reason: string
): void {
  registerConnectedGameName(game);
  const gameSettings = getGamesSettings();
  const ai = gameSettings.aiMonitor || DEFAULT_AI_GAME_MONITOR;
  const runtime = getAlgoRuntimeState();
  const key = playerId || 'anonymous';
  const nowIso = new Date().toISOString();
  if (!runtime.players[key]) {
    runtime.players[key] = {
      cyclePlan: [],
      cycleCursor: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      rollingNetProfit: 0,
      totalRounds: 0,
      totalWins: 0,
      totalLosses: 0,
      lastPlayedAt: nowIso,
    };
  }

  const pState = runtime.players[key];
  const won = payout > betAmount;
  const net = payout - betAmount;

  pState.totalRounds += 1;
  pState.sessionWageredCoins = Math.round((pState.sessionWageredCoins || 0) + Math.max(0, betAmount));
  pState.sessionPayoutCoins = Math.round((pState.sessionPayoutCoins || 0) + Math.max(0, payout));
  pState.sessionNetProfit = Math.round((pState.sessionNetProfit || 0) + net);
  pState.lastBetAmount = Math.round(betAmount);
  pState.lastOutcomeReason = reason;

  if (typeof pState.lastKnownBalanceCoins === 'number') {
    pState.lastKnownBalanceCoins = Math.max(0, Math.round(pState.lastKnownBalanceCoins + net));
    if ((pState.peakBalanceCoins || 0) < pState.lastKnownBalanceCoins) {
      pState.peakBalanceCoins = pState.lastKnownBalanceCoins;
    }
  }

  const baseline = Math.max(betAmount || 500, pState.initialBaselineCoins || betAmount || 500);
  const isBigWin =
    won &&
    (multiplier >= ai.bigWinMultiplierTrigger ||
      net >= baseline * (ai.bigWinBalanceGainPercent / 100));

  if (won) {
    pState.totalWins += 1;
    pState.consecutiveWins += 1;
    pState.consecutiveLosses = 0;
    pState.boredomScore = Math.max(0, Math.round((pState.boredomScore || 0) - (isBigWin ? 55 : 22)));
    if (isBigWin) {
      pState.postBigWinDrainRemaining = ai.postBigWinDrainRounds;
      pState.roundsSinceBigWin = 0;
      pState.roundsSinceLogicalHit = 0;
    } else {
      pState.roundsSinceBigWin = (pState.roundsSinceBigWin || 0) + 1;
      if ((pState.postBigWinDrainRemaining || 0) > 0) {
        pState.postBigWinDrainRemaining = Math.max(0, (pState.postBigWinDrainRemaining || 0) - 1);
      }
      if (reason === 'ai_logical_hit' || multiplier >= ai.logicalHitMinMultiplier) {
        pState.roundsSinceLogicalHit = 0;
      } else {
        pState.roundsSinceLogicalHit = (pState.roundsSinceLogicalHit || 0) + 1;
      }
    }
    if (reason.startsWith('ai_comeback')) {
      pState.roundsSinceComeback = 0;
    } else {
      pState.roundsSinceComeback = (pState.roundsSinceComeback || 0) + 1;
    }
  } else {
    pState.totalLosses += 1;
    pState.consecutiveLosses += 1;
    pState.consecutiveWins = 0;
    pState.roundsSinceBigWin = (pState.roundsSinceBigWin || 0) + 1;
    pState.roundsSinceComeback = (pState.roundsSinceComeback || 0) + 1;
    pState.roundsSinceLogicalHit = (pState.roundsSinceLogicalHit || 0) + 1;
    if ((pState.postBigWinDrainRemaining || 0) > 0) {
      pState.postBigWinDrainRemaining = Math.max(0, (pState.postBigWinDrainRemaining || 0) - 1);
    }
    pState.boredomScore = Math.min(100, Math.round((pState.boredomScore || 0) + 14 + Math.min(12, pState.consecutiveLosses * 2)));
  }

  pState.rollingNetProfit = Math.round(pState.rollingNetProfit + net);
  // Gentle decay when house is deeply ahead so player can still get small teaser wins later
  if (pState.rollingNetProfit < -betAmount * 6 && Math.random() < 0.25) {
    pState.rollingNetProfit = Math.round(pState.rollingNetProfit * 0.7);
  }
  pState.lastPlayedAt = nowIso;

  const t = runtime.telemetry;
  t.totalRounds += 1;
  if (won) t.totalWins += 1;
  else t.totalLosses += 1;
  t.totalWageredCoins += Math.max(0, Math.round(betAmount));
  t.totalPayoutCoins += Math.max(0, Math.round(payout));
  t.houseNetProfitCoins = Math.round(t.totalWageredCoins - t.totalPayoutCoins);
  t.recentOutcomes = [
    {
      game,
      betAmount: Math.round(betAmount),
      payout: Math.round(payout),
      multiplier: Math.round(multiplier * 100) / 100,
      won,
      reason,
      timestamp: nowIso,
    },
    ...(t.recentOutcomes || []),
  ].slice(0, 25);
  t.updatedAt = nowIso;

  try {
    const matchedPlayer = getStoredUsers().find((u) => u.id === key || u.displayId === key);
    recordGeneralSiteLog({
      category: 'games',
      actorRole: 'USER',
      userId: matchedPlayer?.id || key,
      displayId: matchedPlayer?.displayId,
      email: matchedPlayer?.email,
      userName: matchedPlayer?.name || key,
      action: `game_${String(game || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      actionLabelAr: won ? `فوز في لعبة ${game}` : `جولة في لعبة ${game}`,
      details: `الرهان: ${Math.round(betAmount).toLocaleString()} | العائد: ${Math.round(payout).toLocaleString()} | المضاعف: ${Math.round(multiplier * 100) / 100}x | الصافي: ${net >= 0 ? '+' : ''}${Math.round(net).toLocaleString()} | السبب: ${reason}`,
      amount: Math.round(payout),
      currency: 'coins',
      status: won ? 'win' : 'loss',
      createdAt: nowIso,
    });
  } catch {}

  scheduleSaveAlgoRuntimeState();
}

export function getAiMonitoredPlayersSummary() {
  const runtime = getAlgoRuntimeState();
  const users = getStoredUsers();
  const userMap = new Map(users.map((u) => [u.id, u]));
  return Object.entries(runtime.players)
    .map(([playerId, st]) => {
      const u = userMap.get(playerId);
      const baseline = st.initialBaselineCoins || 0;
      const balance = u?.coinsBalance ?? st.lastKnownBalanceCoins ?? 0;
      return {
        playerId,
        displayId: u?.displayId || playerId.slice(0, 8),
        userName: u?.name || playerId,
        initialBaselineCoins: baseline,
        currentBalanceCoins: balance,
        sessionNetProfit: st.sessionNetProfit || 0,
        rollingNetProfit: st.rollingNetProfit || 0,
        totalRounds: st.totalRounds || 0,
        consecutiveLosses: st.consecutiveLosses || 0,
        consecutiveWins: st.consecutiveWins || 0,
        postBigWinDrainRemaining: st.postBigWinDrainRemaining || 0,
        boredomScore: st.boredomScore || 0,
        aiPhase: st.lastAiPhase || 'observing',
        lastOutcomeReason: st.lastOutcomeReason || '',
        lastPlayedAt: st.lastPlayedAt,
      };
    })
    .sort((a, b) => (b.lastPlayedAt || '').localeCompare(a.lastPlayedAt || ''))
    .slice(0, 30);
}

export function evolveAiMonitorFromTelemetry(): {
  settings: GamesSettings;
  summaryAr: string;
  summaryEn: string;
} {
  const current = getGamesSettings();
  const ai = { ...current.aiMonitor };
  const t = getGamesAlgorithmTelemetry();

  const houseProfit = t.totalWageredCoins - t.totalPayoutCoins;
  const actualWinRate = t.totalRounds > 0 ? (t.totalWins / t.totalRounds) * 100 : 25;
  const verNum = parseFloat(ai.aiVersion) || 2.0;
  const nextVer = (Math.round((verNum + 0.1) * 10) / 10).toFixed(1);

  let summaryAr = '';
  let summaryEn = '';

  if (t.totalRounds >= 5 && houseProfit < 0) {
    // Platform is currently negative -> strengthen protection & post-bigwin drain
    ai.postBigWinLossFocusPercent = Math.min(95, ai.postBigWinLossFocusPercent + 4);
    ai.postBigWinDrainRounds = Math.min(20, ai.postBigWinDrainRounds + 2);
    ai.platformProtectionStrength = Math.min(98, ai.platformProtectionStrength + 6);
    ai.comebackTriggerChancePercent = Math.max(18, ai.comebackTriggerChancePercent - 4);
    ai.strategyProfile = 'custom';
    summaryAr = `تم تطوير الذكاء الاصطناعي (${nextVer}): رُصد ضغط على ربح المنصة، فتم رفع تركيز الخسارة بعد الأرباح إلى ${ai.postBigWinLossFocusPercent}% وتقوية درع المنصة إلى ${ai.platformProtectionStrength}%.`;
    summaryEn = `AI Evolved (v${nextVer}): Detected margin pressure; boosted post-win drain to ${ai.postBigWinLossFocusPercent}% and platform shield to ${ai.platformProtectionStrength}%.`;
  } else if (t.totalRounds >= 5 && actualWinRate < 14) {
    // Players winning too rarely -> raise near-miss & comeback slightly so players don't get bored
    ai.nearMissTeaserPercent = Math.min(55, ai.nearMissTeaserPercent + 5);
    ai.antiBoredomSensitivity = Math.min(90, ai.antiBoredomSensitivity + 5);
    ai.comebackTriggerChancePercent = Math.min(55, ai.comebackTriggerChancePercent + 4);
    ai.logicalHitIntervalRounds = Math.max(7, ai.logicalHitIntervalRounds - 1);
    ai.strategyProfile = 'custom';
    summaryAr = `تم تطوير الذكاء الاصطناعي (${nextVer}): رُصد انخفاض حاد في الإثارة (${Math.round(actualWinRate)}%)، فتم رفع طُعم الربح القريب إلى ${ai.nearMissTeaserPercent}% وتقليص فاصل الضربة المنطقية.`;
    summaryEn = `AI Evolved (v${nextVer}): Low engagement detected (${Math.round(actualWinRate)}%); raised near-win teasers to ${ai.nearMissTeaserPercent}% and tightened logical-hit interval.`;
  } else {
    // Balanced optimization toward higher smart retention
    ai.postBigWinLossFocusPercent = Math.min(88, Math.max(75, ai.postBigWinLossFocusPercent + 1));
    ai.platformProtectionStrength = Math.min(92, Math.max(78, ai.platformProtectionStrength + 2));
    ai.nearMissTeaserPercent = Math.min(42, Math.max(28, ai.nearMissTeaserPercent + 1));
    ai.strategyProfile = 'custom';
    summaryAr = `تم تطوير الذكاء الاصطناعي (${nextVer}): معايرة متوازنة لزيادة الإثارة مع الحفاظ على استنزاف الأرباح الكبيرة وحماية المنصة (${ai.platformProtectionStrength}%).`;
    summaryEn = `AI Evolved (v${nextVer}): Balanced optimization preserving near-win excitement and ${ai.platformProtectionStrength}% platform protection.`;
  }

  ai.aiVersion = nextVer;
  ai.evolutionNotes = summaryAr;
  ai.lastEvolvedAt = new Date().toISOString();

  const updated = saveGamesSettings({ aiMonitor: ai });
  return { settings: updated, summaryAr, summaryEn };
}

export function simulateSmartAlgorithmSequence(
  profitLevel: number,
  algo: SmartAlgorithmSettings,
  sampleBet = 1000
): {
  previewRounds: { round: number; outcome: 'loss' | 'small_win' | 'medium_win'; multiplier: number; net: number; reason: string }[];
  monteCarlo: {
    rounds: number;
    wins: number;
    losses: number;
    winRatePercent: number;
    houseEdgePercent: number;
    avgWinMultiplier: number;
    projectedHouseProfit: number;
  };
} {
  const simState: PlayerGameCycleState = {
    cyclePlan: buildSmartCyclePlan(algo),
    cycleCursor: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0,
    rollingNetProfit: 0,
    totalRounds: 0,
    totalWins: 0,
    totalLosses: 0,
    lastPlayedAt: new Date().toISOString(),
  };

  const previewRounds: { round: number; outcome: 'loss' | 'small_win' | 'medium_win'; multiplier: number; net: number; reason: string }[] = [];
  const totalRounds = 1000;
  let totalWagered = 0;
  let totalPaid = 0;
  let wins = 0;
  let winMultSum = 0;

  for (let i = 1; i <= totalRounds; i++) {
    const decision = evaluateDecisionOnState(simState, sampleBet, profitLevel, algo);
    let mult = 0;
    let outcome: 'loss' | 'small_win' | 'medium_win' = 'loss';

    if (decision.useClassicLevel) {
      const p = pickPlinkoOutcome(profitLevel);
      mult = p.multiplier;
      outcome = mult > 1 ? (mult <= 2 ? 'small_win' : 'medium_win') : 'loss';
    } else if (!decision.allowWin) {
      mult = Math.random() < 0.72 ? 0 : 0.2;
      outcome = 'loss';
    } else if (decision.tier === 'small_win') {
      const minSmall = Math.min(decision.maxMultiplierCap, 1.2);
      mult = Math.round((minSmall + Math.random() * Math.max(0, decision.maxMultiplierCap - minSmall)) * 10) / 10;
      outcome = 'small_win';
    } else {
      const minMed = Math.min(decision.maxMultiplierCap, 2.0);
      mult = Math.round((minMed + Math.random() * Math.max(0, decision.maxMultiplierCap - minMed)) * 10) / 10;
      outcome = 'medium_win';
    }

    const payout = Math.round(sampleBet * mult);
    const net = payout - sampleBet;
    const isWin = payout > sampleBet;
    if (isWin) {
      wins += 1;
      winMultSum += mult;
      simState.consecutiveWins += 1;
      simState.consecutiveLosses = 0;
    } else {
      simState.consecutiveLosses += 1;
      simState.consecutiveWins = 0;
    }
    simState.rollingNetProfit += net;
    totalWagered += sampleBet;
    totalPaid += payout;

    if (i <= 20) {
      previewRounds.push({
        round: i,
        outcome: isWin ? outcome : 'loss',
        multiplier: mult,
        net,
        reason: decision.reason,
      });
    }
  }

  return {
    previewRounds,
    monteCarlo: {
      rounds: totalRounds,
      wins,
      losses: totalRounds - wins,
      winRatePercent: Math.round((wins / totalRounds) * 1000) / 10,
      houseEdgePercent: Math.round(((totalWagered - totalPaid) / Math.max(1, totalWagered)) * 1000) / 10,
      avgWinMultiplier: wins > 0 ? Math.round((winMultSum / wins) * 100) / 100 : 0,
      projectedHouseProfit: Math.round(totalWagered - totalPaid),
    },
  };
}

function getPlinkoWeightsForLevel(profitLevel: number): number[] {
  const clamped = clampProfitLevel(profitLevel);
  if (clamped <= 0) return [...PLINKO_WEIGHT_TABLE[0]];
  if (clamped >= 10) return [...PLINKO_WEIGHT_TABLE[10]];
  const lowIdx = Math.floor(clamped);
  const highIdx = Math.ceil(clamped);
  if (lowIdx === highIdx) return [...PLINKO_WEIGHT_TABLE[lowIdx]];
  const frac = clamped - lowIdx;
  return PLINKO_WEIGHT_TABLE[lowIdx].map(
    (w, i) => w * (1 - frac) + PLINKO_WEIGHT_TABLE[highIdx][i] * frac
  );
}

function buildPlinkoMultipliersForLevel(_profitLevel: number): number[] {
  return [...PLINKO_MULTIPLIERS];
}

function pickPlinkoOutcome(
  profitLevel: number,
  decision?: SmartGameDecision
): {
  targetSlot: number;
  multiplier: number;
  path: ('L' | 'R')[];
} {
  const level = clampProfitLevel(profitLevel);
  let targetSlot = 5;

  if (level <= 0 || decision?.forceZeroPayout) {
    targetSlot = 5;
  } else if (decision && !decision.useClassicLevel) {
    if (!decision.allowWin) {
      if (decision.nearMissVisual) {
        // Near-miss: often land in 0.5x (next to 1.2x/2x) or center 0.2x
        const r = Math.random();
        targetSlot = r < 0.45 ? 5 : r < 0.725 ? 4 : 6;
      } else {
        // Losing slots: 5 (0.2x) 68% or 4/6 (0.5x) 32%
        const r = Math.random();
        targetSlot = r < 0.68 ? 5 : r < 0.84 ? 4 : 6;
      }
    } else {
      // Winning slots capped by decision.maxMultiplierCap (prefer closest to targetMultiplierHint when present)
      const candidateSlots: { slot: number; mult: number; w: number }[] = [];
      PLINKO_MULTIPLIERS.forEach((mult, slotIdx) => {
        if (mult > 1 && mult <= decision.maxMultiplierCap) {
          let w = mult <= 1.5 ? 55 : mult <= 2.5 ? 30 : mult <= 6 ? 12 : 3;
          if (decision.targetMultiplierHint) {
            const dist = Math.abs(mult - decision.targetMultiplierHint);
            w = 100 / (0.4 + dist * dist);
          }
          candidateSlots.push({ slot: slotIdx, mult, w });
        }
      });
      if (candidateSlots.length === 0) {
        targetSlot = Math.random() < 0.5 ? 4 : 6; // 0.5x if cap < 1.2
      } else {
        const sumW = candidateSlots.reduce((s, c) => s + c.w, 0);
        let r = Math.random() * sumW;
        targetSlot = candidateSlots[0].slot;
        for (const c of candidateSlots) {
          if (r < c.w) {
            targetSlot = c.slot;
            break;
          }
          r -= c.w;
        }
      }
    }
  } else {
    const weights = getPlinkoWeightsForLevel(level);
    const totalWeight = weights.reduce((acc, w) => acc + Math.max(0, w), 0);
    let r = Math.random() * (totalWeight > 0 ? totalWeight : 1);
    for (let i = 0; i < weights.length; i++) {
      const w = Math.max(0, weights[i]);
      if (r < w) {
        targetSlot = i;
        break;
      }
      r -= w;
    }
  }

  // Build exact path of PLINKO_ROWS decisions with exactly `targetSlot` 'R' moves
  const path: ('L' | 'R')[] = [];
  for (let i = 0; i < PLINKO_ROWS; i++) {
    path.push(i < targetSlot ? 'R' : 'L');
  }
  // Fisher-Yates shuffle for organic peg bounces while guaranteeing exact bucket landing
  for (let i = path.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = path[i];
    path[i] = path[j];
    path[j] = tmp;
  }

  const multiplier = PLINKO_MULTIPLIERS[targetSlot];

  return {
    targetSlot,
    multiplier,
    path,
  };
}

export interface StoredAgent {
  id: string;
  gridCode?: string; // رقم القريد للوكيل مثال A8838
  email: string;
  name: string;
  nameAr?: string;
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
  orderId?: string;
  orderNumber?: string;
  agentId: string;
  agentName: string;
  gridCode: string;
  amount: number;
  fee?: number;
  netCredited?: number;
  usdAmount?: number;
  netUsdAmount?: number;
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
  orderId?: string;
  orderNumber?: string;
  agentId: string;
  gridCode: string;
  targetUserId: string;
  targetUserDisplayId?: string;
  targetUserName: string;
  amount: number;
  grossAmount?: number;
  feeAmount?: number;
  feePercentage?: number;
  usdAmount?: number;
  netUsdAmount?: number;
  payoutMethod?: string;
  accountDetails?: string;
  type?: 'recharge' | 'user_withdrawal';
  timestamp: string;
  previousBalance?: number;
  newBalance?: number;
}

export interface StoredAgencyNotification {
  id: string;
  orderId?: string;
  orderNumber?: string;
  agentId: string;
  gridCode: string;
  title: string;
  titleEn?: string;
  message: string;
  messageEn?: string;
  grossAmount: number;
  feeAmount: number;
  netAmount: number;
  feePercentage: number;
  usdAmount: number;
  netUsdAmount: number;
  userId: string;
  userDisplayId: string;
  userName: string;
  timestamp: string;
  read: boolean;
  type: 'incoming_user_withdrawal' | 'user_withdrawal' | 'recharge' | 'system';
}

export interface StoredUserNotification {
  id: string;
  userId: string;
  userDisplayId?: string;
  type: 'friend_request_accepted' | 'agency_recharge' | 'withdrawal_request' | 'admin_broadcast' | 'admin_message';
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  timestamp: string;
  read: boolean;
  metadata?: {
    friendId?: string;
    friendDisplayId?: string;
    friendName?: string;
    friendAvatar?: string;
    agentId?: string;
    agentGridCode?: string;
    agentName?: string;
    amount?: number;
    diamondsAmount?: number;
    currency?: 'coins';
    txId?: string;
    orderId?: string;
    withdrawalId?: string;
    previousBalance?: number;
    newBalance?: number;
    isAdminMessage?: boolean;
    isBroadcast?: boolean;
    broadcastId?: string;
    category?: 'announcement' | 'warning' | 'alert' | 'system' | 'custom' | 'reward';
    priority?: 'normal' | 'important' | 'urgent';
    senderName?: string;
    recipientName?: string;
    recipientDisplayId?: string;
    recipientEmail?: string;
  };
}

export interface StoredFeedbackReport {
  id: string;
  userId?: string;
  userName?: string;
  userDisplayId?: string;
  userEmail?: string;
  userAvatar?: string;
  type: 'bug' | 'suggestion' | 'feedback' | 'user_report';
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  deviceInfo?: string;
  status: 'pending' | 'in_review' | 'resolved' | 'dismissed';
  createdAt: string;
  adminNotes?: string;
  adminReply?: string;
  // User report specific metadata
  reportedUserId?: string;
  reportedUserDisplayId?: string;
  reportedUserName?: string;
  reportedUserAvatar?: string;
  reportedUserEmail?: string;
  reason?: string;
  source?: 'chat' | 'matching';
}

export interface StoredPasswordResetRequest {
  id: string;
  source?: 'web' | 'telegram';
  userId?: string;
  userDisplayId?: string;
  userEmail?: string;
  userName?: string;
  telegramUserId?: number | string;
  telegramUsername?: string;
  telegramLink?: string;
  telegramFirstName?: string;
  telegramLastName?: string;
  chatId?: number | string;
  contactNote?: string;
  status: 'pending' | 'contacted' | 'resolved' | 'cancelled';
  requestedAt: string;
  adminNotes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

function normalizeTelegramContact(
  rawInput?: string | null,
  telegramUserId?: number | string | null
): { username?: string; link?: string } {
  const raw = String(rawInput || '').trim();
  if (raw) {
    // Extract from https://t.me/username or t.me/username or @username
    const urlMatch = raw.match(/(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{3,32})(?:[/?#].*)?$/i);
    if (urlMatch && urlMatch[1]) {
      const handle = urlMatch[1];
      return { username: `@${handle}`, link: `https://t.me/${handle}` };
    }
    const atMatch = raw.match(/^@?([a-zA-Z][a-zA-Z0-9_]{2,31})$/);
    if (atMatch && atMatch[1]) {
      const handle = atMatch[1];
      return { username: `@${handle}`, link: `https://t.me/${handle}` };
    }
  }
  if (telegramUserId !== undefined && telegramUserId !== null && String(telegramUserId).trim()) {
    const cleanId = String(telegramUserId).trim();
    return { username: undefined, link: `tg://user?id=${cleanId}` };
  }
  return { username: undefined, link: undefined };
}

function hashPassword(password: string): string {
  return crypto.createHmac('sha256', 'SOULX_SALT_2026').update(password).digest('hex');
}

// ==========================================
// Tombstone Deletion Tracking (Immune to redeployment & git resets)
// ==========================================
export function getDeletedAgentKeys(): Set<string> {
  const set = new Set<string>();
  try {
    if (fs.existsSync(DELETED_AGENTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(DELETED_AGENTS_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        data.forEach((k: any) => {
          if (typeof k === 'string' && k.trim()) set.add(k.trim().toLowerCase());
        });
      }
    }
  } catch (err) {
    console.error('Error reading deleted_agents file:', err);
  }
  return set;
}

export function recordDeletedAgent(
  identifier?: string,
  email?: string,
  gridCode?: string,
  extraIdentifiers?: string[]
) {
  try {
    let list: string[] = [];
    if (fs.existsSync(DELETED_AGENTS_FILE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(DELETED_AGENTS_FILE, 'utf-8'));
        if (Array.isArray(parsed)) list = parsed.map((x) => String(x).toLowerCase().trim());
      } catch {}
    }

    const addKey = (k?: string | null) => {
      if (k && typeof k === 'string') {
        const clean = k.trim().toLowerCase();
        if (clean && !list.includes(clean)) list.push(clean);
      }
    };

    addKey(identifier);
    addKey(email);
    addKey(gridCode);
    if (extraIdentifiers && Array.isArray(extraIdentifiers)) {
      extraIdentifiers.forEach(addKey);
    }

    fs.writeFileSync(DELETED_AGENTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    console.log(`🛡️ [Soul-X Tombstone] Agent recorded as permanently deleted: ${identifier || email || gridCode}`);

    // Immediately scrub from agents.json file on disk as well
    if (fs.existsSync(AGENTS_FILE)) {
      try {
        const raw = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf-8'));
        if (Array.isArray(raw)) {
          const deletedSet = new Set(list);
          const filtered = raw.filter((a) => {
            const idKey = String(a.id || '').trim().toLowerCase();
            const emailKey = String(a.email || '').trim().toLowerCase();
            const gridKey = String(a.gridCode || '').trim().toLowerCase();
            return !deletedSet.has(idKey) && !deletedSet.has(emailKey) && (!gridKey || !deletedSet.has(gridKey));
          });
          if (filtered.length !== raw.length) {
            fs.writeFileSync(AGENTS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
            console.log(`🧹 [Soul-X Agent Scrub] Cleaned deleted agent from agents.json (${filtered.length} remaining)`);
          }
        }
      } catch (scrubErr) {
        console.warn('Scrub agents file warning:', scrubErr);
      }
    }
  } catch (err) {
    console.error('Error recording deleted agent:', err);
  }
}

export function unrecordDeletedAgent(identifier?: string, email?: string, gridCode?: string) {
  try {
    if (!fs.existsSync(DELETED_AGENTS_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(DELETED_AGENTS_FILE, 'utf-8'));
    if (!Array.isArray(parsed)) return;
    const cleanId = String(identifier || '').trim().toLowerCase();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanGrid = String(gridCode || '').trim().toLowerCase();
    const filtered = parsed.filter((x: any) => {
      const s = String(x).toLowerCase().trim();
      return s !== cleanId && s !== cleanEmail && s !== cleanGrid;
    });
    fs.writeFileSync(DELETED_AGENTS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
  } catch {}
}

export function getDeletedUserKeys(): Set<string> {
  const set = new Set<string>();
  try {
    if (fs.existsSync(DELETED_USERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(DELETED_USERS_FILE, 'utf-8'));
      if (Array.isArray(data)) {
        data.forEach((k: any) => {
          if (typeof k === 'string' && k.trim()) set.add(k.trim().toLowerCase());
        });
      }
    }
  } catch (err) {
    console.error('Error reading deleted_users file:', err);
  }
  return set;
}

export function recordDeletedUser(identifier: string, email?: string, displayId?: string) {
  try {
    let list: string[] = [];
    if (fs.existsSync(DELETED_USERS_FILE)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(DELETED_USERS_FILE, 'utf-8'));
        if (Array.isArray(parsed)) list = parsed.map((x) => String(x).toLowerCase().trim());
      } catch {}
    }
    const cleanId = String(identifier || '').trim().toLowerCase();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanDisp = String(displayId || '').trim().toLowerCase();

    if (cleanId && !list.includes(cleanId)) list.push(cleanId);
    if (cleanEmail && !list.includes(cleanEmail)) list.push(cleanEmail);
    if (cleanDisp && !list.includes(cleanDisp)) list.push(cleanDisp);

    fs.writeFileSync(DELETED_USERS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    console.log(`🛡️ [Soul-X Tombstone] User recorded as permanently deleted: ${cleanId || cleanEmail || cleanDisp}`);
  } catch (err) {
    console.error('Error recording deleted user:', err);
  }
}

export function unrecordDeletedUser(identifier: string, email?: string, displayId?: string) {
  try {
    if (!fs.existsSync(DELETED_USERS_FILE)) return;
    const parsed = JSON.parse(fs.readFileSync(DELETED_USERS_FILE, 'utf-8'));
    if (!Array.isArray(parsed)) return;
    const cleanId = String(identifier || '').trim().toLowerCase();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanDisp = String(displayId || '').trim().toLowerCase();
    const filtered = parsed.filter((x: any) => {
      const s = String(x).toLowerCase().trim();
      return s !== cleanId && s !== cleanEmail && s !== cleanDisp;
    });
    fs.writeFileSync(DELETED_USERS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
  } catch {}
}

export async function purgeMockDataFromNeon(): Promise<void> {
  if (!neonPool) return;
  try {
    const deletedAgents = Array.from(getDeletedAgentKeys());
    if (deletedAgents.length > 0) {
      await neonPool.query(
        `DELETE FROM agents WHERE LOWER(id) = ANY($1) OR LOWER(email) = ANY($1) OR LOWER(grid_code) = ANY($1)`,
        [deletedAgents]
      ).catch(() => {});
    }

    const deletedUsers = Array.from(getDeletedUserKeys());
    if (deletedUsers.length > 0) {
      await neonPool.query(
        `DELETE FROM profiles WHERE LOWER(id) = ANY($1) OR LOWER(email) = ANY($1) OR LOWER(display_id) = ANY($1)`,
        [deletedUsers]
      ).catch(() => {});
      await neonPool.query(
        `DELETE FROM friends WHERE LOWER(user_id) = ANY($1) OR LOWER(friend_id) = ANY($1)`,
        [deletedUsers]
      ).catch(() => {});
      await neonPool.query(
        `DELETE FROM friend_requests WHERE LOWER(sender_id) = ANY($1) OR LOWER(receiver_id) = ANY($1)`,
        [deletedUsers]
      ).catch(() => {});
      const convsToDeleteRes: any = await neonPool.query(
        `SELECT DISTINCT conversation_id FROM conversation_participants WHERE LOWER(user_id) = ANY($1)
         UNION
         SELECT DISTINCT conversation_id FROM messages WHERE LOWER(sender_id) = ANY($1)`,
        [deletedUsers]
      ).catch(() => ({ rows: [] }));
      const convIdsToDelete = (convsToDeleteRes?.rows || []).map((r: any) => r.conversation_id).filter(Boolean);
      if (convIdsToDelete.length > 0) {
        await neonPool.query(`DELETE FROM messages WHERE conversation_id = ANY($1::text[])`, [convIdsToDelete]).catch(() => {});
        await neonPool.query(`DELETE FROM conversation_participants WHERE conversation_id = ANY($1::text[])`, [convIdsToDelete]).catch(() => {});
        await neonPool.query(`DELETE FROM conversations WHERE id = ANY($1::text[])`, [convIdsToDelete]).catch(() => {});
      }
      await neonPool.query(`DELETE FROM conversation_participants WHERE LOWER(user_id) = ANY($1)`, [deletedUsers]).catch(() => {});
      await neonPool.query(`DELETE FROM messages WHERE LOWER(sender_id) = ANY($1)`, [deletedUsers]).catch(() => {});
    }
    await neonPool.query(`DELETE FROM feedback_reports WHERE LOWER(COALESCE(user_email, '')) LIKE 'e2e-check-%'`).catch(() => {});
    await neonPool.query(`DELETE FROM password_reset_requests WHERE LOWER(COALESCE(user_email, '')) LIKE 'e2e-check-%'`).catch(() => {});
    console.log('🧹 [Neon Database] Purged any legacy mock agents and fake users from Neon');
  } catch (err) {
    console.warn('Purge mock data from Neon error:', err);
  }
}

function getStoredUsers(): StoredUser[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        const deletedKeys = getDeletedUserKeys();
        const nonDeleted = parsed.filter((u) => {
          const idKey = String(u.id || '').trim().toLowerCase();
          const emailKey = String(u.email || '').trim().toLowerCase();
          const dispKey = String(u.displayId || '').trim().toLowerCase();
          return !deletedKeys.has(idKey) && !deletedKeys.has(emailKey) && (!dispKey || !deletedKeys.has(dispKey));
        });
        if (nonDeleted.length !== parsed.length) {
          saveStoredUsers(nonDeleted);
        }
        return nonDeleted;
      }
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
    const adminEmails = getAdminEmails();
    const admin1 = adminEmails[0] || 'abojafar@soul-x.com';
    const admin2 = adminEmails[1] || 'abohaidar@soul-x.com';

    // Clean up any legacy default fallback accounts that are not set in environment variables
    const activeAdminEmails = new Set([admin1, admin2].filter(Boolean));

    const adminDefs: { email: string; id: string; name: string; displayId: string }[] = [];
    if (admin1) {
      adminDefs.push({
        email: admin1,
        id: 'admin-1001',
        name: 'مدير النظام (ADMIN1)',
        displayId: '1',
      });
    }
    if (admin2 && admin2 !== admin1) {
      adminDefs.push({
        email: admin2,
        id: 'admin-1002',
        name: 'مدير النظام (ADMIN2)',
        displayId: '2',
      });
    }

    for (const def of adminDefs) {
      if (!def.email) continue;
      let user = users.find((u) => u.email.toLowerCase() === def.email);
      const targetHash = hashPassword(DEFAULT_ADMIN_PASSWORD);

      if (!user) {
        user = {
          id: def.id,
          displayId: def.displayId,
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
        if (def.displayId && user.displayId !== def.displayId) {
          user.displayId = def.displayId;
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

      if (neonPool && user) {
        getNeonProfileByIdentifier(user.email)
          .then(async (existingNeon) => {
            if (!existingNeon) {
              await saveProfileToNeon(user);
            }
          })
          .catch(() => {});
      }
    }

    if (changed) {
      saveStoredUsers(users);
      if (adminDefs.length > 0) {
        console.log('⚡ Admin accounts initialized for environment configured admins:', adminDefs.map((d) => d.email).join(', '));
      }
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
        const deletedKeys = getDeletedAgentKeys();
        const nonDeleted = parsed.filter((agent) => {
          const idKey = String(agent.id || '').trim().toLowerCase();
          const emailKey = String(agent.email || '').trim().toLowerCase();
          const gridKey = String(agent.gridCode || '').trim().toLowerCase();
          return !deletedKeys.has(idKey) && !deletedKeys.has(emailKey) && (!gridKey || !deletedKeys.has(gridKey));
        });
        if (nonDeleted.length !== parsed.length) {
          fs.writeFileSync(AGENTS_FILE, JSON.stringify(nonDeleted, null, 2), 'utf-8');
        }
        return nonDeleted;
      }
    }
  } catch (err) {
    console.error('Error reading agents file:', err);
  }
  return [];
}

function getStoredAgents(): StoredAgent[] {
  const rawAgents = getStoredAgentsRaw();
  const deletedKeys = getDeletedAgentKeys();

  // Exclude any agent that has been permanently deleted/tombstoned by admin
  const nonDeleted = rawAgents.filter((agent) => {
    const idKey = String(agent.id || '').trim().toLowerCase();
    const emailKey = String(agent.email || '').trim().toLowerCase();
    const gridKey = String(agent.gridCode || '').trim().toLowerCase();
    if (deletedKeys.has(idKey) || deletedKeys.has(emailKey) || (gridKey && deletedKeys.has(gridKey))) {
      return false;
    }
    return true;
  });

  let changed = nonDeleted.length !== rawAgents.length;
  const codes = new Set(nonDeleted.map((a) => a.gridCode).filter(Boolean) as string[]);

  nonDeleted.forEach((agent) => {
    if (!agent.gridCode) {
      agent.gridCode = generateGridCode(codes);
      codes.add(agent.gridCode);
      changed = true;
    }
  });

  if (changed) {
    saveStoredAgents(nonDeleted);
  }

  return nonDeleted;
}

export function agentToSupabaseRow(a: StoredAgent): Record<string, any> {
  return {
    id: a.id,
    grid_code: (a.gridCode || 'A8838').toUpperCase(),
    email: a.email.toLowerCase().trim(),
    name: a.name,
    name_en: a.nameEn || a.name,
    tagline_ar: a.taglineAr || '',
    tagline_en: a.taglineEn || '',
    country: a.country || 'دولي',
    flag: a.flag || '🌐',
    balance: typeof a.balance === 'number' ? Math.max(0, a.balance) : 0,
    category: a.category || 'both',
    methods: a.methods || ['تحويل بنكي', 'كاش', 'USDT'],
    response_time_ar: a.responseTimeAr || 'رد فوري (< دقيقة)',
    response_time_en: a.responseTimeEn || 'Instant reply (< 1 min)',
    rating: typeof a.rating === 'number' ? a.rating : 4.95,
    completed_orders: typeof a.completedOrders === 'number' ? a.completedOrders : 0,
    whatsapp: a.whatsapp || '',
    telegram: a.telegram || '',
    is_online: a.isOnline ?? true,
    min_amount: typeof a.minAmount === 'number' ? a.minAmount : 100,
    max_amount: typeof a.maxAmount === 'number' ? a.maxAmount : 2000000,
    rate_note_ar: a.rateNoteAr || '',
    rate_note_en: a.rateNoteEn || '',
    status: a.status === 'suspended' ? 'suspended' : 'active',
    created_at: a.createdAt || new Date().toISOString(),
    updated_at: a.updatedAt || new Date().toISOString(),
    deleted_at: null,
  };
}

export function supabaseRowToAgent(row: any): StoredAgent {
  let parsedMethods: string[] = ['تحويل بنكي', 'كاش', 'USDT'];
  if (Array.isArray(row.methods)) {
    parsedMethods = row.methods;
  } else if (typeof row.methods === 'string') {
    try {
      const p = JSON.parse(row.methods);
      if (Array.isArray(p)) parsedMethods = p;
    } catch {
      parsedMethods = row.methods.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }

  return {
    id: String(row.id),
    gridCode: (row.grid_code || row.gridCode || 'A8838').toUpperCase(),
    email: String(row.email || '').toLowerCase().trim(),
    name: row.name,
    nameEn: row.name_en || row.nameEn || row.name,
    taglineAr: row.tagline_ar || row.taglineAr || '',
    taglineEn: row.tagline_en || row.taglineEn || '',
    country: row.country || 'دولي',
    flag: row.flag || '🌐',
    balance: Math.max(0, Math.round((parseDbNumber(row.balance, 0) + Number.EPSILON) * 100) / 100),
    category: row.category === 'recharge' || row.category === 'withdraw' ? row.category : 'both',
    methods: parsedMethods,
    responseTimeAr: row.response_time_ar || row.responseTimeAr || 'رد فوري (< دقيقة)',
    responseTimeEn: row.response_time_en || row.responseTimeEn || 'Instant reply (< 1 min)',
    rating: parseDbNumber(row.rating, 4.95),
    completedOrders: Math.round(parseDbNumber(row.completed_orders ?? row.completedOrders, 0)),
    whatsapp: row.whatsapp || '',
    telegram: row.telegram || '',
    isOnline: row.is_online ?? row.isOnline ?? true,
    minAmount: parseDbNumber(row.min_amount ?? row.minAmount, 100),
    maxAmount: parseDbNumber(row.max_amount ?? row.maxAmount, 2000000),
    rateNoteAr: row.rate_note_ar || row.rateNoteAr || '',
    rateNoteEn: row.rate_note_en || row.rateNoteEn || '',
    status: row.status === 'suspended' ? 'suspended' : 'active',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : (row.createdAt || new Date().toISOString()),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : row.updatedAt,
  };
}

export async function saveAgentToNeon(agent: StoredAgent): Promise<boolean> {
  if (!neonPool) return false;
  try {
    const cleanGrid = (agent.gridCode || 'A8838').toUpperCase();
    const cleanEmail = agent.email.toLowerCase().trim();
    const cleanBalance = Math.max(0, Math.round((parseDbNumber(agent.balance, 0) + Number.EPSILON) * 100) / 100);
    await withTimeout(
      neonPool.query(
        `INSERT INTO agents (
          id, grid_code, email, name, name_en, tagline_ar, tagline_en, country, flag, balance,
          category, methods, response_time_ar, response_time_en, rating, completed_orders,
          whatsapp, telegram, is_online, min_amount, max_amount, rate_note_ar, rate_note_en,
          status, created_at, updated_at, deleted_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12::jsonb, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23,
          $24, $25, NOW(), NULL
        )
        ON CONFLICT (id) DO UPDATE SET
          grid_code = EXCLUDED.grid_code,
          email = EXCLUDED.email,
          name = EXCLUDED.name,
          name_en = EXCLUDED.name_en,
          tagline_ar = EXCLUDED.tagline_ar,
          tagline_en = EXCLUDED.tagline_en,
          country = EXCLUDED.country,
          flag = EXCLUDED.flag,
          balance = EXCLUDED.balance,
          category = EXCLUDED.category,
          methods = EXCLUDED.methods,
          response_time_ar = EXCLUDED.response_time_ar,
          response_time_en = EXCLUDED.response_time_en,
          rating = EXCLUDED.rating,
          completed_orders = EXCLUDED.completed_orders,
          whatsapp = EXCLUDED.whatsapp,
          telegram = EXCLUDED.telegram,
          is_online = EXCLUDED.is_online,
          min_amount = EXCLUDED.min_amount,
          max_amount = EXCLUDED.max_amount,
          rate_note_ar = EXCLUDED.rate_note_ar,
          rate_note_en = EXCLUDED.rate_note_en,
          status = EXCLUDED.status,
          updated_at = NOW(),
          deleted_at = NULL`,
        [
          agent.id,
          cleanGrid,
          cleanEmail,
          agent.name,
          agent.nameEn || agent.name,
          agent.taglineAr || '',
          agent.taglineEn || '',
          agent.country || 'دولي',
          agent.flag || '🌐',
          cleanBalance,
          agent.category || 'both',
          JSON.stringify(agent.methods || ['تحويل بنكي', 'كاش', 'USDT']),
          agent.responseTimeAr || 'رد فوري (< دقيقة)',
          agent.responseTimeEn || 'Instant reply (< 1 min)',
          parseDbNumber(agent.rating, 4.95),
          Math.round(parseDbNumber(agent.completedOrders, 0)),
          agent.whatsapp || '',
          agent.telegram || '',
          agent.isOnline ?? true,
          parseDbNumber(agent.minAmount, 100),
          parseDbNumber(agent.maxAmount, 2000000),
          agent.rateNoteAr || '',
          agent.rateNoteEn || '',
          agent.status === 'suspended' ? 'suspended' : 'active',
          agent.createdAt || new Date().toISOString(),
        ]
      ),
      5000
    );
    verifiedNeonTables.agents = true;
    return true;
  } catch (err: any) {
    console.warn('Neon saveAgentToNeon error:', err?.message || err);
    return false;
  }
}

export async function updateAgentBalanceInNeon(
  agent: StoredAgent,
  newBalance: number,
  completedOrders?: number
): Promise<boolean> {
  if (!neonPool) return false;
  try {
    const cleanBalance = Math.max(0, Math.round((parseDbNumber(newBalance, 0) + Number.EPSILON) * 100) / 100);
    const res: any = await withTimeout(
      completedOrders !== undefined
        ? neonPool.query(
            'UPDATE agents SET balance = $1, completed_orders = $2, updated_at = NOW() WHERE id = $3 OR UPPER(grid_code) = UPPER($4)',
            [cleanBalance, Math.round(completedOrders), agent.id, agent.gridCode || agent.id]
          )
        : neonPool.query(
            'UPDATE agents SET balance = $1, updated_at = NOW() WHERE id = $2 OR UPPER(grid_code) = UPPER($3)',
            [cleanBalance, agent.id, agent.gridCode || agent.id]
          ),
      5000
    );
    verifiedNeonTables.agents = true;
    if (!res || (res.rowCount ?? 0) === 0) {
      return await saveAgentToNeon({
        ...agent,
        balance: cleanBalance,
        completedOrders: completedOrders ?? agent.completedOrders,
      });
    }
    return true;
  } catch (err: any) {
    console.warn('Neon updateAgentBalanceInNeon error:', err?.message || err);
    return false;
  }
}

export async function saveAgencyTransactionToNeon(tx: StoredAgencyTransaction): Promise<boolean> {
  if (!neonPool) return false;
  try {
    await withTimeout(
      neonPool.query(
        `INSERT INTO agency_transactions (
          id, order_id, order_number, agent_id, grid_code, target_user_id, target_user_display_id, target_user_name,
          amount, gross_amount, fee_amount, fee_percentage, usd_amount, net_usd_amount,
          payout_method, account_details, type, timestamp, previous_balance, new_balance
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19, $20
        )
        ON CONFLICT (id) DO NOTHING`,
        [
          tx.id,
          tx.orderId || null,
          tx.orderNumber || tx.orderId || null,
          tx.agentId,
          tx.gridCode || 'A8838',
          tx.targetUserId,
          tx.targetUserDisplayId || null,
          tx.targetUserName || null,
          parseDbNumber(tx.amount, 0),
          tx.grossAmount !== undefined ? parseDbNumber(tx.grossAmount, 0) : null,
          tx.feeAmount !== undefined ? parseDbNumber(tx.feeAmount, 0) : null,
          tx.feePercentage !== undefined ? parseDbNumber(tx.feePercentage, 0) : null,
          tx.usdAmount !== undefined ? parseDbNumber(tx.usdAmount, 0) : null,
          tx.netUsdAmount !== undefined ? parseDbNumber(tx.netUsdAmount, 0) : null,
          tx.payoutMethod || null,
          tx.accountDetails || null,
          tx.type || 'recharge',
          tx.timestamp || new Date().toISOString(),
          tx.previousBalance !== undefined ? parseDbNumber(tx.previousBalance, 0) : null,
          tx.newBalance !== undefined ? parseDbNumber(tx.newBalance, 0) : null,
        ]
      ),
      5000
    );
    verifiedNeonTables.agency_transactions = true;
    return true;
  } catch (err: any) {
    console.warn('Neon saveAgencyTransactionToNeon error:', err?.message || err);
    return false;
  }
}

export async function saveAgencyWithdrawalToNeon(w: StoredAgencyWithdrawal): Promise<boolean> {
  if (!neonPool) return false;
  try {
    await withTimeout(
      neonPool.query(
        `INSERT INTO agency_withdrawals (
          id, order_id, order_number, agent_id, agent_name, grid_code,
          diamonds_amount, amount, fee, net_credited, usd_amount, net_usd_amount,
          payment_method, method, account_details, notes, status,
          user_id, user_display_id, user_name, type, admin_note, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23, $24
        )
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          admin_note = COALESCE(EXCLUDED.admin_note, agency_withdrawals.admin_note),
          updated_at = EXCLUDED.updated_at`,
        [
          w.id,
          w.orderId || null,
          w.orderNumber || w.orderId || null,
          w.agentId,
          w.agentName || null,
          w.gridCode || 'A8838',
          Math.round(parseDbNumber(w.amount, 0)),
          parseDbNumber(w.amount, 0),
          w.fee !== undefined ? parseDbNumber(w.fee, 0) : 0,
          w.netCredited !== undefined ? parseDbNumber(w.netCredited, 0) : 0,
          w.usdAmount !== undefined ? parseDbNumber(w.usdAmount, 0) : 0,
          w.netUsdAmount !== undefined ? parseDbNumber(w.netUsdAmount, 0) : 0,
          w.method || 'USDT TRC20',
          w.method || 'USDT TRC20',
          w.accountDetails || '',
          w.notes || null,
          w.status || 'pending',
          w.userId || null,
          w.userDisplayId || null,
          w.userName || null,
          w.type || 'agency_cashout',
          w.adminNote || null,
          w.createdAt || new Date().toISOString(),
          w.updatedAt || w.createdAt || new Date().toISOString(),
        ]
      ),
      5000
    );
    verifiedNeonTables.agency_withdrawals = true;
    return true;
  } catch (err: any) {
    console.warn('Neon saveAgencyWithdrawalToNeon error:', err?.message || err);
    return false;
  }
}

export async function syncAgentsWithNeon(): Promise<StoredAgent[]> {
  if (!neonPool) return getStoredAgents();

  try {
    const res: any = await withTimeout(
      neonPool.query('SELECT * FROM agents ORDER BY created_at DESC'),
      3500
    );
    if (!res) return getStoredAgents();
    verifiedNeonTables.agents = true;

    const deletedKeys = getDeletedAgentKeys();
    const localAgents = getStoredAgents();

    // Sync Neon tombstones into local deleted keys
    try {
      const tRes: any = await withTimeout(
        neonPool.query("SELECT deleted_identifier FROM tombstones WHERE entity_type = 'agent'"),
        2500
      );
      if (tRes?.rows) {
        for (const t of tRes.rows) {
          if (t.deleted_identifier) {
            deletedKeys.add(String(t.deleted_identifier).trim().toLowerCase());
            recordDeletedAgent(t.deleted_identifier);
          }
        }
      }
    } catch {}

    const rows = res.rows || [];
    const neonAgents: StoredAgent[] = [];
    const neonIds = new Set<string>();
    const neonEmails = new Set<string>();
    const neonGrids = new Set<string>();

    for (const row of rows) {
      const idKey = String(row.id || '').trim().toLowerCase();
      const emailKey = String(row.email || '').trim().toLowerCase();
      const gridKey = String(row.grid_code || row.gridCode || '').trim().toLowerCase();
      if (deletedKeys.has(idKey) || deletedKeys.has(emailKey) || (gridKey && deletedKeys.has(gridKey))) {
        await neonPool.query('DELETE FROM agents WHERE id = $1 OR LOWER(email) = $2', [row.id, emailKey]).catch(() => {});
        continue;
      }
      const mapped = supabaseRowToAgent(row);
      neonAgents.push(mapped);
      if (idKey) neonIds.add(idKey);
      if (emailKey) neonEmails.add(emailKey);
      if (gridKey) neonGrids.add(gridKey);
    }

    // Bidirectional: push any non-deleted local agents not yet in Neon
    for (const la of localAgents) {
      const lId = String(la.id || '').trim().toLowerCase();
      const lEmail = String(la.email || '').trim().toLowerCase();
      const lGrid = String(la.gridCode || '').trim().toLowerCase();
      if (deletedKeys.has(lId) || deletedKeys.has(lEmail) || (lGrid && deletedKeys.has(lGrid))) {
        continue;
      }
      if (!neonIds.has(lId) && !neonEmails.has(lEmail) && (!lGrid || !neonGrids.has(lGrid))) {
        await saveAgentToNeon(la).catch(() => {});
        neonAgents.push(la);
      }
    }

    if (neonAgents.length > 0 || rows.length > 0) {
      saveStoredAgents(neonAgents);
    }
    return neonAgents.length > 0 ? neonAgents : localAgents;
  } catch (err) {
    console.warn('Sync agents with Neon warning:', err);
    return getStoredAgents();
  }
}
export const syncAgentsWithSupabase = syncAgentsWithNeon;

export async function syncAgencyTransactionsWithNeon(): Promise<StoredAgencyTransaction[]> {
  const localTxs = getStoredAgencyTransactions();
  if (!neonPool) return localTxs;
  try {
    const res: any = await withTimeout(
      neonPool.query('SELECT * FROM agency_transactions ORDER BY timestamp DESC LIMIT 5000'),
      4000
    );
    if (!res) return localTxs;
    verifiedNeonTables.agency_transactions = true;

    const map = new Map<string, StoredAgencyTransaction>();
    for (const t of res.rows || []) {
      map.set(t.id, {
        id: t.id,
        orderId: t.order_id || undefined,
        orderNumber: t.order_number || t.order_id || undefined,
        agentId: t.agent_id,
        gridCode: t.grid_code || 'A8838',
        targetUserId: t.target_user_id,
        targetUserDisplayId: t.target_user_display_id || undefined,
        targetUserName: t.target_user_name || undefined,
        amount: parseDbNumber(t.amount, 0),
        grossAmount: parseOptionalDbNumber(t.gross_amount) ?? undefined,
        feeAmount: parseOptionalDbNumber(t.fee_amount) ?? undefined,
        feePercentage: parseOptionalDbNumber(t.fee_percentage) ?? undefined,
        usdAmount: parseOptionalDbNumber(t.usd_amount) ?? undefined,
        netUsdAmount: parseOptionalDbNumber(t.net_usd_amount) ?? undefined,
        payoutMethod: t.payout_method || undefined,
        accountDetails: t.account_details || undefined,
        type: t.type === 'user_withdrawal' ? 'user_withdrawal' : 'recharge',
        timestamp: t.timestamp ? new Date(t.timestamp).toISOString() : new Date().toISOString(),
        previousBalance: parseOptionalDbNumber(t.previous_balance) ?? undefined,
        newBalance: parseOptionalDbNumber(t.new_balance) ?? undefined,
      });
    }
    for (const lt of localTxs) {
      if (!map.has(lt.id)) {
        map.set(lt.id, lt);
        await saveAgencyTransactionToNeon(lt).catch(() => {});
      }
    }
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    if (merged.length !== localTxs.length) {
      saveStoredAgencyTransactions(merged);
    }
    return merged;
  } catch (err) {
    console.warn('Sync agency transactions with Neon warning:', err);
    return localTxs;
  }
}

export async function syncAgencyWithdrawalsWithNeon(): Promise<StoredAgencyWithdrawal[]> {
  const localWithdrawals = getStoredAgencyWithdrawals();
  if (!neonPool) return localWithdrawals;
  try {
    const res: any = await withTimeout(
      neonPool.query('SELECT * FROM agency_withdrawals ORDER BY created_at DESC LIMIT 5000'),
      4000
    );
    if (!res) return localWithdrawals;
    verifiedNeonTables.agency_withdrawals = true;

    const map = new Map<string, StoredAgencyWithdrawal>();
    for (const d of res.rows || []) {
      map.set(d.id, {
        id: d.id,
        orderId: d.order_id || undefined,
        orderNumber: d.order_number || d.order_id || undefined,
        agentId: d.agent_id,
        agentName: d.agent_name || '',
        gridCode: d.grid_code || 'A8838',
        amount: parseDbNumber(d.amount ?? d.diamonds_amount, 0),
        fee: parseOptionalDbNumber(d.fee) ?? undefined,
        netCredited: parseOptionalDbNumber(d.net_credited) ?? undefined,
        usdAmount: parseOptionalDbNumber(d.usd_amount) ?? undefined,
        netUsdAmount: parseOptionalDbNumber(d.net_usd_amount) ?? undefined,
        method: d.method || d.payment_method || 'USDT TRC20',
        accountDetails: d.account_details || '',
        notes: d.notes || undefined,
        status: d.status || 'pending',
        userId: d.user_id || undefined,
        userDisplayId: d.user_display_id || undefined,
        userName: d.user_name || undefined,
        type: d.type === 'incoming_user_withdrawal' ? 'incoming_user_withdrawal' : 'agency_cashout',
        createdAt: d.created_at ? new Date(d.created_at).toISOString() : new Date().toISOString(),
        updatedAt: d.updated_at ? new Date(d.updated_at).toISOString() : undefined,
        adminNote: d.admin_note || undefined,
      });
    }
    for (const lw of localWithdrawals) {
      if (!map.has(lw.id)) {
        map.set(lw.id, lw);
        await saveAgencyWithdrawalToNeon(lw).catch(() => {});
      }
    }
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (merged.length !== localWithdrawals.length) {
      saveStoredAgencyWithdrawals(merged);
    }
    return merged;
  } catch (err) {
    console.warn('Sync agency withdrawals with Neon warning:', err);
    return localWithdrawals;
  }
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

function getStoredAgencyNotifications(): StoredAgencyNotification[] {
  try {
    if (fs.existsSync(AGENCY_NOTIFICATIONS_FILE)) {
      const data = fs.readFileSync(AGENCY_NOTIFICATIONS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading agency notifications file:', err);
  }
  return [];
}

function saveStoredAgencyNotifications(notifs: StoredAgencyNotification[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(AGENCY_NOTIFICATIONS_FILE, JSON.stringify(notifs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving agency notifications file:', err);
  }
}

function getStoredUserNotifications(): StoredUserNotification[] {
  try {
    if (fs.existsSync(USER_NOTIFICATIONS_FILE)) {
      const data = fs.readFileSync(USER_NOTIFICATIONS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading user notifications file:', err);
  }
  return [];
}

function saveStoredUserNotifications(notifs: StoredUserNotification[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(USER_NOTIFICATIONS_FILE, JSON.stringify(notifs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving user notifications file:', err);
  }
}

function createAndSaveUserNotification(
  notifData: Omit<StoredUserNotification, 'id' | 'timestamp' | 'read'>
): StoredUserNotification {
  const notifs = getStoredUserNotifications();
  const newNotif: StoredUserNotification = {
    id: `unotif-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    ...notifData,
    timestamp: new Date().toISOString(),
    read: false,
  };
  notifs.unshift(newNotif);
  saveStoredUserNotifications(notifs);

  // Broadcast in real-time to active user connections via SSE
  try {
    const targetKeys = [notifData.userId, notifData.userDisplayId].filter(Boolean) as string[];
    broadcastChatMessage(targetKeys, {
      type: 'user_notification',
      notification: newNotif,
    });
  } catch (bcErr) {
    console.warn('Failed to broadcast user notification:', bcErr);
  }

  return newNotif;
}

async function saveFeedbackReportToNeon(report: StoredFeedbackReport): Promise<void> {
  if (!neonPool) return;
  try {
    await neonPool.query(
      `INSERT INTO feedback_reports (
        id, user_id, user_display_id, user_name, user_email, user_avatar,
        type, title, description, priority, device_info, status, created_at,
        admin_notes, admin_reply, reported_user_id, reported_user_display_id,
        reported_user_name, reported_user_avatar, reported_user_email, reason, source
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, $21, $22
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        admin_notes = COALESCE(EXCLUDED.admin_notes, feedback_reports.admin_notes),
        admin_reply = COALESCE(EXCLUDED.admin_reply, feedback_reports.admin_reply)`,
      [
        report.id,
        report.userId || null,
        report.userDisplayId || null,
        report.userName || null,
        report.userEmail || null,
        report.userAvatar || null,
        report.type,
        report.title,
        report.description,
        report.priority || 'medium',
        report.deviceInfo || null,
        report.status || 'pending',
        report.createdAt || new Date().toISOString(),
        report.adminNotes ?? null,
        report.adminReply ?? null,
        report.reportedUserId || null,
        report.reportedUserDisplayId || null,
        report.reportedUserName || null,
        report.reportedUserAvatar || null,
        report.reportedUserEmail || null,
        report.reason || null,
        report.source || null,
      ]
    );
    verifiedNeonTables.feedback_reports = true;
  } catch (err: any) {
    console.warn('Neon saveFeedbackReportToNeon error:', err?.message || err);
  }
}

async function deleteFeedbackReportFromNeon(id?: string): Promise<void> {
  if (!neonPool) return;
  try {
    if (id) {
      await neonPool.query('DELETE FROM feedback_reports WHERE id = $1', [id]);
    } else {
      await neonPool.query('DELETE FROM feedback_reports');
    }
  } catch (err: any) {
    console.warn('Neon deleteFeedbackReportFromNeon error:', err?.message || err);
  }
}

function mapNeonRowToFeedbackReport(r: any): StoredFeedbackReport {
  return {
    id: r.id,
    userId: r.user_id || undefined,
    userDisplayId: r.user_display_id || undefined,
    userName: r.user_name || undefined,
    userEmail: r.user_email || undefined,
    userAvatar: r.user_avatar || undefined,
    type: r.type,
    title: r.title,
    description: r.description,
    priority: r.priority || 'medium',
    deviceInfo: r.device_info || undefined,
    status: r.status || 'pending',
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    adminNotes: r.admin_notes || undefined,
    adminReply: r.admin_reply || undefined,
    reportedUserId: r.reported_user_id || undefined,
    reportedUserDisplayId: r.reported_user_display_id || undefined,
    reportedUserName: r.reported_user_name || undefined,
    reportedUserAvatar: r.reported_user_avatar || undefined,
    reportedUserEmail: r.reported_user_email || undefined,
    reason: r.reason || undefined,
    source: r.source || undefined,
  };
}

export async function syncFeedbackReportsWithNeon(): Promise<void> {
  if (!neonPool) return;
  try {
    const res: any = await withTimeout(
      neonPool.query('SELECT * FROM feedback_reports ORDER BY created_at DESC LIMIT 2000'),
      5000
    );
    const rows = res?.rows || [];
    const localReports = getStoredFeedbackReports();
    const map = new Map<string, StoredFeedbackReport>();
    for (const r of rows) {
      map.set(r.id, mapNeonRowToFeedbackReport(r));
    }
    for (const lr of localReports) {
      if (!map.has(lr.id)) {
        map.set(lr.id, lr);
        await saveFeedbackReportToNeon(lr);
      }
    }
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    saveStoredFeedbackReports(merged);
  } catch (err: any) {
    console.warn('Neon syncFeedbackReportsWithNeon warning:', err?.message || err);
  }
}

async function getMergedFeedbackReports(): Promise<StoredFeedbackReport[]> {
  const localReports = getStoredFeedbackReports();
  if (!neonPool) return localReports;
  try {
    const res: any = await withTimeout(
      neonPool.query('SELECT * FROM feedback_reports ORDER BY created_at DESC LIMIT 2000'),
      4000
    );
    if (!res) return localReports;
    const rows = res.rows || [];
    const map = new Map<string, StoredFeedbackReport>();
    for (const r of rows) {
      map.set(r.id, mapNeonRowToFeedbackReport(r));
    }
    for (const lr of localReports) {
      if (!map.has(lr.id)) {
        map.set(lr.id, lr);
        saveFeedbackReportToNeon(lr).catch(() => {});
      }
    }
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (merged.length !== localReports.length) {
      saveStoredFeedbackReports(merged);
    }
    return merged;
  } catch {
    return localReports;
  }
}

function getStoredFeedbackReports(): StoredFeedbackReport[] {
  try {
    if (fs.existsSync(FEEDBACK_REPORTS_FILE)) {
      const data = fs.readFileSync(FEEDBACK_REPORTS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading feedback reports file:', err);
  }
  return [];
}

function saveStoredFeedbackReports(reports: StoredFeedbackReport[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(FEEDBACK_REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving feedback reports file:', err);
  }
}

async function savePasswordResetToNeon(item: StoredPasswordResetRequest): Promise<void> {
  if (!neonPool) return;
  try {
    await neonPool.query(
      `INSERT INTO password_reset_requests (
        id, source, user_id, user_display_id, user_email, user_name,
        telegram_user_id, telegram_username, telegram_first_name, telegram_last_name,
        chat_id, contact_note, status, requested_at, admin_notes, resolved_at, resolved_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17
      )
      ON CONFLICT (id) DO UPDATE SET
        source = COALESCE(EXCLUDED.source, password_reset_requests.source),
        user_id = COALESCE(EXCLUDED.user_id, password_reset_requests.user_id),
        user_display_id = COALESCE(EXCLUDED.user_display_id, password_reset_requests.user_display_id),
        user_email = COALESCE(EXCLUDED.user_email, password_reset_requests.user_email),
        user_name = COALESCE(EXCLUDED.user_name, password_reset_requests.user_name),
        telegram_username = COALESCE(EXCLUDED.telegram_username, password_reset_requests.telegram_username),
        telegram_first_name = COALESCE(EXCLUDED.telegram_first_name, password_reset_requests.telegram_first_name),
        telegram_last_name = COALESCE(EXCLUDED.telegram_last_name, password_reset_requests.telegram_last_name),
        contact_note = COALESCE(EXCLUDED.contact_note, password_reset_requests.contact_note),
        status = EXCLUDED.status,
        admin_notes = COALESCE(EXCLUDED.admin_notes, password_reset_requests.admin_notes),
        resolved_at = COALESCE(EXCLUDED.resolved_at, password_reset_requests.resolved_at),
        resolved_by = COALESCE(EXCLUDED.resolved_by, password_reset_requests.resolved_by)`,
      [
        item.id,
        item.source || (item.telegramUserId ? 'telegram' : 'web'),
        item.userId || null,
        item.userDisplayId || null,
        item.userEmail || null,
        item.userName || null,
        item.telegramUserId !== undefined && item.telegramUserId !== null ? String(item.telegramUserId) : null,
        item.telegramUsername || null,
        item.telegramFirstName || null,
        item.telegramLastName || null,
        item.chatId !== undefined && item.chatId !== null ? String(item.chatId) : null,
        item.contactNote || null,
        item.status || 'pending',
        item.requestedAt || new Date().toISOString(),
        item.adminNotes ?? null,
        item.resolvedAt || null,
        item.resolvedBy || null,
      ]
    );
    verifiedNeonTables.password_reset_requests = true;
  } catch (err: any) {
    console.warn('Neon savePasswordResetToNeon error:', err?.message || err);
  }
}

async function deletePasswordResetFromNeon(id?: string): Promise<void> {
  if (!neonPool) return;
  try {
    if (id) {
      await neonPool.query('DELETE FROM password_reset_requests WHERE id = $1', [id]);
    } else {
      await neonPool.query('DELETE FROM password_reset_requests');
    }
  } catch (err: any) {
    console.warn('Neon deletePasswordResetFromNeon error:', err?.message || err);
  }
}

function mapNeonRowToPasswordReset(r: any): StoredPasswordResetRequest {
  const tg = normalizeTelegramContact(r.telegram_username || r.contact_note, r.telegram_user_id);
  return {
    id: r.id,
    source: r.source === 'web' ? 'web' : 'telegram',
    userId: r.user_id || undefined,
    userDisplayId: r.user_display_id || undefined,
    userEmail: r.user_email || undefined,
    userName: r.user_name || undefined,
    telegramUserId: r.telegram_user_id || undefined,
    telegramUsername: r.telegram_username || tg.username || undefined,
    telegramLink: tg.link,
    telegramFirstName: r.telegram_first_name || undefined,
    telegramLastName: r.telegram_last_name || undefined,
    chatId: r.chat_id || undefined,
    contactNote: r.contact_note || undefined,
    status: r.status || 'pending',
    requestedAt: r.requested_at ? new Date(r.requested_at).toISOString() : new Date().toISOString(),
    adminNotes: r.admin_notes || undefined,
    resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : undefined,
    resolvedBy: r.resolved_by || undefined,
  };
}

export async function syncPasswordResetsWithNeon(): Promise<void> {
  if (!neonPool) return;
  try {
    const res: any = await withTimeout(
      neonPool.query('SELECT * FROM password_reset_requests ORDER BY requested_at DESC LIMIT 2000'),
      5000
    );
    const rows = res?.rows || [];
    const localReqs = getStoredPasswordResetRequests();
    const map = new Map<string, StoredPasswordResetRequest>();
    for (const r of rows) {
      map.set(r.id, mapNeonRowToPasswordReset(r));
    }
    for (const lr of localReqs) {
      if (!map.has(lr.id)) {
        map.set(lr.id, lr);
        await savePasswordResetToNeon(lr);
      }
    }
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
    saveStoredPasswordResetRequests(merged);
  } catch (err: any) {
    console.warn('Neon syncPasswordResetsWithNeon warning:', err?.message || err);
  }
}

async function getMergedPasswordResets(): Promise<StoredPasswordResetRequest[]> {
  const localReqs = getStoredPasswordResetRequests();
  if (!neonPool) return localReqs;
  try {
    const res: any = await withTimeout(
      neonPool.query('SELECT * FROM password_reset_requests ORDER BY requested_at DESC LIMIT 2000'),
      4000
    );
    if (!res) return localReqs;
    const rows = res.rows || [];
    const map = new Map<string, StoredPasswordResetRequest>();
    for (const r of rows) {
      map.set(r.id, mapNeonRowToPasswordReset(r));
    }
    for (const lr of localReqs) {
      if (!map.has(lr.id)) {
        map.set(lr.id, lr);
        savePasswordResetToNeon(lr).catch(() => {});
      }
    }
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
    if (merged.length !== localReqs.length) {
      saveStoredPasswordResetRequests(merged);
    }
    return merged;
  } catch {
    return localReqs;
  }
}

export function getStoredPasswordResetRequests(): StoredPasswordResetRequest[] {
  try {
    if (fs.existsSync(PASSWORD_RESET_REQUESTS_FILE)) {
      const data = fs.readFileSync(PASSWORD_RESET_REQUESTS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading password reset requests file:', err);
  }
  return [];
}

export function saveStoredPasswordResetRequests(requests: StoredPasswordResetRequest[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PASSWORD_RESET_REQUESTS_FILE, JSON.stringify(requests, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving password reset requests file:', err);
  }
}

export interface StoredVerificationRequest {
  id: string;
  userId: string;
  userDisplayId?: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  idFrontImage: string;
  idBackImage: string;
  selfieWithIdImage: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
}

export function getStoredVerificationRequests(): StoredVerificationRequest[] {
  try {
    if (fs.existsSync(VERIFICATION_REQUESTS_FILE)) {
      const data = fs.readFileSync(VERIFICATION_REQUESTS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading verification requests file:', err);
  }
  return [];
}

export function saveStoredVerificationRequests(requests: StoredVerificationRequest[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(VERIFICATION_REQUESTS_FILE, JSON.stringify(requests, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving verification requests file:', err);
  }
}

function mapNeonRowToVerificationRequest(r: any): StoredVerificationRequest {
  return {
    id: r.id,
    userId: r.user_id,
    userDisplayId: r.user_display_id || undefined,
    userName: r.user_name || 'مستخدم Soul-X',
    userEmail: r.user_email || undefined,
    userAvatar: r.user_avatar || undefined,
    idFrontImage: r.id_front_image || '',
    idBackImage: r.id_back_image || '',
    selfieWithIdImage: r.selfie_with_id_image || '',
    status: (r.status as 'pending' | 'approved' | 'rejected') || 'pending',
    submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : new Date().toISOString(),
    reviewedAt: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
    reviewedBy: r.reviewed_by || null,
    rejectionReason: r.rejection_reason || null,
  };
}

async function saveVerificationRequestToNeon(item: StoredVerificationRequest): Promise<void> {
  if (!neonPool) return;
  try {
    await neonPool.query(
      `INSERT INTO verification_requests (
        id, user_id, user_display_id, user_name, user_email, user_avatar,
        id_front_image, id_back_image, selfie_with_id_image, status, submitted_at,
        reviewed_at, reviewed_by, rejection_reason
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14
      )
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        reviewed_at = COALESCE(EXCLUDED.reviewed_at, verification_requests.reviewed_at),
        reviewed_by = COALESCE(EXCLUDED.reviewed_by, verification_requests.reviewed_by),
        rejection_reason = EXCLUDED.rejection_reason`,
      [
        item.id,
        item.userId,
        item.userDisplayId || null,
        item.userName || 'مستخدم Soul-X',
        item.userEmail || null,
        item.userAvatar || null,
        item.idFrontImage,
        item.idBackImage,
        item.selfieWithIdImage,
        item.status || 'pending',
        item.submittedAt || new Date().toISOString(),
        item.reviewedAt || null,
        item.reviewedBy || null,
        item.rejectionReason || null,
      ]
    );
    verifiedNeonTables.verification_requests = true;
  } catch (err: any) {
    console.warn('Neon saveVerificationRequestToNeon warning:', err?.message || err);
  }
}

export async function syncVerificationRequestsWithNeon(): Promise<void> {
  if (!neonPool) return;
  try {
    const res: any = await withTimeout(
      neonPool.query('SELECT * FROM verification_requests ORDER BY submitted_at DESC LIMIT 1000'),
      5000
    );
    const rows = res?.rows || [];
    const localReqs = getStoredVerificationRequests();
    const map = new Map<string, StoredVerificationRequest>();
    for (const r of rows) {
      map.set(r.id, mapNeonRowToVerificationRequest(r));
    }
    for (const lr of localReqs) {
      if (!map.has(lr.id)) {
        map.set(lr.id, lr);
        await saveVerificationRequestToNeon(lr);
      }
    }
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    saveStoredVerificationRequests(merged);
  } catch (err: any) {
    console.warn('Neon syncVerificationRequestsWithNeon warning:', err?.message || err);
  }
}

async function getMergedVerificationRequests(): Promise<StoredVerificationRequest[]> {
  const localReqs = getStoredVerificationRequests();
  if (!neonPool) return localReqs;
  try {
    const res: any = await withTimeout(
      neonPool.query('SELECT * FROM verification_requests ORDER BY submitted_at DESC LIMIT 1000'),
      4000
    );
    if (!res) return localReqs;
    const rows = res.rows || [];
    const map = new Map<string, StoredVerificationRequest>();
    for (const r of rows) {
      map.set(r.id, mapNeonRowToVerificationRequest(r));
    }
    for (const lr of localReqs) {
      if (!map.has(lr.id)) {
        map.set(lr.id, lr);
        saveVerificationRequestToNeon(lr).catch(() => {});
      }
    }
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    if (merged.length !== localReqs.length) {
      saveStoredVerificationRequests(merged);
    }
    return merged;
  } catch {
    return localReqs;
  }
}

export function recordPasswordResetRequest(data: {
  telegramUserId: number | string;
  telegramUsername?: string;
  telegramFirstName?: string;
  telegramLastName?: string;
  chatId: number | string;
}): { request: StoredPasswordResetRequest; isNew: boolean } {
  const requests = getStoredPasswordResetRequests();
  const tg = normalizeTelegramContact(data.telegramUsername, data.telegramUserId);

  // Try linking to any known Soul-X user from referral transfers
  let linkedUser: StoredUser | undefined;
  try {
    const refStore = getBotReferralStore();
    const matchedTx = refStore.transfers.find(
      (t) => String(t.telegramUserId) === String(data.telegramUserId)
    );
    if (matchedTx) {
      const users = getStoredUsers();
      linkedUser = users.find(
        (u) =>
          (matchedTx.targetUserId && u.id === matchedTx.targetUserId) ||
          (matchedTx.targetDisplayId && u.displayId === matchedTx.targetDisplayId)
      );
    }
  } catch {}

  const existingPending = requests.find(
    (r) => r.telegramUserId !== undefined && String(r.telegramUserId) === String(data.telegramUserId) && r.status === 'pending'
  );

  if (existingPending) {
    if (tg.username) existingPending.telegramUsername = tg.username;
    if (tg.link) existingPending.telegramLink = tg.link;
    if (data.telegramFirstName) existingPending.telegramFirstName = data.telegramFirstName;
    if (data.telegramLastName) existingPending.telegramLastName = data.telegramLastName;
    if (linkedUser) {
      existingPending.userId = existingPending.userId || linkedUser.id;
      existingPending.userDisplayId = existingPending.userDisplayId || linkedUser.displayId;
      existingPending.userEmail = existingPending.userEmail || linkedUser.email;
      existingPending.userName = existingPending.userName || linkedUser.name;
    }
    saveStoredPasswordResetRequests(requests);
    savePasswordResetToNeon(existingPending).catch(() => {});
    return { request: existingPending, isNew: false };
  }

  const newRequest: StoredPasswordResetRequest = {
    id: `prr-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
    source: 'telegram',
    userId: linkedUser?.id,
    userDisplayId: linkedUser?.displayId,
    userEmail: linkedUser?.email,
    userName: linkedUser?.name,
    telegramUserId: data.telegramUserId,
    telegramUsername: tg.username || data.telegramUsername || undefined,
    telegramLink: tg.link,
    telegramFirstName: data.telegramFirstName || undefined,
    telegramLastName: data.telegramLastName || undefined,
    chatId: data.chatId,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };

  requests.unshift(newRequest);
  saveStoredPasswordResetRequests(requests);
  savePasswordResetToNeon(newRequest).catch(() => {});
  return { request: newRequest, isNew: true };
}

// ==========================================
// Telegram Bot Referrals System (نظام الإحالات في البوت)
// ==========================================
export interface BotReferralSettings {
  enabled: boolean;
  newUserBonusUsd: number;
  referrerBonusUsd: number;
  coinsPerDollar: number;
  updatedAt?: string;
}

export interface BotReferralUser {
  telegramUserId: string;
  chatId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  referralCode: string;
  balanceUsd: number;
  totalEarnedUsd: number;
  totalTransferredUsd: number;
  totalTransferredCoins: number;
  referralsCount: number;
  referredByTelegramId?: string | null;
  referredByCode?: string | null;
  joinedAt: string;
  updatedAt?: string;
}

export interface BotReferralEvent {
  id: string;
  referrerTelegramId: string;
  referrerCode: string;
  newUserTelegramId: string;
  newUserName: string;
  newUserUsername?: string;
  referrerBonusUsd: number;
  newUserBonusUsd: number;
  createdAt: string;
}

export interface BotReferralTransfer {
  id: string;
  telegramUserId: string;
  telegramName: string;
  telegramUsername?: string;
  targetUserId: string;
  targetDisplayId: string;
  targetUserName: string;
  amountUsd: number;
  coinsCredited: number;
  coinsPerDollar: number;
  previousCoinsBalance: number;
  newCoinsBalance: number;
  createdAt: string;
}

export interface BotReferralStore {
  settings: BotReferralSettings;
  users: BotReferralUser[];
  events: BotReferralEvent[];
  transfers: BotReferralTransfer[];
}

const DEFAULT_BOT_REFERRAL_SETTINGS: BotReferralSettings = {
  enabled: true,
  newUserBonusUsd: 0.1,
  referrerBonusUsd: 0.5,
  coinsPerDollar: 25000,
};

function roundUsd(val: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 10000) / 10000;
}

export function getBotReferralStore(): BotReferralStore {
  try {
    if (fs.existsSync(BOT_REFERRALS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(BOT_REFERRALS_FILE, 'utf-8'));
      const rawSettings = parsed?.settings || {};
      return {
        settings: {
          enabled: typeof rawSettings.enabled === 'boolean' ? rawSettings.enabled : DEFAULT_BOT_REFERRAL_SETTINGS.enabled,
          newUserBonusUsd: Number.isFinite(Number(rawSettings.newUserBonusUsd))
            ? Math.max(0, roundUsd(Number(rawSettings.newUserBonusUsd)))
            : DEFAULT_BOT_REFERRAL_SETTINGS.newUserBonusUsd,
          referrerBonusUsd: Number.isFinite(Number(rawSettings.referrerBonusUsd))
            ? Math.max(0, roundUsd(Number(rawSettings.referrerBonusUsd)))
            : DEFAULT_BOT_REFERRAL_SETTINGS.referrerBonusUsd,
          coinsPerDollar: Number.isFinite(Number(rawSettings.coinsPerDollar)) && Number(rawSettings.coinsPerDollar) >= 1
            ? Math.round(Number(rawSettings.coinsPerDollar))
            : DEFAULT_BOT_REFERRAL_SETTINGS.coinsPerDollar,
          updatedAt: rawSettings.updatedAt,
        },
        users: Array.isArray(parsed?.users) ? parsed.users : [],
        events: Array.isArray(parsed?.events) ? parsed.events : [],
        transfers: Array.isArray(parsed?.transfers) ? parsed.transfers : [],
      };
    }
  } catch (err) {
    console.error('Error reading bot_referrals.json:', err);
  }
  return {
    settings: { ...DEFAULT_BOT_REFERRAL_SETTINGS },
    users: [],
    events: [],
    transfers: [],
  };
}

export function saveBotReferralStore(store: BotReferralStore) {
  try {
    fs.writeFileSync(BOT_REFERRALS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving bot_referrals.json:', err);
  }
}

export function getBotReferralSettings(): BotReferralSettings {
  return getBotReferralStore().settings;
}

export function saveBotReferralSettings(partial: Partial<BotReferralSettings>): BotReferralSettings {
  const store = getBotReferralStore();
  const updated: BotReferralSettings = {
    enabled: typeof partial.enabled === 'boolean' ? partial.enabled : store.settings.enabled,
    newUserBonusUsd:
      partial.newUserBonusUsd !== undefined && Number.isFinite(Number(partial.newUserBonusUsd))
        ? Math.max(0, roundUsd(Number(partial.newUserBonusUsd)))
        : store.settings.newUserBonusUsd,
    referrerBonusUsd:
      partial.referrerBonusUsd !== undefined && Number.isFinite(Number(partial.referrerBonusUsd))
        ? Math.max(0, roundUsd(Number(partial.referrerBonusUsd)))
        : store.settings.referrerBonusUsd,
    coinsPerDollar:
      partial.coinsPerDollar !== undefined &&
      Number.isFinite(Number(partial.coinsPerDollar)) &&
      Number(partial.coinsPerDollar) >= 1
        ? Math.round(Number(partial.coinsPerDollar))
        : store.settings.coinsPerDollar,
    updatedAt: new Date().toISOString(),
  };
  store.settings = updated;
  saveBotReferralStore(store);
  saveBotReferralSettingsToNeon(updated).catch(() => {});
  return updated;
}

export function generateBotReferralCode(existingCodes?: Set<string>): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const used =
    existingCodes ||
    new Set(
      getBotReferralStore()
        .users.map((u) => String(u.referralCode || '').toLowerCase())
        .filter(Boolean)
    );
  for (let attempt = 0; attempt < 10000; attempt++) {
    let code = '';
    for (let i = 0; i < 9; i++) {
      code += chars.charAt(crypto.randomInt(0, chars.length));
    }
    if (!used.has(code)) {
      return code;
    }
  }
  return `sx${Date.now().toString(36).slice(-7)}`;
}

async function saveBotReferralSettingsToNeon(settings: BotReferralSettings): Promise<void> {
  if (!neonPool) return;
  try {
    await neonPool.query(
      `INSERT INTO bot_referral_settings (id, enabled, new_user_bonus_usd, referrer_bonus_usd, coins_per_dollar, updated_at)
       VALUES ('default', $1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         new_user_bonus_usd = EXCLUDED.new_user_bonus_usd,
         referrer_bonus_usd = EXCLUDED.referrer_bonus_usd,
         coins_per_dollar = EXCLUDED.coins_per_dollar,
         updated_at = EXCLUDED.updated_at`,
      [
        settings.enabled,
        settings.newUserBonusUsd,
        settings.referrerBonusUsd,
        settings.coinsPerDollar,
        settings.updatedAt || new Date().toISOString(),
      ]
    );
  } catch (err: any) {
    console.warn('Neon saveBotReferralSettings warning:', err?.message || err);
  }
}

async function saveBotReferralUserToNeon(user: BotReferralUser): Promise<void> {
  if (!neonPool) return;
  try {
    await neonPool.query(
      `INSERT INTO bot_referral_users (
         telegram_user_id, chat_id, username, first_name, last_name,
         referral_code, balance_usd, total_earned_usd, total_transferred_usd,
         total_transferred_coins, referrals_count, referred_by_telegram_id,
         referred_by_code, joined_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (telegram_user_id) DO UPDATE SET
         chat_id = EXCLUDED.chat_id,
         username = EXCLUDED.username,
         first_name = EXCLUDED.first_name,
         last_name = EXCLUDED.last_name,
         balance_usd = EXCLUDED.balance_usd,
         total_earned_usd = EXCLUDED.total_earned_usd,
         total_transferred_usd = EXCLUDED.total_transferred_usd,
         total_transferred_coins = EXCLUDED.total_transferred_coins,
         referrals_count = EXCLUDED.referrals_count,
         referred_by_telegram_id = COALESCE(bot_referral_users.referred_by_telegram_id, EXCLUDED.referred_by_telegram_id),
         referred_by_code = COALESCE(bot_referral_users.referred_by_code, EXCLUDED.referred_by_code),
         updated_at = EXCLUDED.updated_at`,
      [
        user.telegramUserId,
        String(user.chatId),
        user.username || null,
        user.firstName || null,
        user.lastName || null,
        user.referralCode,
        user.balanceUsd,
        user.totalEarnedUsd,
        user.totalTransferredUsd,
        user.totalTransferredCoins,
        user.referralsCount,
        user.referredByTelegramId || null,
        user.referredByCode || null,
        user.joinedAt,
        user.updatedAt || new Date().toISOString(),
      ]
    );
  } catch (err: any) {
    console.warn('Neon saveBotReferralUser warning:', err?.message || err);
  }
}

async function saveBotReferralEventToNeon(ev: BotReferralEvent): Promise<void> {
  if (!neonPool) return;
  try {
    await neonPool.query(
      `INSERT INTO bot_referral_events (
         id, referrer_telegram_id, referrer_code, new_user_telegram_id,
         new_user_name, new_user_username, referrer_bonus_usd, new_user_bonus_usd, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (id) DO NOTHING`,
      [
        ev.id,
        ev.referrerTelegramId,
        ev.referrerCode,
        ev.newUserTelegramId,
        ev.newUserName || null,
        ev.newUserUsername || null,
        ev.referrerBonusUsd,
        ev.newUserBonusUsd,
        ev.createdAt,
      ]
    );
  } catch (err: any) {
    console.warn('Neon saveBotReferralEvent warning:', err?.message || err);
  }
}

async function saveBotReferralTransferToNeon(tx: BotReferralTransfer): Promise<void> {
  if (!neonPool) return;
  try {
    await neonPool.query(
      `INSERT INTO bot_referral_transfers (
         id, telegram_user_id, telegram_name, telegram_username,
         target_user_id, target_display_id, target_user_name,
         amount_usd, coins_credited, coins_per_dollar,
         previous_coins_balance, new_coins_balance, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (id) DO NOTHING`,
      [
        tx.id,
        tx.telegramUserId,
        tx.telegramName || null,
        tx.telegramUsername || null,
        tx.targetUserId,
        tx.targetDisplayId,
        tx.targetUserName || null,
        tx.amountUsd,
        tx.coinsCredited,
        tx.coinsPerDollar,
        tx.previousCoinsBalance,
        tx.newCoinsBalance,
        tx.createdAt,
      ]
    );
  } catch (err: any) {
    console.warn('Neon saveBotReferralTransfer warning:', err?.message || err);
  }
}

export async function syncBotReferralsWithNeon(): Promise<void> {
  if (!neonPool) return;
  try {
    const store = getBotReferralStore();

    const settingsRes: any = await withTimeout(
      neonPool.query("SELECT * FROM bot_referral_settings WHERE id = 'default' LIMIT 1"),
      4000
    );
    if (settingsRes?.rows?.[0]) {
      const r = settingsRes.rows[0];
      store.settings = {
        enabled: typeof r.enabled === 'boolean' ? r.enabled : store.settings.enabled,
        newUserBonusUsd: roundUsd(Number(r.new_user_bonus_usd ?? store.settings.newUserBonusUsd)),
        referrerBonusUsd: roundUsd(Number(r.referrer_bonus_usd ?? store.settings.referrerBonusUsd)),
        coinsPerDollar: Number(r.coins_per_dollar ?? store.settings.coinsPerDollar) || 25000,
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : store.settings.updatedAt,
      };
    } else {
      await saveBotReferralSettingsToNeon(store.settings);
    }

    const usersRes: any = await withTimeout(
      neonPool.query('SELECT * FROM bot_referral_users ORDER BY joined_at DESC LIMIT 5000'),
      5000
    );
    if (usersRes?.rows) {
      const userMap = new Map<string, BotReferralUser>();
      for (const r of usersRes.rows) {
        userMap.set(String(r.telegram_user_id), {
          telegramUserId: String(r.telegram_user_id),
          chatId: String(r.chat_id),
          username: r.username || undefined,
          firstName: r.first_name || undefined,
          lastName: r.last_name || undefined,
          referralCode: String(r.referral_code),
          balanceUsd: roundUsd(Number(r.balance_usd || 0)),
          totalEarnedUsd: roundUsd(Number(r.total_earned_usd || 0)),
          totalTransferredUsd: roundUsd(Number(r.total_transferred_usd || 0)),
          totalTransferredCoins: Number(r.total_transferred_coins || 0),
          referralsCount: Number(r.referrals_count || 0),
          referredByTelegramId: r.referred_by_telegram_id || null,
          referredByCode: r.referred_by_code || null,
          joinedAt: r.joined_at ? new Date(r.joined_at).toISOString() : new Date().toISOString(),
          updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
        });
      }
      for (const lu of store.users) {
        if (!userMap.has(lu.telegramUserId)) {
          userMap.set(lu.telegramUserId, lu);
          await saveBotReferralUserToNeon(lu);
        }
      }
      store.users = Array.from(userMap.values());
    }

    const eventsRes: any = await withTimeout(
      neonPool.query('SELECT * FROM bot_referral_events ORDER BY created_at DESC LIMIT 2000'),
      4000
    );
    if (eventsRes?.rows) {
      const evMap = new Map<string, BotReferralEvent>();
      for (const r of eventsRes.rows) {
        evMap.set(r.id, {
          id: r.id,
          referrerTelegramId: String(r.referrer_telegram_id),
          referrerCode: String(r.referrer_code),
          newUserTelegramId: String(r.new_user_telegram_id),
          newUserName: r.new_user_name || '',
          newUserUsername: r.new_user_username || undefined,
          referrerBonusUsd: roundUsd(Number(r.referrer_bonus_usd || 0)),
          newUserBonusUsd: roundUsd(Number(r.new_user_bonus_usd || 0)),
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        });
      }
      for (const le of store.events) {
        if (!evMap.has(le.id)) {
          evMap.set(le.id, le);
          await saveBotReferralEventToNeon(le);
        }
      }
      store.events = Array.from(evMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    const txRes: any = await withTimeout(
      neonPool.query('SELECT * FROM bot_referral_transfers ORDER BY created_at DESC LIMIT 2000'),
      4000
    );
    if (txRes?.rows) {
      const txMap = new Map<string, BotReferralTransfer>();
      for (const r of txRes.rows) {
        txMap.set(r.id, {
          id: r.id,
          telegramUserId: String(r.telegram_user_id),
          telegramName: r.telegram_name || '',
          telegramUsername: r.telegram_username || undefined,
          targetUserId: String(r.target_user_id),
          targetDisplayId: String(r.target_display_id),
          targetUserName: r.target_user_name || '',
          amountUsd: roundUsd(Number(r.amount_usd || 0)),
          coinsCredited: Number(r.coins_credited || 0),
          coinsPerDollar: Number(r.coins_per_dollar || 25000),
          previousCoinsBalance: Number(r.previous_coins_balance || 0),
          newCoinsBalance: Number(r.new_coins_balance || 0),
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        });
      }
      for (const lt of store.transfers) {
        if (!txMap.has(lt.id)) {
          txMap.set(lt.id, lt);
          await saveBotReferralTransferToNeon(lt);
        }
      }
      store.transfers = Array.from(txMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    saveBotReferralStore(store);
  } catch (err: any) {
    console.warn('Neon syncBotReferralsWithNeon warning:', err?.message || err);
  }
}

export function getBotReferralUser(telegramUserId: number | string): BotReferralUser | null {
  const uid = String(telegramUserId);
  const store = getBotReferralStore();
  return store.users.find((u) => u.telegramUserId === uid) || null;
}

export function registerOrUpdateBotUser(params: {
  telegramUserId: number | string;
  chatId: number | string;
  username?: string;
  firstName?: string;
  lastName?: string;
  startReferralCode?: string;
}): {
  user: BotReferralUser;
  isNewUser: boolean;
  referralApplied: boolean;
  referralDisabled?: boolean;
  referrer?: BotReferralUser;
  newUserBonusUsd?: number;
  referrerBonusUsd?: number;
} {
  const uid = String(params.telegramUserId);
  const chatId = String(params.chatId);
  const cleanUsername = params.username ? params.username.replace(/^@/, '').trim() : undefined;
  const store = getBotReferralStore();

  const existing = store.users.find((u) => u.telegramUserId === uid);
  if (existing) {
    let changed = false;
    if (existing.chatId !== chatId) { existing.chatId = chatId; changed = true; }
    if (cleanUsername && existing.username !== cleanUsername) { existing.username = cleanUsername; changed = true; }
    if (params.firstName && existing.firstName !== params.firstName) { existing.firstName = params.firstName; changed = true; }
    if (params.lastName !== undefined && existing.lastName !== params.lastName) { existing.lastName = params.lastName; changed = true; }
    if (changed) {
      existing.updatedAt = new Date().toISOString();
      saveBotReferralStore(store);
      saveBotReferralUserToNeon(existing).catch(() => {});
    }
    return {
      user: existing,
      isNewUser: false,
      referralApplied: false,
    };
  }

  const usedCodes = new Set(store.users.map((u) => u.referralCode.toLowerCase()));
  const now = new Date().toISOString();
  const newUser: BotReferralUser = {
    telegramUserId: uid,
    chatId,
    username: cleanUsername,
    firstName: params.firstName || undefined,
    lastName: params.lastName || undefined,
    referralCode: generateBotReferralCode(usedCodes),
    balanceUsd: 0,
    totalEarnedUsd: 0,
    totalTransferredUsd: 0,
    totalTransferredCoins: 0,
    referralsCount: 0,
    referredByTelegramId: null,
    referredByCode: null,
    joinedAt: now,
    updatedAt: now,
  };

  const cleanStartCode = params.startReferralCode ? String(params.startReferralCode).trim().toLowerCase() : '';
  let referralApplied = false;
  let referralDisabled = false;
  let matchedReferrer: BotReferralUser | undefined;
  let appliedNewBonus = 0;
  let appliedRefBonus = 0;

  if (cleanStartCode) {
    if (!store.settings.enabled) {
      referralDisabled = true;
    } else {
      const referrer = store.users.find(
        (u) => u.referralCode.toLowerCase() === cleanStartCode && u.telegramUserId !== uid
      );
      if (referrer) {
        appliedNewBonus = roundUsd(store.settings.newUserBonusUsd);
        appliedRefBonus = roundUsd(store.settings.referrerBonusUsd);

        newUser.balanceUsd = roundUsd(newUser.balanceUsd + appliedNewBonus);
        newUser.totalEarnedUsd = roundUsd(newUser.totalEarnedUsd + appliedNewBonus);
        newUser.referredByTelegramId = referrer.telegramUserId;
        newUser.referredByCode = referrer.referralCode;

        referrer.balanceUsd = roundUsd(referrer.balanceUsd + appliedRefBonus);
        referrer.totalEarnedUsd = roundUsd(referrer.totalEarnedUsd + appliedRefBonus);
        referrer.referralsCount = (referrer.referralsCount || 0) + 1;
        referrer.updatedAt = now;

        const ev: BotReferralEvent = {
          id: `refev-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
          referrerTelegramId: referrer.telegramUserId,
          referrerCode: referrer.referralCode,
          newUserTelegramId: uid,
          newUserName: [params.firstName, params.lastName].filter(Boolean).join(' ') || cleanUsername || `User ${uid}`,
          newUserUsername: cleanUsername,
          referrerBonusUsd: appliedRefBonus,
          newUserBonusUsd: appliedNewBonus,
          createdAt: now,
        };
        store.events.unshift(ev);
        saveBotReferralEventToNeon(ev).catch(() => {});
        saveBotReferralUserToNeon(referrer).catch(() => {});

        matchedReferrer = referrer;
        referralApplied = true;
      }
    }
  }

  store.users.unshift(newUser);
  saveBotReferralStore(store);
  saveBotReferralUserToNeon(newUser).catch(() => {});

  return {
    user: newUser,
    isNewUser: true,
    referralApplied,
    referralDisabled,
    referrer: matchedReferrer,
    newUserBonusUsd: appliedNewBonus,
    referrerBonusUsd: appliedRefBonus,
  };
}

export async function lookupSoulXAccountForReferralTransfer(accountIdInput: string): Promise<{
  found: boolean;
  user?: {
    id: string;
    displayId: string;
    name: string;
    coinsBalance: number;
  };
}> {
  const clean = String(accountIdInput || '').trim();
  if (!clean) return { found: false };
  const lower = clean.toLowerCase();

  const users = getStoredUsers();
  const localMatch = users.find(
    (u) =>
      (u.displayId && u.displayId.toLowerCase() === lower) ||
      u.id.toLowerCase() === lower
  );

  if (neonPool) {
    try {
      const res: any = await withTimeout(
        neonPool.query(
          'SELECT id, display_id, name, coins_balance FROM profiles WHERE UPPER(display_id) = UPPER($1) OR id = $1 LIMIT 1',
          [clean]
        ),
        4000
      );
      if (res?.rows?.[0]) {
        const p = res.rows[0];
        return {
          found: true,
          user: {
            id: p.id,
            displayId: p.display_id || p.id,
            name: p.name || localMatch?.name || 'مستخدم Soul-X',
            coinsBalance: parseDbNumber(p.coins_balance, localMatch?.coinsBalance ?? 0),
          },
        };
      }
    } catch {}
  }

  if (localMatch) {
    return {
      found: true,
      user: {
        id: localMatch.id,
        displayId: localMatch.displayId || localMatch.id,
        name: localMatch.name || 'مستخدم Soul-X',
        coinsBalance: typeof localMatch.coinsBalance === 'number' ? localMatch.coinsBalance : 0,
      },
    };
  }

  return { found: false };
}

export async function transferBotReferralBalanceToSoulX(
  telegramUserId: number | string,
  targetAccountId: string
): Promise<{
  success: boolean;
  error?: 'DISABLED' | 'BOT_USER_NOT_FOUND' | 'INSUFFICIENT_BALANCE' | 'ACCOUNT_NOT_FOUND';
  amountUsd?: number;
  coinsCredited?: number;
  coinsPerDollar?: number;
  targetUser?: {
    id: string;
    displayId: string;
    name: string;
    previousCoins: number;
    newCoins: number;
  };
}> {
  const uid = String(telegramUserId);
  const store = getBotReferralStore();
  if (!store.settings.enabled) {
    return { success: false, error: 'DISABLED' };
  }

  const botUser = store.users.find((u) => u.telegramUserId === uid);
  if (!botUser) {
    return { success: false, error: 'BOT_USER_NOT_FOUND' };
  }

  const amountUsd = roundUsd(botUser.balanceUsd);
  const coinsPerDollar = Math.max(1, Math.round(store.settings.coinsPerDollar || 25000));
  const coinsCredited = Math.round(amountUsd * coinsPerDollar + Number.EPSILON);

  if (amountUsd <= 0 || coinsCredited <= 0) {
    return { success: false, error: 'INSUFFICIENT_BALANCE' };
  }

  const cleanTarget = String(targetAccountId || '').trim();
  const lowerTarget = cleanTarget.toLowerCase();
  const appUsers = getStoredUsers();
  let localAppUser = appUsers.find(
    (u) =>
      (u.displayId && u.displayId.toLowerCase() === lowerTarget) ||
      u.id.toLowerCase() === lowerTarget
  );

  let targetId = localAppUser?.id || '';
  let targetDisplayId = localAppUser?.displayId || localAppUser?.id || '';
  let targetName = localAppUser?.name || '';
  let previousCoins = typeof localAppUser?.coinsBalance === 'number' ? localAppUser.coinsBalance : 0;

  if (neonPool) {
    try {
      const res: any = await withTimeout(
        neonPool.query(
          'SELECT * FROM profiles WHERE UPPER(display_id) = UPPER($1) OR id = $1 LIMIT 1',
          [cleanTarget]
        ),
        4000
      );
      if (res?.rows?.[0]) {
        const p = res.rows[0];
        targetId = p.id;
        targetDisplayId = p.display_id || p.id;
        targetName = p.name || targetName || 'مستخدم Soul-X';
        previousCoins = parseDbNumber(p.coins_balance, previousCoins);
        if (localAppUser) {
          localAppUser.walletBalance = parseDbNumber(p.wallet_balance, localAppUser.walletBalance ?? 0);
          localAppUser.coinsBalance = previousCoins;
        } else {
          localAppUser = {
            id: p.id,
            displayId: targetDisplayId,
            email: p.email || `${p.id}@soul-x.com`,
            name: targetName,
            passwordHash: p.password_hash || hashPassword(DEFAULT_ADMIN_PASSWORD),
            createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
            walletBalance: parseDbNumber(p.wallet_balance, 0),
            coinsBalance: previousCoins,
          };
          appUsers.push(localAppUser);
        }
      }
    } catch {}
  }

  if (!localAppUser || !targetId) {
    return { success: false, error: 'ACCOUNT_NOT_FOUND' };
  }

  const newCoins = previousCoins + coinsCredited;
  const now = new Date().toISOString();

  localAppUser.coinsBalance = newCoins;
  localAppUser.updatedAt = now;
  saveStoredUsers(appUsers);

  await updateNeonProfileByIdentifier(targetId, {
    coinsBalance: newCoins,
  }).catch((err) => {
    console.warn('Neon referral transfer coins update warning:', err?.message || err);
  });

  botUser.balanceUsd = 0;
  botUser.totalTransferredUsd = roundUsd((botUser.totalTransferredUsd || 0) + amountUsd);
  botUser.totalTransferredCoins = (botUser.totalTransferredCoins || 0) + coinsCredited;
  botUser.updatedAt = now;

  const transferRecord: BotReferralTransfer = {
    id: `reftx-${Date.now()}-${crypto.randomInt(1000, 9999)}`,
    telegramUserId: uid,
    telegramName: [botUser.firstName, botUser.lastName].filter(Boolean).join(' ') || botUser.username || `User ${uid}`,
    telegramUsername: botUser.username,
    targetUserId: targetId,
    targetDisplayId,
    targetUserName: targetName,
    amountUsd,
    coinsCredited,
    coinsPerDollar,
    previousCoinsBalance: previousCoins,
    newCoinsBalance: newCoins,
    createdAt: now,
  };

  store.transfers.unshift(transferRecord);
  saveBotReferralStore(store);
  saveBotReferralUserToNeon(botUser).catch(() => {});
  saveBotReferralTransferToNeon(transferRecord).catch(() => {});

  try {
    createAndSaveUserNotification({
      userId: targetId,
      userDisplayId: targetDisplayId,
      type: 'agency_recharge',
      titleAr: '🎁 تحويل رصيد الإحالات من البوت 🪙',
      titleEn: '🎁 Bot Referral Balance Converted 🪙',
      messageAr: `تم تحويل $${amountUsd.toFixed(2)} من رصيد الإحالات في بوت تيليجرام إلى حسابك بقيمة +${coinsCredited.toLocaleString()} Coins.`,
      messageEn: `Converted $${amountUsd.toFixed(2)} from Telegram Bot referral balance into +${coinsCredited.toLocaleString()} Coins.`,
      metadata: {
        amount: coinsCredited,
        currency: 'coins',
        txId: transferRecord.id,
        previousBalance: previousCoins,
        newBalance: newCoins,
      },
    });
  } catch (notifErr) {
    console.warn('Error creating user notification for referral transfer:', notifErr);
  }

  return {
    success: true,
    amountUsd,
    coinsCredited,
    coinsPerDollar,
    targetUser: {
      id: targetId,
      displayId: targetDisplayId,
      name: targetName,
      previousCoins,
      newCoins,
    },
  };
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

async function refreshSession(
  refreshToken: string,
  hintUserId?: string,
  hintEmail?: string
): Promise<{
  valid: boolean;
  token?: string;
  refreshToken?: string;
  expiresAt?: string;
  refreshExpiresAt?: string;
  user?: any;
  isAdmin?: boolean;
  reason?: string;
}> {
  const cleanRf = typeof refreshToken === 'string' ? refreshToken.trim() : '';
  const sessions = getStoredSessions();
  const sessionIndex = cleanRf ? sessions.findIndex((s) => s.refreshToken === cleanRf) : -1;

  if (sessionIndex === -1) {
    // If sessions.json was lost or cleared, attempt session recovery if user exists in getStoredUsers()
    if (hintUserId || hintEmail) {
      const users = getStoredUsers();
      const cleanHintId = String(hintUserId || '').trim();
      const cleanHintEmail = String(hintEmail || '').trim().toLowerCase();
      const foundUser = users.find(
        (u) =>
          (cleanHintId && (u.id === cleanHintId || u.displayId === cleanHintId)) ||
          (cleanHintEmail && u.email.toLowerCase() === cleanHintEmail)
      );
      if (foundUser) {
        const tokens = createSession(
          foundUser.id,
          foundUser.email,
          foundUser.name,
          getAdminEmails().includes(foundUser.email.toLowerCase()),
          foundUser.displayId
        );
        return {
          valid: true,
          token: tokens.token,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt,
          refreshExpiresAt: tokens.refreshExpiresAt,
          user: {
            id: foundUser.id,
            displayId: foundUser.displayId,
            name: foundUser.name,
            email: foundUser.email,
            photoUrl: foundUser.photoUrl,
            createdAt: foundUser.createdAt,
            birthDate: foundUser.birthDate || null,
            gender: foundUser.gender || null,
            country: foundUser.country || null,
            walletBalance: foundUser.walletBalance ?? 0,
            coinsBalance: foundUser.coinsBalance ?? 0,
            isVerified: Boolean(foundUser.isVerified),
          },
          isAdmin: getAdminEmails().includes(foundUser.email.toLowerCase()),
        };
      }
    }

    if (!cleanRf) {
      return { valid: false, reason: 'رمز التجديد (Refresh Token) مفقود أو غير صالح' };
    }
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

  // Retrieve user record directly from Neon PostgreSQL first so redeploy restores real balances
  let userRecord: any = null;
  if (neonPool) {
    try {
      const profile = await getNeonProfileByIdentifier(session.userId || session.email);
      if (profile) {
        const users = getStoredUsers();
        const localIdx = users.findIndex(
          (u) => u.id === profile.id || u.id === session.userId || u.email.toLowerCase() === profile.email.toLowerCase()
        );
        if (localIdx >= 0) {
          users[localIdx].walletBalance = profile.walletBalance;
          users[localIdx].coinsBalance = profile.coinsBalance;
          users[localIdx].updatedAt = new Date().toISOString();
          saveStoredUsers(users);
        }
        const localUser = localIdx >= 0 ? users[localIdx] : null;
        userRecord = {
          id: profile.id,
          displayId: profile.display_id || localUser?.displayId || session.displayId,
          name: profile.name || localUser?.name || session.name,
          email: profile.email || session.email,
          photoUrl: profile.avatar_url || localUser?.photoUrl,
          createdAt: profile.created_at || localUser?.createdAt || session.createdAt,
          birthDate: profile.birth_date || localUser?.birthDate || null,
          gender: profile.gender || localUser?.gender || null,
          country: profile.country || localUser?.country || null,
          bio: profile.bio || localUser?.bio || getDefaultUserBio(),
          walletBalance: profile.walletBalance,
          coinsBalance: profile.coinsBalance,
          isVerified: Boolean(localUser?.isVerified ?? profile.isVerified),
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
        country: localUser.country || null,
        walletBalance: localUser.walletBalance ?? 0,
        coinsBalance: localUser.coinsBalance ?? 0,
        isVerified: Boolean(localUser.isVerified),
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
        country: null,
        walletBalance: 0,
        coinsBalance: 0,
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
  fallbackRefreshToken?: string,
  hintUserId?: string,
  hintEmail?: string
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
    if (fallbackRefreshToken || hintUserId || hintEmail) {
      return refreshSession(fallbackRefreshToken || '', hintUserId, hintEmail);
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

    if (neonPool) {
      try {
        const profile = await getNeonProfileByIdentifier(session.userId || session.email);

        if (profile) {
          const users = getStoredUsers();
          const localUser = users.find(
            (u) =>
              u.id === session.userId ||
              u.id === profile.id ||
              (u.displayId && u.displayId === session.displayId) ||
              u.email.toLowerCase() === session.email.toLowerCase()
          );
          if (localUser) {
            let localDirty = checkAndExpireUserFreeze(localUser);
            if (localUser.walletBalance !== profile.walletBalance) {
              localUser.walletBalance = profile.walletBalance;
              localDirty = true;
            }
            if (localUser.coinsBalance !== profile.coinsBalance) {
              localUser.coinsBalance = profile.coinsBalance;
              localDirty = true;
            }
            if (localDirty) saveStoredUsers(users);
          }
          userRecord = {
            id: profile.id,
            displayId: profile.display_id || localUser?.displayId || session.displayId,
            name: profile.name || localUser?.name || session.name,
            email: profile.email || session.email,
            photoUrl: profile.avatar_url || localUser?.photoUrl,
            createdAt: profile.created_at || localUser?.createdAt || session.createdAt,
            birthDate: profile.birth_date || localUser?.birthDate || null,
            gender: profile.gender || localUser?.gender || null,
            country: profile.country || localUser?.country || null,
            bio: profile.bio || localUser?.bio || getDefaultUserBio(),
            walletBalance: profile.walletBalance,
            coinsBalance: profile.coinsBalance,
            twoFactorEnabled: Boolean(localUser?.twoFactorEnabled),
            isBanned: Boolean(localUser?.isBanned),
            bannedAt: localUser?.bannedAt || null,
            banReason: localUser?.banReason || null,
            isFrozen: Boolean(localUser?.isFrozen),
            frozenAt: localUser?.frozenAt || null,
            freezeDurationMinutes: localUser?.freezeDurationMinutes || null,
            freezeExpiresAt: localUser?.freezeExpiresAt || null,
            freezeReason: localUser?.freezeReason || null,
            isVerified: Boolean(localUser?.isVerified ?? profile.isVerified),
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
        if (checkAndExpireUserFreeze(localUser)) {
          saveStoredUsers(users);
        }
        userRecord = {
          id: localUser.id,
          displayId: localUser.displayId || session.displayId,
          name: localUser.name,
          email: localUser.email,
          photoUrl: localUser.photoUrl,
          createdAt: localUser.createdAt,
          birthDate: localUser.birthDate || null,
          gender: localUser.gender || null,
          country: localUser.country || null,
          bio: localUser.bio || getDefaultUserBio(),
          walletBalance: localUser.walletBalance ?? 0,
          coinsBalance: localUser.coinsBalance ?? 0,
          twoFactorEnabled: Boolean(localUser.twoFactorEnabled),
          isBanned: Boolean(localUser.isBanned),
          bannedAt: localUser.bannedAt || null,
          banReason: localUser.banReason || null,
          isFrozen: Boolean(localUser.isFrozen),
          frozenAt: localUser.frozenAt || null,
          freezeDurationMinutes: localUser.freezeDurationMinutes || null,
          freezeExpiresAt: localUser.freezeExpiresAt || null,
          freezeReason: localUser.freezeReason || null,
          isVerified: Boolean(localUser.isVerified),
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
          country: null,
          bio: getDefaultUserBio(),
          walletBalance: 0,
          coinsBalance: 0,
          twoFactorEnabled: false,
        };
      }
    }

    // Touch lastActiveAt
    session.lastActiveAt = new Date().toISOString();
    saveStoredSessions(sessions);

    const adminEmails = getAdminEmails();
    const isAdmin = Boolean(session.isAdmin || adminEmails.includes(session.email.toLowerCase()));
    if (userRecord) {
      userRecord.isAdmin = isAdmin;
    }

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
    const refreshRes = await refreshSession(fallbackRefreshToken, hintUserId, hintEmail);
    if (refreshRes.valid) return refreshRes;
  }

  // 3. Fallback recovery: if sessions.json was lost or reset (e.g. redeploy), reconstruct session from Neon or local database using hints
  if (hintUserId || hintEmail) {
    const cleanHintId = String(hintUserId || '').trim();
    const cleanHintEmail = String(hintEmail || '').trim().toLowerCase();
    const neonProf = neonPool
      ? await getNeonProfileByIdentifier(cleanHintId || cleanHintEmail).catch(() => null)
      : null;

    const users = getStoredUsers();
    let foundUser = users.find(
      (u) =>
        (cleanHintId && (u.id === cleanHintId || u.displayId === cleanHintId)) ||
        (cleanHintEmail && u.email.toLowerCase() === cleanHintEmail)
    );

    if (neonProf && !foundUser) {
      foundUser = {
        id: neonProf.id,
        displayId: neonProf.displayId || generateSoulXId(),
        email: neonProf.email,
        name: neonProf.name || 'مستخدم Soul-X',
        passwordHash: neonProf.passwordHash || hashPassword(DEFAULT_ADMIN_PASSWORD),
        createdAt: neonProf.createdAt ? new Date(neonProf.createdAt).toISOString() : new Date().toISOString(),
        birthDate: neonProf.birthDate || null,
        gender: (neonProf.gender as 'male' | 'female' | null) || null,
        country: neonProf.country || null,
        bio: neonProf.bio || undefined,
        walletBalance: neonProf.walletBalance,
        coinsBalance: neonProf.coinsBalance,
      };
      users.push(foundUser);
      saveStoredUsers(users);
    } else if (neonProf && foundUser) {
      foundUser.walletBalance = neonProf.walletBalance;
      foundUser.coinsBalance = neonProf.coinsBalance;
      saveStoredUsers(users);
    }

    if (foundUser) {
      const tokens = createSession(
        foundUser.id,
        foundUser.email,
        foundUser.name,
        getAdminEmails().includes(foundUser.email.toLowerCase()),
        foundUser.displayId
      );
      return {
        valid: true,
        token: tokens.token,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
        refreshExpiresAt: tokens.refreshExpiresAt,
        user: {
          id: foundUser.id,
          displayId: foundUser.displayId,
          name: foundUser.name,
          email: foundUser.email,
          photoUrl: foundUser.photoUrl,
          createdAt: foundUser.createdAt,
          birthDate: foundUser.birthDate || null,
          gender: foundUser.gender || null,
          country: foundUser.country || null,
          bio: foundUser.bio || getDefaultUserBio(),
          walletBalance: foundUser.walletBalance ?? 0,
          coinsBalance: foundUser.coinsBalance ?? 0,
        },
        isAdmin: getAdminEmails().includes(foundUser.email.toLowerCase()),
      };
    }
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
  isGift?: boolean;
  giftCost?: number;
  read?: boolean;
  senderName?: string;
  giftIcon?: string;
  giftName?: string;
  mediaType?: 'image' | 'audio' | 'text';
  mediaUrl?: string;
  audioDuration?: number;
}

interface StoredConversation {
  id: string;
  participants: string[];
  participantDetails?: Record<string, { id: string; displayId?: string; name: string; avatar?: string }>;
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
  readBy?: Record<string, string>;
  isRead?: boolean;
}

const FRIENDS_FILE = path.resolve(DATA_DIR, 'friends.json');
const MESSAGES_FILE = path.resolve(DATA_DIR, 'messages.json');
const MEDIA_DIR = path.resolve(DATA_DIR, 'media');

try {
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
} catch {}

function getMediaAssetBasePath(messageId: string): string {
  const hash = crypto.createHash('sha256').update(String(messageId || '')).digest('hex').slice(0, 32);
  return path.resolve(MEDIA_DIR, `msg_${hash}`);
}

function inferMediaType(rawUrl?: string | null, declaredType?: string | null): 'image' | 'audio' | 'text' | undefined {
  if (declaredType === 'image' || declaredType === 'audio' || declaredType === 'text') return declaredType;
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  const lower = rawUrl.toLowerCase();
  if (lower.startsWith('data:audio') || lower.startsWith('data:video/webm') || /\.(mp3|wav|m4a|webm|ogg|aac|opus)(\?|$)/.test(lower)) {
    return 'audio';
  }
  if (lower.startsWith('data:image') || /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/.test(lower)) {
    return 'image';
  }
  return undefined;
}

function parseDataUrlBuffer(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx <= 5) return null;
  const header = dataUrl.slice(5, commaIdx);
  const payload = dataUrl.slice(commaIdx + 1);
  const isBase64 = header.includes(';base64');
  const mimeType = header.split(';')[0].trim() || 'application/octet-stream';
  try {
    const buffer = isBase64 ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf-8');
    if (!buffer || buffer.length === 0) return null;
    return { mimeType, buffer };
  } catch {
    return null;
  }
}

function saveMediaAssetToDisk(messageId: string, rawUrl?: string | null): boolean {
  if (!messageId || !rawUrl || typeof rawUrl !== 'string' || !rawUrl.startsWith('data:')) return false;
  const parsed = parseDataUrlBuffer(rawUrl);
  if (!parsed) return false;
  try {
    if (!fs.existsSync(MEDIA_DIR)) {
      fs.mkdirSync(MEDIA_DIR, { recursive: true });
    }
    const base = getMediaAssetBasePath(messageId);
    fs.writeFileSync(`${base}.bin`, parsed.buffer);
    fs.writeFileSync(
      `${base}.json`,
      JSON.stringify({ messageId, mimeType: parsed.mimeType, size: parsed.buffer.length }),
      'utf-8'
    );
    return true;
  } catch (err) {
    console.warn('saveMediaAssetToDisk warning:', err);
    return false;
  }
}

function readMediaAssetFromDisk(messageId: string): { mimeType: string; buffer: Buffer } | null {
  if (!messageId) return null;
  try {
    const base = getMediaAssetBasePath(messageId);
    const binPath = `${base}.bin`;
    const metaPath = `${base}.json`;
    if (!fs.existsSync(binPath)) return null;
    const buffer = fs.readFileSync(binPath);
    let mimeType = 'application/octet-stream';
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        if (meta?.mimeType) mimeType = String(meta.mimeType);
      } catch {}
    }
    return { mimeType, buffer };
  } catch {
    return null;
  }
}

function deleteMediaAssetsForMessageIds(messageIds: string[]): void {
  for (const mid of messageIds) {
    if (!mid) continue;
    try {
      const base = getMediaAssetBasePath(mid);
      if (fs.existsSync(`${base}.bin`)) fs.unlinkSync(`${base}.bin`);
      if (fs.existsSync(`${base}.json`)) fs.unlinkSync(`${base}.json`);
    } catch {}
  }
}

function resolveExternalMediaUrl(messageId: string, rawUrl?: string | null, declaredType?: string | null): string | undefined {
  if (!rawUrl || typeof rawUrl !== 'string') return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('data:')) {
    // Ensure cached on disk for fast, reliable Range-capable delivery
    const base = getMediaAssetBasePath(messageId);
    if (!fs.existsSync(`${base}.bin`)) {
      saveMediaAssetToDisk(messageId, trimmed);
    }
    const t = inferMediaType(trimmed, declaredType) || 'image';
    return `/api/messages/media/${encodeURIComponent(messageId)}?t=${encodeURIComponent(t)}`;
  }
  return trimmed;
}

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
// Neon Database (PostgreSQL) Configuration & Status Endpoints
// ==========================================
export async function syncDatabaseFromNeon() {
  if (!neonPool) {
    return;
  }
  try {
    const res: any = await withTimeout(neonPool.query('SELECT * FROM profiles LIMIT 2000'), 5000);
    if (!res) return;
    verifiedNeonTables.profiles = true;
    const rows = res?.rows || [];
    const users = getStoredUsers();
    let changed = false;

    const deletedUserKeys = getDeletedUserKeys();
    // Also merge tombstones from Neon
    try {
      const tRes: any = await withTimeout(
        neonPool.query("SELECT deleted_identifier FROM tombstones WHERE entity_type = 'user'"),
        2500
      );
      if (tRes?.rows) {
        for (const t of tRes.rows) {
          if (t.deleted_identifier) {
            deletedUserKeys.add(String(t.deleted_identifier).trim().toLowerCase());
            recordDeletedUser(t.deleted_identifier);
          }
        }
      }
    } catch {}

    if (rows.length > 0) {
      for (const p of rows) {
        const idKey = String(p.id || '').trim().toLowerCase();
        const emailKey = String(p.email || '').trim().toLowerCase();
        const dispKey = String(p.display_id || '').trim().toLowerCase();

        // Skip & scrub any deleted or mock user
        if (deletedUserKeys.has(idKey) || deletedUserKeys.has(emailKey) || (dispKey && deletedUserKeys.has(dispKey))) {
          neonPool.query('DELETE FROM profiles WHERE id = $1 OR LOWER(email) = $2', [p.id, emailKey]).catch(() => {});
          continue;
        }

        // Note: node-postgres returns BIGINT as string (e.g. "50000"), so parseOptionalDbNumber MUST be used!
        const dbWallet = parseOptionalDbNumber(p.wallet_balance);
        const dbCoins = parseOptionalDbNumber(p.coins_balance);
        const normalizedBirth = p.birth_date
          ? (p.birth_date instanceof Date ? p.birth_date.toISOString().split('T')[0] : String(p.birth_date).split('T')[0])
          : null;

        let existing = users.find(
          (u) =>
            u.id === p.id ||
            (p.display_id && u.displayId === p.display_id) ||
            (p.email && u.email && u.email.toLowerCase() === p.email.toLowerCase())
        );

        if (!existing) {
          users.push({
            id: p.id,
            displayId: p.display_id || generateSoulXId(),
            email: (p.email || `${p.id}@soul-x.com`).toLowerCase(),
            name: p.name || 'مستخدم Soul-X',
            passwordHash: p.password_hash || hashPassword(DEFAULT_ADMIN_PASSWORD),
            photoUrl: p.avatar_url || undefined,
            birthDate: normalizedBirth,
            gender: p.gender || null,
            country: p.country || null,
            bio: p.bio || undefined,
            walletBalance: dbWallet ?? 0,
            coinsBalance: dbCoins ?? 0,
            createdAt: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString(),
            updatedAt: p.updated_at ? new Date(p.updated_at).toISOString() : undefined,
          });
          changed = true;
        } else {
          if (p.id && existing.id !== p.id && !existing.id.startsWith('admin-')) {
            existing.id = p.id;
            changed = true;
          }
          if (p.display_id && existing.displayId !== p.display_id) {
            existing.displayId = p.display_id;
            changed = true;
          }
          if (p.password_hash && existing.passwordHash !== p.password_hash) {
            existing.passwordHash = p.password_hash;
            changed = true;
          }
          if (p.name && existing.name !== p.name) {
            existing.name = p.name;
            changed = true;
          }
          if (p.avatar_url && existing.photoUrl !== p.avatar_url) {
            existing.photoUrl = p.avatar_url;
            changed = true;
          }
          if (dbWallet !== null && existing.walletBalance !== dbWallet) {
            existing.walletBalance = dbWallet;
            changed = true;
          }
          if (dbCoins !== null && existing.coinsBalance !== dbCoins) {
            existing.coinsBalance = dbCoins;
            changed = true;
          }
          if (normalizedBirth && existing.birthDate !== normalizedBirth) {
            existing.birthDate = normalizedBirth;
            changed = true;
          }
          if (p.gender && existing.gender !== p.gender) {
            existing.gender = p.gender;
            changed = true;
          }
          if (p.country && existing.country !== p.country) {
            existing.country = p.country;
            changed = true;
          }
          if (p.bio && existing.bio !== p.bio) {
            existing.bio = p.bio;
            changed = true;
          }
          if (p.updated_at) {
            existing.updatedAt = new Date(p.updated_at).toISOString();
          }
        }
      }
      if (changed) {
        saveStoredUsers(users);
        console.log(`✅ [Neon Database] Restored & synchronized ${rows.length} profiles & balances from Neon.`);
      }
    }

    // Bidirectional sync: Push any local registered users missing from Neon profiles up to Neon
    const neonEmails = new Set(rows.map((r: any) => String(r.email || '').toLowerCase().trim()));
    const neonIds = new Set(rows.map((r: any) => String(r.id || '').toLowerCase().trim()));
    const neonDisplayIds = new Set(rows.map((r: any) => String(r.display_id || '').toLowerCase().trim()));

    for (const u of users) {
      const uEmail = String(u.email || '').toLowerCase().trim();
      const uId = String(u.id || '').toLowerCase().trim();
      const uDisp = String(u.displayId || '').toLowerCase().trim();
      if (deletedUserKeys.has(uEmail) || deletedUserKeys.has(uId) || (uDisp && deletedUserKeys.has(uDisp))) {
        continue;
      }
      if (!neonEmails.has(uEmail) && !neonIds.has(uId) && (!uDisp || !neonDisplayIds.has(uDisp))) {
        await saveProfileToNeon(u).catch((err) => {
          console.warn('Neon user sync warning for', u.email, err?.message || err);
        });
      }
    }
  } catch (err) {
    console.warn('⚠️ [Persistence] Neon startup sync warning:', err);
  }
}
export async function syncMessagesWithNeon(): Promise<void> {
  if (!neonPool || !verifiedNeonTables.conversations || !verifiedNeonTables.messages) {
    return;
  }
  try {
    // 1. Fetch conversations from Neon
    const convRes: any = await withTimeout(
      neonPool.query('SELECT id, created_at, updated_at FROM conversations LIMIT 2000'),
      4000
    );
    const convRows = convRes?.rows || [];

    // 2. Fetch conversation participants
    const partRes: any = await withTimeout(
      neonPool.query('SELECT conversation_id, user_id FROM conversation_participants LIMIT 10000'),
      4000
    );
    const partRows = partRes?.rows || [];

    // 3. Fetch messages (generous timeout to handle media payloads reliably)
    const msgRes: any = await withTimeout(
      neonPool.query('SELECT id, conversation_id, sender_id, text, is_gift, gift_cost, created_at, sender_name, gift_icon, gift_name, read, media_type, media_url, audio_duration FROM messages ORDER BY created_at ASC LIMIT 20000'),
      25000
    );
    if (!msgRes) {
      console.warn('⚠️ [Persistence] Neon messages query timed out during startup sync.');
      return;
    }
    const msgRows = msgRes?.rows || [];

    const messagesData = getStoredMessagesData();
    let changed = false;

    // Index Neon participants and messages by conversation_id
    const partsByConv = new Map<string, string[]>();
    for (const p of partRows) {
      if (!partsByConv.has(p.conversation_id)) partsByConv.set(p.conversation_id, []);
      partsByConv.get(p.conversation_id)!.push(p.user_id);
    }

    const msgsByConv = new Map<string, any[]>();
    for (const m of msgRows) {
      if (!msgsByConv.has(m.conversation_id)) msgsByConv.set(m.conversation_id, []);
      msgsByConv.get(m.conversation_id)!.push(m);
    }

    // Merge Neon conversations into local JSON messagesData
    for (const c of convRows) {
      const convId = c.id;
      const neonParticipants = partsByConv.get(convId) || [];
      const neonMsgs = msgsByConv.get(convId) || [];

      let localConv = messagesData.conversations.find((lc) => lc.id === convId);
      if (!localConv) {
        localConv = {
          id: convId,
          participants: neonParticipants,
          createdAt: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
          updatedAt: c.updated_at ? new Date(c.updated_at).toISOString() : new Date().toISOString(),
          messages: [],
        };
        messagesData.conversations.push(localConv);
        changed = true;
      }

      for (const p of neonParticipants) {
        if (!localConv.participants.includes(p)) {
          localConv.participants.push(p);
          changed = true;
        }
      }

      const existingMsgIds = new Set(localConv.messages.map((m) => m.id));
      for (const nm of neonMsgs) {
        if (nm.media_url && typeof nm.media_url === 'string' && nm.media_url.startsWith('data:')) {
          saveMediaAssetToDisk(nm.id, nm.media_url);
        }
        if (!existingMsgIds.has(nm.id)) {
          localConv.messages.push({
            id: nm.id,
            conversationId: convId,
            senderId: nm.sender_id,
            text: nm.text,
            isGift: Boolean(nm.is_gift),
            giftCost: nm.gift_cost ? Number(nm.gift_cost) : undefined,
            createdAt: nm.created_at ? new Date(nm.created_at).toISOString() : new Date().toISOString(),
            senderName: nm.sender_name || undefined,
            giftIcon: nm.gift_icon || undefined,
            giftName: nm.gift_name || undefined,
            mediaType: inferMediaType(nm.media_url, nm.media_type),
            mediaUrl: nm.media_url || undefined,
            audioDuration: typeof nm.audio_duration === 'number' || (nm.audio_duration !== null && nm.audio_duration !== undefined && Number.isFinite(Number(nm.audio_duration))) ? Math.round(Number(nm.audio_duration)) : undefined,
          });
          existingMsgIds.add(nm.id);
          changed = true;
        } else {
          const existingLocal = localConv.messages.find((m) => m.id === nm.id);
          if (existingLocal && !existingLocal.mediaUrl && nm.media_url) {
            existingLocal.mediaUrl = nm.media_url;
            existingLocal.mediaType = inferMediaType(nm.media_url, nm.media_type) || existingLocal.mediaType;
            existingLocal.audioDuration = nm.audio_duration !== null && nm.audio_duration !== undefined && Number.isFinite(Number(nm.audio_duration)) ? Math.round(Number(nm.audio_duration)) : existingLocal.audioDuration;
            changed = true;
          }
        }
      }
    }

    // Bidirectional sync: Push any local conversations and messages (or missing media_url) to Neon
    for (const lc of messagesData.conversations) {
      const hasInNeon = convRows.some((c: any) => c.id === lc.id);
      if (!hasInNeon) {
        await neonPool.query(
          `INSERT INTO conversations (id, created_at, updated_at)
           VALUES ($1, $2, $3)
           ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at`,
          [lc.id, lc.createdAt || new Date().toISOString(), lc.updatedAt || new Date().toISOString()]
        ).catch(() => {});

        for (const p of lc.participants) {
          if (p && !p.startsWith('conv-')) {
            await neonPool.query(
              `INSERT INTO conversation_participants (id, conversation_id, user_id, created_at)
               VALUES ($1, $2, $3, NOW())
               ON CONFLICT (conversation_id, user_id) DO NOTHING`,
              [crypto.randomUUID(), lc.id, p]
            ).catch(() => {});
          }
        }
      }

      const neonConvMsgs = new Map<string, any>((msgsByConv.get(lc.id) || []).map((m: any) => [m.id, m]));
      for (const m of lc.messages) {
        if (m.mediaUrl && m.mediaUrl.startsWith('data:')) {
          saveMediaAssetToDisk(m.id, m.mediaUrl);
        }
        const safeDuration = typeof m.audioDuration === 'number' && Number.isFinite(m.audioDuration)
          ? Math.max(0, Math.round(m.audioDuration))
          : null;
        const safeMediaType = inferMediaType(m.mediaUrl, m.mediaType) || null;
        const existingNeon = neonConvMsgs.get(m.id);

        if (!existingNeon) {
          await neonPool.query(
            `INSERT INTO messages (id, conversation_id, sender_id, text, is_gift, gift_cost, created_at, sender_name, gift_icon, gift_name, media_type, media_url, audio_duration)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (id) DO UPDATE SET
               media_type = COALESCE(EXCLUDED.media_type, messages.media_type),
               media_url = COALESCE(EXCLUDED.media_url, messages.media_url),
               audio_duration = COALESCE(EXCLUDED.audio_duration, messages.audio_duration)`,
            [
              m.id,
              lc.id,
              m.senderId,
              m.text,
              Boolean(m.isGift),
              m.giftCost ? Number(m.giftCost) : null,
              m.createdAt || new Date().toISOString(),
              m.senderName || null,
              m.giftIcon || null,
              m.giftName || null,
              safeMediaType,
              m.mediaUrl || null,
              safeDuration,
            ]
          ).catch((err) => {
            console.warn('syncMessagesWithNeon insert warning:', err?.message || err);
          });
        } else if (!existingNeon.media_url && m.mediaUrl) {
          await neonPool.query(
            `UPDATE messages
             SET media_type = COALESCE($2, media_type),
                 media_url = $3,
                 audio_duration = COALESCE($4, audio_duration)
             WHERE id = $1`,
            [m.id, safeMediaType, m.mediaUrl, safeDuration]
          ).catch((err) => {
            console.warn('syncMessagesWithNeon backfill media warning:', err?.message || err);
          });
        }
      }
    }

    if (changed) {
      saveStoredMessagesData(messagesData);
      console.log(`✅ [Neon Database] Restored & synchronized messages and conversations from Neon.`);
    }
  } catch (err: any) {
    console.warn('⚠️ [Persistence] Neon messages sync warning:', err?.message || err);
  }
}

export const syncDatabaseFromSupabase = syncDatabaseFromNeon;
export const syncDataWithNeon = async () => {
  await syncDatabaseFromNeon();
  await syncAgentsWithNeon();
  await syncMessagesWithNeon();
};

app.get('/api/neon/config', (_req: Request, res: Response) => {
  const url = (process.env.DATABASE_URL1 || DATABASE_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || '').trim();
  let host = '';
  let database = '';
  if (url) {
    try {
      const parsed = new URL(url.replace('postgresql://', 'http://').replace('postgres://', 'http://'));
      host = parsed.hostname;
      database = parsed.pathname.replace(/^\//, '');
    } catch {}
  }
  return res.json({
    configured: Boolean(url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))),
    databaseUrl: url,
    envVarName: 'DATABASE_URL1',
    host,
    database,
  });
});

app.post(['/api/neon/config', '/api/neon/save-config'], async (req: Request, res: Response) => {
  try {
    const { databaseUrl } = req.body;
    if (!databaseUrl) {
      return res.status(400).json({
        success: false,
        message: 'رابط الاتصال بـ Neon (DATABASE_URL1) مطلوب',
      });
    }

    const cleanUrl = String(databaseUrl).trim();
    if (!cleanUrl.startsWith('postgres://') && !cleanUrl.startsWith('postgresql://')) {
      return res.status(400).json({
        success: false,
        message: 'رابط Neon يجب أن يبدأ بـ postgresql:// أو postgres://',
      });
    }

    // Persist to data/neon_config.json
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(
        NEON_CONFIG_FILE,
        JSON.stringify(
          {
            databaseUrl: cleanUrl,
            updatedAt: new Date().toISOString(),
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch (cfgErr) {
      console.warn('Could not write data/neon_config.json:', cfgErr);
    }

    // Persist to .env using only DATABASE_URL1
    try {
      process.env.DATABASE_URL1 = cleanUrl;
      DATABASE_URL = cleanUrl;
      const envPath = path.resolve(__dirname, '.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';
      const updateOrAddEnv = (key: string, val: string) => {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${key}=${val}`);
        } else {
          envContent += `\n${key}=${val}`;
        }
      };

      updateOrAddEnv('DATABASE_URL1', cleanUrl);

      // Clean old database environment variables so ONLY DATABASE_URL1 remains
      envContent = envContent.replace(/^DATABASE_URL=.*\r?\n?/gm, '');
      envContent = envContent.replace(/^NEON_DATABASE_URL=.*\r?\n?/gm, '');
      envContent = envContent.replace(/^SUPABASE_URL=.*\r?\n?/gm, '');
      envContent = envContent.replace(/^SUPABASE_ANON_KEY=.*\r?\n?/gm, '');
      envContent = envContent.replace(/^SUPABASE_SERVICE_ROLE_KEY=.*\r?\n?/gm, '');
      envContent = envContent.replace(/^VITE_SUPABASE_URL=.*\r?\n?/gm, '');
      envContent = envContent.replace(/^VITE_SUPABASE_ANON_KEY=.*\r?\n?/gm, '');

      fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');
    } catch (envErr) {
      console.warn('Could not persist to .env file:', envErr);
    }

    // Connect to Neon
    const connected = await initNeonClient(cleanUrl);

    if (connected) {
      await autoMigrateNeonSchema().catch(() => {});
      await verifyAllNeonTables().catch(() => {});
      await syncDatabaseFromNeon().catch(() => {});
      await syncAgentsWithNeon().catch(() => {});
    }

    return res.json({
      success: true,
      connected,
      message: connected
        ? 'تم الاتصال بقاعدة بيانات Neon PostgreSQL بنجاح وتشغيل المزامنة!'
        : 'تم حفظ الرابط ولكن تعذر الاتصال، يرجى التأكد من صحة بيانات الاتصال وكلمة المرور.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء ضبط Neon Database' });
  }
});

app.post('/api/neon/test-connection', async (req: Request, res: Response) => {
  const targetUrl = (req.body.databaseUrl || DATABASE_URL || '').trim();
  if (!targetUrl) {
    return res.status(400).json({ success: false, message: 'رابط قاعدة بيانات Neon غير محدد' });
  }

  const startTime = Date.now();
  let tempPool: pg.Pool | null = null;
  try {
    tempPool = new Pool({
      connectionString: targetUrl,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
    const result = await withTimeout(tempPool.query('SELECT NOW() as now, version() as version'), 4000);
    const latencyMs = Math.max(1, Date.now() - startTime);

    if (result && result.rows && result.rows.length > 0) {
      return res.json({
        success: true,
        latencyMs,
        version: result.rows[0].version,
        timestamp: result.rows[0].now,
        message: `تم الاتصال بقاعدة بيانات Neon PostgreSQL بنجاح (${latencyMs}ms)`,
      });
    } else {
      return res.status(504).json({ success: false, message: 'انتهت مهلة الاتصال بـ Neon (Timeout)' });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'فشل الاتصال بقاعدة بيانات Neon' });
  } finally {
    if (tempPool) {
      tempPool.end().catch(() => {});
    }
  }
});

app.get('/api/neon/schema-sql', (_req: Request, res: Response) => {
  try {
    const schemaPath = path.resolve(__dirname, 'data', 'neon_schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf-8');
      return res.json({ success: true, sql });
    }
  } catch (err: any) {
    console.warn('Error reading neon schema sql:', err);
  }
  return res.json({ success: false, message: 'ملف Schema غير موجود' });
});

app.post('/api/neon/migrate', async (_req: Request, res: Response) => {
  if (!neonPool) {
    return res.status(400).json({ success: false, message: 'قاعدة بيانات Neon غير متصلة' });
  }
  try {
    const migrationRes = await autoMigrateNeonSchema();
    await verifyAllNeonTables();
    return res.json({
      success: migrationRes.success,
      message: migrationRes.success
        ? 'تم تنفيذ الـ Schema وإنشاء كافة الجداول العشرة والفهارس في Neon بنجاح!'
        : migrationRes.error || 'خطأ أثناء تطبيق Schema',
      tables: verifiedNeonTables,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء ترحيل الجداول' });
  }
});

app.post('/api/neon/sync', async (_req: Request, res: Response) => {
  try {
    await syncDatabaseFromNeon();
    await syncAgentsWithNeon();
    await verifyAllNeonTables();
    return res.json({
      success: true,
      message: 'تمت المزامنة الثنائية الكاملة مع قاعدة بيانات Neon بنجاح!',
      usersCount: getStoredUsers().length,
      agentsCount: getStoredAgents().length,
      verifiedTables: verifiedNeonTables,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء المزامنة' });
  }
});

app.get('/api/neon/status', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  if (!neonPool) {
    return res.json({
      configured: false,
      connected: false,
      databaseConnected: false,
      healthy: false,
      latencyMs: 0,
      databaseUrl: DATABASE_URL || '',
      tables: {
        profiles: false,
        agents: false,
        friends: false,
        friend_requests: false,
        conversations: false,
        conversation_participants: false,
        messages: false,
        agency_withdrawals: false,
        agency_transactions: false,
        tombstones: false,
      },
      counts: {
        profiles: getStoredUsers().length,
        agents: getStoredAgents().length,
        friends: getStoredFriendsData().friends.length,
        friend_requests: getStoredFriendsData().requests.length,
        tombstones: getDeletedAgentKeys().size,
      },
      message: 'بيانات Neon PostgreSQL غير محددة بعد في DATABASE_URL',
    });
  }

  let dbVersion = 'PostgreSQL (Neon)';
  try {
    const vRes = await withTimeout(neonPool.query('SELECT version() as version'), 2000);
    if (vRes?.rows?.[0]?.version) {
      dbVersion = vRes.rows[0].version;
    }
  } catch {}

  const [p, a, f, fr, c, cp, m, w, tx, t] = await Promise.all([
    checkNeonTableLive('profiles'),
    checkNeonTableLive('agents'),
    checkNeonTableLive('friends'),
    checkNeonTableLive('friend_requests'),
    checkNeonTableLive('conversations'),
    checkNeonTableLive('conversation_participants'),
    checkNeonTableLive('messages'),
    checkNeonTableLive('agency_withdrawals'),
    checkNeonTableLive('agency_transactions'),
    checkNeonTableLive('tombstones'),
  ]);

  verifiedNeonTables.profiles = p.ok;
  verifiedNeonTables.agents = a.ok;
  verifiedNeonTables.friends = f.ok;
  verifiedNeonTables.friend_requests = fr.ok;
  verifiedNeonTables.conversations = c.ok;
  verifiedNeonTables.conversation_participants = cp.ok;
  verifiedNeonTables.messages = m.ok;
  verifiedNeonTables.agency_withdrawals = w.ok;
  verifiedNeonTables.agency_transactions = tx.ok;
  verifiedNeonTables.tombstones = t.ok;

  const verifiedTables: string[] = [];
  if (p.ok) verifiedTables.push('profiles');
  if (a.ok) verifiedTables.push('agents');
  if (f.ok) verifiedTables.push('friends');
  if (fr.ok) verifiedTables.push('friend_requests');
  if (c.ok) verifiedTables.push('conversations');
  if (cp.ok) verifiedTables.push('conversation_participants');
  if (m.ok) verifiedTables.push('messages');
  if (w.ok) verifiedTables.push('agency_withdrawals');
  if (tx.ok) verifiedTables.push('agency_transactions');
  if (t.ok) verifiedTables.push('tombstones');

  const latencyMs = Math.max(1, Date.now() - startTime);
  const isHealthy = Boolean(neonPool);
  const isAllTablesReady = p.ok && a.ok;

  return res.json({
    configured: true,
    connected: isHealthy,
    databaseConnected: isHealthy,
    healthy: isHealthy,
    latencyMs,
    version: dbVersion,
    databaseUrl: DATABASE_URL,
    tables: {
      profiles: p.ok,
      agents: a.ok,
      friends: f.ok,
      friend_requests: fr.ok,
      conversations: c.ok,
      conversation_participants: cp.ok,
      messages: m.ok,
      agency_withdrawals: w.ok,
      agency_transactions: tx.ok,
      tombstones: t.ok,
    },
    counts: {
      profiles: p.ok ? p.count : getStoredUsers().length,
      agents: a.ok ? a.count : getStoredAgents().length,
      friends: f.ok ? f.count : getStoredFriendsData().friends.length,
      friend_requests: fr.ok ? fr.count : getStoredFriendsData().requests.length,
      conversations: c.ok ? c.count : 0,
      messages: m.ok ? m.count : 0,
      agency_withdrawals: w.ok ? w.count : getStoredAgencyWithdrawals().length,
      agency_transactions: tx.ok ? tx.count : getStoredAgencyTransactions().length,
      tombstones: t.ok ? t.count : getDeletedAgentKeys().size,
    },
    tablesVerified: verifiedTables,
    isAllTablesReady,
    message: isAllTablesReady
      ? `متصل بقاعدة بيانات Neon PostgreSQL بنجاح (${verifiedTables.length}/10 جداول مفحوصة ومؤكدة)`
      : isHealthy
      ? 'متصل بـ Neon! اضغط زر إنشاء وتحديث الجداول لإنشاء كافة جداول قاعدة البيانات.'
      : 'تعذر الاتصال بقاعدة بيانات Neon.',
  });
});

// Backward compatibility stubs for legacy Supabase calls
app.get('/api/supabase/config', (_req: Request, res: Response) => {
  return res.json({
    unlinked: true,
    configured: false,
    message: 'تم فك الربط بـ Supabase بنجاح والانتقال إلى Neon PostgreSQL',
  });
});
app.post('/api/supabase/config', (_req: Request, res: Response) => {
  return res.json({
    success: false,
    unlinked: true,
    message: 'تم إلغاء Supabase بالكامل. يرجى استخدام إعدادات Neon Database.',
  });
});
app.get('/api/supabase/status', async (req: Request, res: Response) => {
  return res.json({
    unlinked: true,
    configured: false,
    connected: false,
    databaseConnected: false,
    healthy: false,
    message: 'تم فك الربط بـ Supabase. قاعدة البيانات المعتمدة هي Neon PostgreSQL.',
  });
});
app.get('/api/supabase/migration-sql', (_req: Request, res: Response) => {
  try {
    const schemaPath = path.resolve(__dirname, 'data', 'neon_schema.sql');
    if (fs.existsSync(schemaPath)) {
      return res.json({ success: true, sql: fs.readFileSync(schemaPath, 'utf-8') });
    }
  } catch {}
  return res.json({ success: false, message: 'ملف Schema غير موجود' });
});
app.post('/api/supabase/sync', async (_req: Request, res: Response) => {
  await syncDatabaseFromNeon().catch(() => {});
  await syncAgentsWithNeon().catch(() => {});
  return res.json({ success: true, message: 'تمت المزامنة بنجاح مع Neon Database' });
});

// Get Wallet Balance from Neon PostgreSQL & Local Cache (always real balance)
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
    const isAdmin =
      (lookupEmail && adminEmails.includes(lookupEmail)) ||
      lookupId === 'admin-1001' ||
      lookupId === 'admin-1002';

    let neonProfile: any = null;
    if (neonPool) {
      neonProfile = await getNeonProfileByIdentifier(lookupId || lookupEmail);
    }

    const users = getStoredUsers();
    const u = users.find(
      (x) =>
        (lookupId && (x.id === lookupId || x.displayId === lookupId)) ||
        (lookupEmail && x.email.toLowerCase() === lookupEmail) ||
        (neonProfile && (x.id === neonProfile.id || (x.email && neonProfile.email && x.email.toLowerCase() === neonProfile.email.toLowerCase())))
    );

    let balance: number;
    let coinsBalance: number;

    if (neonProfile) {
      balance = parseDbNumber(neonProfile.wallet_balance, isAdmin ? 99999 : 0);
      coinsBalance = parseDbNumber(neonProfile.coins_balance, isAdmin ? 100000 : 0);

      if (u) {
        if (u.walletBalance !== balance || u.coinsBalance !== coinsBalance) {
          u.walletBalance = balance;
          u.coinsBalance = coinsBalance;
          u.updatedAt = new Date().toISOString();
          saveStoredUsers(users);
        }
      } else {
        users.push({
          id: neonProfile.id,
          displayId: neonProfile.displayId || neonProfile.id,
          email: (neonProfile.email || lookupEmail || `${neonProfile.id}@soul-x.com`).toLowerCase(),
          name: neonProfile.name || 'مستخدم Soul-X',
          passwordHash: neonProfile.passwordHash || hashPassword(DEFAULT_ADMIN_PASSWORD),
          createdAt: neonProfile.createdAt || new Date().toISOString(),
          birthDate: neonProfile.birthDate || null,
          gender: neonProfile.gender || null,
          country: neonProfile.country || null,
          photoUrl: neonProfile.photoUrl || undefined,
          bio: neonProfile.bio || undefined,
          walletBalance: balance,
          coinsBalance,
        });
        saveStoredUsers(users);
      }
    } else if (u) {
      balance = typeof u.walletBalance === 'number' ? u.walletBalance : (isAdmin ? 99999 : 0);
      coinsBalance = typeof u.coinsBalance === 'number' ? u.coinsBalance : (isAdmin ? 100000 : 0);
    } else {
      balance = isAdmin ? 99999 : 0;
      coinsBalance = isAdmin ? 100000 : 0;
    }

    return res.json({
      success: true,
      balance,
      coinsBalance,
      userId: neonProfile?.id || u?.id || lookupId,
      displayId: neonProfile?.displayId || u?.displayId || lookupId,
      email: neonProfile?.email || u?.email || lookupEmail,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطأ في جلب الرصيد' });
  }
});

// Update Wallet Balance (Diamonds) in Neon PostgreSQL & Local Cache
app.post('/api/wallet/update', async (req: Request, res: Response) => {
  try {
    const { userId, displayId, email, amount, balance } = req.body;
    if (!userId && !displayId && !email) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }

    const cleanUserId = String(userId || displayId || email).trim();
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';
    const cleanDisplayId = displayId ? String(displayId).trim() : '';

    const adminEmails = getAdminEmails();
    const isAdmin =
      (cleanEmail && adminEmails.includes(cleanEmail)) ||
      cleanUserId === 'admin-1001' ||
      cleanUserId === 'admin-1002';

    const users = getStoredUsers();
    const u = users.find(
      (x) =>
        x.id === cleanUserId ||
        x.displayId === cleanUserId ||
        (cleanDisplayId && x.displayId === cleanDisplayId) ||
        (cleanEmail && x.email.toLowerCase() === cleanEmail) ||
        x.email.toLowerCase() === cleanUserId.toLowerCase()
    );

    let currentBalance = typeof u?.walletBalance === 'number' ? u.walletBalance : (isAdmin ? 99999 : 0);

    if (neonPool) {
      const profile = await getNeonProfileByIdentifier(cleanUserId || cleanDisplayId || cleanEmail);
      if (profile) {
        currentBalance = parseDbNumber(profile.wallet_balance, currentBalance);
      }
    }

    let newBalance: number;
    if (typeof balance === 'number' && Number.isFinite(balance)) {
      newBalance = Math.max(0, Math.round(balance));
    } else if (typeof amount === 'number' && Number.isFinite(amount)) {
      newBalance = Math.max(0, Math.round(currentBalance + amount));
    } else {
      newBalance = currentBalance;
    }

    const nowIso = new Date().toISOString();
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
        x.updatedAt = nowIso;
        found = true;
      }
    });
    if (!found) {
      users.push({
        id: cleanUserId,
        displayId: cleanDisplayId || (cleanUserId.startsWith('S-') ? cleanUserId : generateSoulXId()),
        email: cleanEmail || `${cleanUserId}@soul-x.com`,
        name: `مستخدم ${cleanUserId.slice(0, 8)}`,
        passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
        createdAt: nowIso,
        updatedAt: nowIso,
        walletBalance: newBalance,
        coinsBalance: isAdmin ? 100000 : 0,
      });
    }
    saveStoredUsers(users);

    if (neonPool) {
      await updateNeonProfileByIdentifier(u?.id || cleanUserId, {
        walletBalance: newBalance,
      });
      if (cleanEmail && cleanEmail !== (u?.id || cleanUserId)) {
        await updateNeonProfileByIdentifier(cleanEmail, {
          walletBalance: newBalance,
        });
      }
    }

    broadcastChatMessage([cleanUserId, u?.id, u?.displayId, cleanDisplayId], {
      type: 'balance_update',
      currency: 'diamonds',
      balance: newBalance,
      userId: u?.id || cleanUserId,
      displayId: u?.displayId || cleanDisplayId,
    });

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

// Update Coins Balance in Neon PostgreSQL & Local Cache
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

    const adminEmails = getAdminEmails();
    const isAdmin =
      (u?.email && adminEmails.includes(u.email.toLowerCase())) ||
      (cleanEmail && adminEmails.includes(cleanEmail)) ||
      cleanUserId === 'admin-1001' ||
      cleanUserId === 'admin-1002';

    let currentCoins = typeof u?.coinsBalance === 'number' ? u.coinsBalance : (isAdmin ? 100000 : 0);

    if (neonPool) {
      const profile = await getNeonProfileByIdentifier(cleanUserId || cleanDisplayId || cleanEmail);
      if (profile) {
        currentCoins = parseDbNumber(profile.coins_balance, currentCoins);
      }
    }

    let newCoins: number;
    if (typeof balance === 'number' && Number.isFinite(balance)) {
      newCoins = Math.max(0, Math.round(balance));
    } else if (typeof amount === 'number' && Number.isFinite(amount)) {
      newCoins = Math.max(0, Math.round(currentCoins + amount));
    } else {
      newCoins = currentCoins;
    }

    const nowIso = new Date().toISOString();
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
        x.updatedAt = nowIso;
        found = true;
      }
    });

    if (!found) {
      users.push({
        id: cleanUserId,
        displayId: cleanDisplayId || (cleanUserId.startsWith('S-') ? cleanUserId : generateSoulXId()),
        email: cleanEmail || `${cleanUserId}@soul-x.com`,
        name: `مستخدم ${cleanUserId.slice(0, 8)}`,
        passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
        createdAt: nowIso,
        updatedAt: nowIso,
        walletBalance: isAdmin ? 99999 : 0,
        coinsBalance: newCoins,
      });
    }
    saveStoredUsers(users);

    if (neonPool) {
      await updateNeonProfileByIdentifier(u?.id || cleanUserId, {
        coinsBalance: newCoins,
      });
      if (cleanEmail && cleanEmail !== (u?.id || cleanUserId)) {
        await updateNeonProfileByIdentifier(cleanEmail, {
          coinsBalance: newCoins,
        });
      }
    }

    broadcastChatMessage([cleanUserId, u?.id, u?.displayId, cleanDisplayId], {
      type: 'balance_update',
      currency: 'coins',
      balance: newCoins,
      userId: u?.id || cleanUserId,
      displayId: u?.displayId || cleanDisplayId,
    });

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
// كل 50,000 Diamonds تساوي 25,000 Coins (الحد الأدنى للتحويل: 16,000 Diamonds ورقم زوجي)
app.post('/api/wallet/convert-to-coins', async (req: Request, res: Response) => {
  try {
    const { userId, displayId, email, diamondsAmount } = req.body;
    if (!userId && !displayId && !email) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }

    const dAmount = Math.floor(Number(diamondsAmount));
    if (isNaN(dAmount) || dAmount < 16000) {
      return res.status(400).json({
        success: false,
        message: 'الحد الأدنى لتحويل الماسات إلى كوينز هو 16,000 ماسة.',
      });
    }

    if (dAmount % 2 !== 0) {
      return res.status(400).json({
        success: false,
        message: 'يجب أن يكون مبلغ تحويل الماسات رقماً زوجياً.',
      });
    }

    // كل 50,000 Diamonds تساوي 25,000 Coins (1 كوينز لكل 2 ماسة)
    const coinsGain = Math.floor(dAmount * (25000 / 50000));

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

    const adminEmails = getAdminEmails();
    const isAdmin =
      (u?.email && adminEmails.includes(u.email.toLowerCase())) ||
      (cleanEmail && adminEmails.includes(cleanEmail)) ||
      cleanUserId === 'admin-1001' ||
      cleanUserId === 'admin-1002';

    let currentDiamonds = typeof u?.walletBalance === 'number' ? u.walletBalance : (isAdmin ? 99999 : 0);
    let currentCoins = typeof u?.coinsBalance === 'number' ? u.coinsBalance : (isAdmin ? 100000 : 0);

    if (neonPool) {
      const profile = await getNeonProfileByIdentifier(cleanUserId || cleanDisplayId || cleanEmail);
      if (profile) {
        currentDiamonds = parseDbNumber(profile.wallet_balance, currentDiamonds);
        currentCoins = parseDbNumber(profile.coins_balance, currentCoins);
      }
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
    const nowIso = new Date().toISOString();

    if (u) {
      u.walletBalance = newDiamonds;
      u.coinsBalance = newCoins;
      u.updatedAt = nowIso;
    } else {
      u = {
        id: cleanUserId,
        displayId: cleanDisplayId || (cleanUserId.startsWith('S-') ? cleanUserId : generateSoulXId()),
        email: cleanEmail || `${cleanUserId}@soul-x.com`,
        name: `مستخدم ${cleanUserId.slice(0, 8)}`,
        passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
        createdAt: nowIso,
        updatedAt: nowIso,
        walletBalance: newDiamonds,
        coinsBalance: newCoins,
      };
      users.push(u);
    }
    saveStoredUsers(users);

    if (neonPool) {
      await updateNeonProfileByIdentifier(u.id || cleanUserId, {
        walletBalance: newDiamonds,
        coinsBalance: newCoins,
      });
    }

    broadcastChatMessage([cleanUserId, u.id, u.displayId], {
      type: 'balance_update',
      currency: 'diamonds',
      balance: newDiamonds,
      userId: u.id,
      displayId: u.displayId,
    });
    broadcastChatMessage([cleanUserId, u.id, u.displayId], {
      type: 'balance_update',
      currency: 'coins',
      balance: newCoins,
      userId: u.id,
      displayId: u.displayId,
    });

    recordGeneralSiteLog({
      category: 'wallet',
      actorRole: 'USER',
      userId: u.id,
      displayId: u.displayId,
      email: u.email,
      userName: u.name,
      action: 'convert_diamonds_to_coins',
      actionLabelAr: 'تحويل ماسات إلى كوينز',
      details: `تحويل ${dAmount.toLocaleString()} ماسة إلى ${coinsGain.toLocaleString()} كوينز`,
      amount: coinsGain,
      currency: 'coins',
      ip: getClientIp(req),
      status: 'success',
    });

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

    const adminEmails = getAdminEmails();
    const isAdmin =
      (u?.email && adminEmails.includes(u.email.toLowerCase())) ||
      (cleanEmail && adminEmails.includes(cleanEmail)) ||
      cleanUserId === 'admin-1001' ||
      cleanUserId === 'admin-1002';

    let currentCoins = typeof u?.coinsBalance === 'number' ? u.coinsBalance : (isAdmin ? 100000 : 0);

    if (neonPool) {
      const profile = await getNeonProfileByIdentifier(cleanUserId || cleanDisplayId || cleanEmail);
      if (profile) {
        currentCoins = parseDbNumber(profile.coins_balance, currentCoins);
      }
    }

    const newCoins = Math.max(0, Math.round(currentCoins + coins));
    const nowIso = new Date().toISOString();

    if (u) {
      u.coinsBalance = newCoins;
      u.updatedAt = nowIso;
    } else {
      u = {
        id: cleanUserId,
        displayId: cleanDisplayId || (cleanUserId.startsWith('S-') ? cleanUserId : generateSoulXId()),
        email: cleanEmail || `${cleanUserId}@soul-x.com`,
        name: `مستخدم ${cleanUserId.slice(0, 8)}`,
        passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
        createdAt: nowIso,
        updatedAt: nowIso,
        walletBalance: isAdmin ? 99999 : 0,
        coinsBalance: newCoins,
      };
      users.push(u);
    }
    saveStoredUsers(users);

    if (neonPool) {
      await updateNeonProfileByIdentifier(u.id || cleanUserId, {
        coinsBalance: newCoins,
      });
    }

    broadcastChatMessage([cleanUserId, u.id, u.displayId], {
      type: 'balance_update',
      currency: 'coins',
      balance: newCoins,
      userId: u.id,
      displayId: u.displayId,
    });

    recordGeneralSiteLog({
      category: 'wallet',
      actorRole: 'USER',
      userId: u.id,
      displayId: u.displayId,
      email: u.email,
      userName: u.name,
      action: 'deposit_coins',
      actionLabelAr: 'إيداع وشحن كوينز',
      details: `شحن ${coins.toLocaleString()} كوينز بقيمة $${usd}`,
      amount: coins,
      currency: 'coins',
      ip: getClientIp(req),
      status: 'success',
    });

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

    // 2. البحث عن الوكيل والتحقق من اعتماده (مع التزامن من Neon إن وجد)
    const agents = neonPool ? await syncAgentsWithNeon() : getStoredAgents();
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

    // 3. حساب المبالغ وسعر التحويل إلى كوينز في رصيد الوكالة بعد خصم 2.5%
    // عند السحب من قبل مستخدم: تحويل المبلغ إلى coins بسعر 1 ماسة = 0.625 كوينز مع خصم 2.5% وإضافته لرصيد الوكالة
    const conversionRate = 0.625; // 1 Diamond = 0.625 Coins
    const grossCoins = Math.round((dAmount * conversionRate + Number.EPSILON) * 100) / 100;
    const feePercentage = 2.5; // عمولة 2.5%
    const feeCoins = Math.round((grossCoins * 0.025 + Number.EPSILON) * 100) / 100;
    const netCoinsAddedToAgency = Math.round((grossCoins - feeCoins + Number.EPSILON) * 100) / 100;

    const grossUsdAmount = (dAmount / 400000) * 10;
    const feeUsdAmount = Math.round((grossUsdAmount * 0.025 + Number.EPSILON) * 100) / 100;
    const netUsdAmount = Math.round((grossUsdAmount - feeUsdAmount + Number.EPSILON) * 100) / 100;

    // توليد رقم طلب فريد لكل سحب
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

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

    const adminEmails = getAdminEmails();
    const isAdmin =
      (u?.email && adminEmails.includes(u.email.toLowerCase())) ||
      (cleanEmail && adminEmails.includes(cleanEmail)) ||
      cleanUserId === 'admin-1001' ||
      cleanUserId === 'admin-1002';

    let currentDiamonds = typeof u?.walletBalance === 'number' ? u.walletBalance : (isAdmin ? 99999 : 0);

    if (neonPool) {
      const profile = await getNeonProfileByIdentifier(cleanUserId || cleanDisplayId || cleanEmail);
      if (profile) {
        currentDiamonds = parseDbNumber(profile.wallet_balance, currentDiamonds);
      }
    }

    // 4. التحقق من كفاية رصيد ماسات المستخدم
    if (currentDiamonds < dAmount) {
      return res.status(400).json({
        success: false,
        message: `رصيد الماسات غير كافٍ لإتمام السحب. رصيدك الحالي: ${currentDiamonds.toLocaleString()} ماسة، بينما المطلوب سحبه: ${dAmount.toLocaleString()} ماسة ($${grossUsdAmount.toFixed(2)} USD).`,
        currentBalance: currentDiamonds,
      });
    }

    // 5. خصم كامل المبلغ المسحوب من رصيد ماسات المستخدم
    const newDiamonds = Math.max(0, currentDiamonds - dAmount);
    const nowIso = new Date().toISOString();

    if (u) {
      u.walletBalance = newDiamonds;
      u.updatedAt = nowIso;
    } else {
      u = {
        id: cleanUserId,
        displayId: cleanDisplayId || (cleanUserId.startsWith('S-') ? cleanUserId : generateSoulXId()),
        email: cleanEmail || `${cleanUserId}@soul-x.com`,
        name: `مستخدم ${cleanUserId.slice(0, 8)}`,
        passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
        createdAt: nowIso,
        updatedAt: nowIso,
        walletBalance: newDiamonds,
        coinsBalance: isAdmin ? 100000 : 0,
      };
      users.push(u);
    }
    saveStoredUsers(users);

    if (neonPool) {
      await updateNeonProfileByIdentifier(u.id || cleanUserId, {
        walletBalance: newDiamonds,
      });
    }

    broadcastChatMessage([cleanUserId, u.id, u.displayId], {
      type: 'balance_update',
      currency: 'diamonds',
      balance: newDiamonds,
      userId: u.id,
      displayId: u.displayId,
    });

    // 6. إضافة الكوينز الصحيحة لرصيد وكالة الشحن بعد تحويلها لـ coins وخصم 2.5% بحد أقصى فاصلتين عشريتين
    const previousAgentBalance = Math.round(((agent.balance || 0) + Number.EPSILON) * 100) / 100;
    const newAgentBalance = Math.round((previousAgentBalance + netCoinsAddedToAgency + Number.EPSILON) * 100) / 100;
    agent.balance = newAgentBalance;
    agent.completedOrders = (agent.completedOrders || 0) + 1;
    agent.updatedAt = nowIso;
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
      orderId: orderNumber,
      orderNumber: orderNumber,
      type: 'user_withdrawal',
      agentId: agent.id,
      gridCode: agent.gridCode || 'A8838',
      targetUserId: cleanUserId,
      targetUserDisplayId: userDisplayId,
      targetUserName: userName,
      amount: netCoinsAddedToAgency, // الصافي المضاف للوكالة كـ كوينز بعد خصم 2.5%
      grossAmount: dAmount, // إجمالي الماسات المسحوبة من المستخدم
      feeAmount: feeCoins,
      feePercentage: 2.5,
      usdAmount: grossUsdAmount,
      netUsdAmount: netUsdAmount,
      payoutMethod: selectedPayoutMethod,
      accountDetails: destinationAccount,
      timestamp: nowIso,
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
      orderId: orderNumber,
      orderNumber: orderNumber,
      type: 'incoming_user_withdrawal',
      agentId: agent.id,
      agentName: agent.name,
      gridCode: agent.gridCode || 'A8838',
      amount: dAmount, // الماسات المسحوبة
      fee: feeCoins,
      netCredited: netCoinsAddedToAgency, // الكوينز المضافة للوكالة بعد خصم 2.5%
      usdAmount: grossUsdAmount,
      netUsdAmount: netUsdAmount,
      method: selectedPayoutMethod,
      accountDetails: destinationAccount,
      notes: notes
        ? `${notes} | رقم الطلب: ${orderNumber} | المطلوب بالدولار: $${netUsdAmount.toFixed(2)} USD | صافي الكوينز: +${netCoinsAddedToAgency.toLocaleString('en-US', { maximumFractionDigits: 2 })} 🪙`
        : `سحب ماسات المستخدم: ${userName} (${userDisplayId}) | رقم الطلب: ${orderNumber} | كمية الماسات: ${dAmount.toLocaleString()} 💎 | المطلوب للمستخدم: $${netUsdAmount.toFixed(2)} USD (بعد خصم 2.5%) | الكوينز المضافة: +${netCoinsAddedToAgency.toLocaleString('en-US', { maximumFractionDigits: 2 })} 🪙`,
      status: 'pending',
      userId: cleanUserId,
      userDisplayId,
      userName,
      createdAt: nowIso,
    };
    withdrawals.unshift(withdrawalRequest);
    saveStoredAgencyWithdrawals(withdrawals);

    // Sync agent balance, transaction, and withdrawal directly to Neon PostgreSQL
    if (neonPool) {
      await Promise.all([
        updateAgentBalanceInNeon(agent, newAgentBalance, agent.completedOrders),
        saveAgencyTransactionToNeon(txRecord),
        saveAgencyWithdrawalToNeon(withdrawalRequest),
      ]).catch((err) => console.warn('Neon agent withdrawal sync error:', err));
    }

    recordGeneralSiteLog({
      refId: `wdr:${withdrawalId}`,
      category: 'wallet',
      actorRole: 'USER',
      userId: u?.id || cleanUserId,
      displayId: userDisplayId,
      email: u?.email,
      userName,
      targetUserId: agent.id,
      targetDisplayId: agent.gridCode,
      targetName: agent.name,
      action: 'withdraw_diamonds_via_agent',
      actionLabelAr: 'طلب سحب ماسات عبر وكيل معتمد',
      details: `الطلب: ${orderNumber} | المبلغ: ${dAmount.toLocaleString()} ماسة ($${netUsdAmount.toFixed(2)}) | الوكيل: ${agent.name} (${agent.gridCode})`,
      amount: dAmount,
      currency: 'diamonds',
      ip: getClientIp(req),
      status: 'pending',
    });

    // 9. إرسال إشعار فوري للوكيل في المحادثات (In-App Notification to Agent)
    try {
      const messagesData = getStoredMessagesData();
      const notificationText = `📥 [إشعار سحب رصيد جديد عبر وكالتك]
رقم الطلب: ${orderNumber}
المستخدم: ${userName} (ID: ${userDisplayId})
مبلغ السحب: ${dAmount.toLocaleString()} ماسة ($${grossUsdAmount.toFixed(2)} USD)
المبلغ المطلوب للمستخدم بالدولار: $${netUsdAmount.toFixed(2)} USD (بعد خصم 2.5%)
الكوينز المضافة لوكالتك: +${netCoinsAddedToAgency.toLocaleString('en-US', { maximumFractionDigits: 2 })} كوينز 🪙 (بعد تحويلها لـ coins وخصم 2.5%)
رصيد وكالتك الحالي: ${newAgentBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })} كوينز 🪙
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

    // 10. إضافة إشعار رسمي داخل لوحة الوكالة (Agency Portal Notification - سحوبات المستخدمين فقط)
    try {
      const notifId = `NOTIF-WDR-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const agencyNotifications = getStoredAgencyNotifications();
      const newAgencyNotif: StoredAgencyNotification = {
        id: notifId,
        orderId: orderNumber,
        orderNumber: orderNumber,
        agentId: agent.id,
        gridCode: agent.gridCode || 'A8838',
        title: 'إشعار سحب رصيد مستخدم (إيداع كوينز للوكالة)',
        titleEn: 'User Cashout (Coins Credited)',
        message: `سحب المستخدم [${userName}] (ID: ${userDisplayId}) كمية ${dAmount.toLocaleString()} ماسة. رقم الطلب: ${orderNumber}. المبلغ المطلوب للمستخدم: $${netUsdAmount.toFixed(2)} USD. تم إضافة الصافي (+${netCoinsAddedToAgency.toLocaleString('en-US', { maximumFractionDigits: 2 })} كوينز 🪙) إلى رصيد وكالتك بعد تحويله لكوينز وخصم 2.5%.`,
        messageEn: `User [${userName}] (ID: ${userDisplayId}) withdrew ${dAmount.toLocaleString()} diamonds. Order #${orderNumber}. Amount required to user: $${netUsdAmount.toFixed(2)} USD. Net (+${netCoinsAddedToAgency.toLocaleString('en-US', { maximumFractionDigits: 2 })} coins) credited to your agency balance after coin conversion and 2.5% fee.`,
        grossAmount: dAmount,
        feeAmount: feeCoins,
        netAmount: netCoinsAddedToAgency,
        feePercentage: 2.5,
        usdAmount: grossUsdAmount,
        netUsdAmount: netUsdAmount,
        userId: cleanUserId,
        userDisplayId,
        userName,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'incoming_user_withdrawal',
      };
      agencyNotifications.unshift(newAgencyNotif);
      saveStoredAgencyNotifications(agencyNotifications);
    } catch (agNotifErr) {
      console.warn('Agency notification save error:', agNotifErr);
    }

    // 11. إرسال إشعار رسمي لمركز إشعارات المستخدم بعملية السحب
    try {
      createAndSaveUserNotification({
        userId: cleanUserId,
        userDisplayId,
        type: 'withdrawal_request',
        titleAr: 'عملية سحب جديدة 💸',
        titleEn: 'New Withdrawal 💸',
        messageAr: `عملية سحب جديدة بالمعرف: ${orderNumber}\nالقيمة المسحوبة: ${grossCoins.toLocaleString()} coins\nعبر الوكيل: ${agent.gridCode || agent.id}`,
        messageEn: `New withdrawal with ID: ${orderNumber}\nWithdrawn amount: ${grossCoins.toLocaleString()} coins\nVia agent: ${agent.gridCode || agent.id}`,
        metadata: {
          txId: orderNumber,
          orderId: orderNumber,
          withdrawalId,
          agentId: agent.id,
          agentGridCode: agent.gridCode || agent.id,
          agentName: agent.nameAr || agent.name,
          amount: grossCoins,
          diamondsAmount: dAmount,
          currency: 'coins',
        },
      });
    } catch (userNotifErr) {
      console.warn('User withdrawal notification error:', userNotifErr);
    }

    return res.json({
      success: true,
      receipt: {
        orderId: orderNumber,
        orderNumber: orderNumber,
        transactionId: txId,
        withdrawalId,
        grossDiamonds: dAmount,
        usdAmount: grossUsdAmount,
        netUsdAmount: netUsdAmount,
        feeAmount: feeCoins,
        feePercentage: 2.5,
        coinsAddedToAgent: netCoinsAddedToAgency,
        conversionRate: 0.625,
        userAccount: {
          id: cleanUserId,
          displayId: userDisplayId,
          name: userName,
        },
        agency: {
          id: agent.id,
          gridCode: agent.gridCode || 'A8838',
          name: agent.name,
          country: agent.country,
          flag: agent.flag,
          newBalance: newAgentBalance,
        },
        date: new Date().toISOString(),
      },
      diamondsDeducted: dAmount,
      coinsAddedToAgent: netCoinsAddedToAgency,
      orderNumber,
      orderId: orderNumber,
      usdAmount: grossUsdAmount,
      netUsdAmount,
      conversionRate: 0.625,
      newDiamondsBalance: newDiamonds,
      newAgentBalance,
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
      message: `تم سحب ${dAmount.toLocaleString()} ماسة بنجاح، ورقم الطلب: ${orderNumber}. المبلغ المطلوب للمستخدم: $${netUsdAmount.toFixed(2)} USD (بعد خصم 2.5%). أضيفت الكوينز الصافية (+${netCoinsAddedToAgency.toLocaleString('en-US', { maximumFractionDigits: 2 })} 🪙) لرصيد وكالة الشحن (${agent.name} [${agent.gridCode}])!`,
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

  let sender = users.find(
    (u) =>
      u.id === cleanSender ||
      u.displayId === cleanSender ||
      (u.email && u.email.toLowerCase() === cleanSender.toLowerCase())
  );

  // Refresh or hydrate sender from Neon PostgreSQL
  if (neonPool) {
    try {
      const sRes: any = await neonPool.query(
        'SELECT * FROM profiles WHERE id = $1 OR display_id = $1 OR email = LOWER($1) LIMIT 1',
        [cleanSender]
      );
      if (sRes?.rows?.length > 0) {
        const row = sRes.rows[0];
        const neonWallet = parseDbNumber(row.wallet_balance, 0);
        const neonCoins = parseDbNumber(row.coins_balance, 0);
        if (sender) {
          sender.walletBalance = neonWallet;
          sender.coinsBalance = neonCoins;
        } else {
          sender = {
            id: row.id,
            displayId: row.display_id || row.id,
            email: row.email,
            name: row.name,
            passwordHash: row.password_hash || hashPassword(DEFAULT_ADMIN_PASSWORD),
            walletBalance: neonWallet,
            coinsBalance: neonCoins,
            createdAt: row.created_at,
          };
          users.push(sender);
        }
      }
    } catch {}
  }

  const isAdminSender = sender?.email ? getAdminEmails().includes(sender.email.toLowerCase()) : false;
  const currentSenderCoins = typeof sender?.coinsBalance === 'number' ? sender.coinsBalance : (isAdminSender ? 100000 : 0);

  if (currentSenderCoins < cost) {
    return {
      success: false,
      message: `رصيد الكوينز غير كافٍ (${currentSenderCoins.toLocaleString()} كوينز). تكلفة الهدية ${cost.toLocaleString()} كوينز.`,
      senderCoins: currentSenderCoins,
    };
  }

  // 1. Deduct price in coins from sender
  const newSenderCoins = Math.max(0, currentSenderCoins - cost);
  if (sender) {
    sender.coinsBalance = newSenderCoins;
    sender.updatedAt = new Date().toISOString();
  }

  // 2. Identify recipient and credit price as diamonds (walletBalance)
  let recipient = users.find(
    (u) =>
      u.id === cleanRecipient ||
      u.displayId === cleanRecipient ||
      (u.email && u.email.toLowerCase() === cleanRecipient.toLowerCase())
  );

  // Refresh or hydrate recipient from Neon PostgreSQL
  if (neonPool) {
    try {
      const rRes: any = await neonPool.query(
        'SELECT * FROM profiles WHERE id = $1 OR display_id = $1 OR email = LOWER($1) LIMIT 1',
        [cleanRecipient]
      );
      if (rRes?.rows?.length > 0) {
        const row = rRes.rows[0];
        const neonWallet = parseDbNumber(row.wallet_balance, 0);
        const neonCoins = parseDbNumber(row.coins_balance, 0);
        if (recipient) {
          recipient.walletBalance = neonWallet;
          recipient.coinsBalance = neonCoins;
        } else {
          recipient = {
            id: row.id,
            displayId: row.display_id || row.id,
            email: row.email,
            name: row.name,
            passwordHash: row.password_hash || hashPassword(DEFAULT_ADMIN_PASSWORD),
            walletBalance: neonWallet,
            coinsBalance: neonCoins,
            createdAt: row.created_at,
          };
          users.push(recipient);
        }
      }
    } catch {}
  }

  const isAdminRecipient = recipient?.email ? getAdminEmails().includes(recipient.email.toLowerCase()) : false;
  const currentRecipientDiamonds = typeof recipient?.walletBalance === 'number' ? recipient.walletBalance : (isAdminRecipient ? 99999 : 0);
  const newRecipientDiamonds = currentRecipientDiamonds + cost;

  if (recipient) {
    recipient.walletBalance = newRecipientDiamonds;
    recipient.updatedAt = new Date().toISOString();
  } else {
    // If recipient not in stored users (e.g. external ID), register profile in stored users
    recipient = {
      id: cleanRecipient,
      displayId: cleanRecipient.startsWith('S-') ? cleanRecipient : generateSoulXId(),
      email: `${cleanRecipient}@soul-x.com`,
      name: `عضو ${cleanRecipient.slice(0, 8)}`,
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      createdAt: new Date().toISOString(),
      walletBalance: newRecipientDiamonds,
      coinsBalance: 0,
    };
    users.push(recipient);
  }

  saveStoredUsers(users);

  // Synchronize both balances with Neon PostgreSQL
  if (neonPool) {
    try {
      await updateNeonProfileByIdentifier(sender?.id || cleanSender, {
        coinsBalance: newSenderCoins,
      });
      await updateNeonProfileByIdentifier(recipient?.id || cleanRecipient, {
        walletBalance: newRecipientDiamonds,
      });
    } catch (neonErr) {
      console.warn('Neon gift transfer sync warning:', neonErr);
    }
  }

  // Real-Time Event Broadcast to connected clients
  broadcastChatMessage([cleanSender, sender?.id, sender?.displayId], {
    type: 'balance_update',
    currency: 'coins',
    balance: newSenderCoins,
    userId: sender?.id || cleanSender,
    displayId: sender?.displayId,
  });

  broadcastChatMessage([cleanRecipient, recipient?.id, recipient?.displayId], {
    type: 'balance_update',
    currency: 'diamonds',
    balance: newRecipientDiamonds,
    userId: recipient?.id || cleanRecipient,
    displayId: recipient?.displayId,
  });

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

  // Check stored users and Neon PostgreSQL
  const users = getStoredUsers();
  let user = users.find((u) => u.email.toLowerCase() === normalized);
  let neonName: string | undefined;

  if (neonPool) {
    try {
      const neonProfile = await getNeonProfileByIdentifier(normalized);
      if (neonProfile?.name) {
        neonName = neonProfile.name;
      }
    } catch (dbErr) {
      console.warn('Neon profile check query warning:', dbErr);
    }
  }

  // Admin account handling: recognized as authorized admin account
  if (isAdminEmail) {
    const adminPin = getAdminPin();
    const isRegistered = Boolean(user?.passwordHash || neonName);
    const adminLabel = normalized === (process.env.ADMIN1 || '').toLowerCase()
      ? 'مدير النظام (ADMIN1)'
      : 'مدير النظام (ADMIN2)';

    return res.json({
      success: true,
      exists: true,
      isRegistered,
      email: normalized,
      name: user ? user.name : (neonName || adminLabel),
      isAdmin: true,
      hasAdminPin: Boolean(adminPin),
    });
  }

  // Non-admin flow
  const exists = Boolean(user || neonName);

  return res.json({
    success: true,
    exists,
    email: normalized,
    name: user ? user.name : neonName,
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

  // Hydrate or refresh user balances from Neon PostgreSQL if available
  const users = getStoredUsers();
  let user = users.find((u) => u.email.toLowerCase() === normalized);
  let neonProfile: any = null;

  if (neonPool) {
    try {
      neonProfile = await getNeonProfileByIdentifier(normalized);
    } catch (e) {
      console.warn('Login Neon profiles lookup warning:', e);
    }
  }

  if (neonProfile) {
    const neonWallet = parseDbNumber(neonProfile.wallet_balance, isAdminEmail ? 99999 : 0);
    const neonCoins = parseDbNumber(neonProfile.coins_balance, isAdminEmail ? 100000 : 0);
    if (user) {
      let dirty = false;
      if (user.walletBalance !== neonWallet) {
        user.walletBalance = neonWallet;
        dirty = true;
      }
      if (user.coinsBalance !== neonCoins) {
        user.coinsBalance = neonCoins;
        dirty = true;
      }
      if (!user.passwordHash && neonProfile.password_hash) {
        user.passwordHash = neonProfile.password_hash;
        dirty = true;
      }
      if (dirty) saveStoredUsers(users);
    } else {
      user = {
        id: neonProfile.id,
        displayId: neonProfile.display_id || generateSoulXId(),
        email: neonProfile.email || normalized,
        name: neonProfile.name || normalized.split('@')[0],
        passwordHash: neonProfile.password_hash || '',
        createdAt: neonProfile.created_at || new Date().toISOString(),
        birthDate: neonProfile.birth_date || null,
        gender: neonProfile.gender || null,
        country: neonProfile.country || null,
        walletBalance: neonWallet,
        coinsBalance: neonCoins,
        photoUrl: neonProfile.avatar_url || undefined,
        bio: neonProfile.bio || undefined,
      };
      users.push(user);
      saveStoredUsers(users);
    }
  }

  // If this is an ADMIN1 or ADMIN2 account, verify strictly using the actual account password
  if (isAdminEmail) {
    const isPassMatch = Boolean(
      (user && user.passwordHash && user.passwordHash === hashPassword(password)) ||
      (!user?.passwordHash && password === DEFAULT_ADMIN_PASSWORD)
    );

    if (isPassMatch) {
      const admin1Email = (process.env.ADMIN1 || '').trim().toLowerCase();
      const isAdmin1 = Boolean(admin1Email && normalized === admin1Email);

      if (!user) {
        user = {
          id: isAdmin1 ? 'admin-1001' : 'admin-1002',
          displayId: isAdmin1 ? '1' : '2',
          email: normalized,
          name: isAdmin1 ? 'مدير النظام (ADMIN1)' : 'مدير النظام (ADMIN2)',
          passwordHash: hashPassword(password),
          createdAt: new Date().toISOString(),
          birthDate: '1995-01-01',
          gender: 'male',
          walletBalance: 99999,
          coinsBalance: 100000,
        };
        users.push(user);
        saveStoredUsers(users);
      } else if (!user.passwordHash) {
        user.passwordHash = hashPassword(password);
        saveStoredUsers(users);
      }

      if (neonPool) {
        await saveProfileToNeon({
          ...user,
          isAdmin: true,
        }).catch(() => {});
      }

      if (user.twoFactorEnabled && user.twoFactorSecret) {
        const tempToken = '2fa_temp_' + crypto.randomBytes(32).toString('hex');
        temp2FALoginStore.set(tempToken, {
          userId: user.id,
          email: user.email,
          name: user.name,
          displayId: user.displayId,
          isAdmin: true,
          rememberDevice: true,
          expiresAt: Date.now() + 5 * 60 * 1000,
        });
        return res.json({
          success: true,
          requires2FA: true,
          tempToken,
          user: {
            id: user.id,
            displayId: user.displayId,
            name: user.name,
            email: user.email,
          },
        });
      }

      if (!isAdmin1 && getAdmin2Email() && normalized === getAdmin2Email()) {
        recordAdmin2ActivityLog({
          adminEmail: normalized,
          adminId: user.id,
          adminName: user.name,
          action: 'admin2_login',
          actionLabelAr: 'تسجيل دخول ADMIN2 إلى الموقع',
          details: `دخول ناجح لحساب ${user.email}`,
          method: 'POST',
          path: '/api/auth/login',
          ip: getClientIp(req),
        });
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
          coinsBalance: user.coinsBalance ?? 100000,
          isAdmin: true,
          isVerified: Boolean(user.isVerified),
        },
      });
    }

    // Credentials did NOT match:
    if (getAdmin2Email() && normalized === getAdmin2Email()) {
      recordAdmin2ActivityLog({
        adminEmail: normalized,
        action: 'admin2_login_failed',
        actionLabelAr: 'محاولة دخول فاشلة لـ ADMIN2',
        details: 'كلمة مرور غير صحيحة',
        method: 'POST',
        path: '/api/auth/login',
        ip: getClientIp(req),
      });
    }
    return res.status(401).json({
      success: false,
      message: 'كلمة المرور غير صحيحة لحساب المدير! يرجى إدخال كلمة المرور المعتمدة للحساب.',
    });
  }

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'هذا البريد الإلكتروني غير مسجل، يرجى إنشاء حساب جديد',
    });
  }

  const hashed = hashPassword(password);
  if (user.passwordHash && user.passwordHash !== hashed) {
    recordUserActivityLog({
      userId: user.id,
      displayId: user.displayId,
      email: user.email,
      name: user.name,
      action: 'login_failed',
      actionLabelAr: 'محاولة دخول فاشلة',
      details: 'إدخال كلمة مرور خاطئة',
      ip: getClientIp(req),
    });
    return res.status(401).json({
      success: false,
      message: 'كلمة المرور غير صحيحة، يرجى التحقق وإعادة المحاولة',
    });
  } else if (!user.passwordHash) {
    // If passwordHash was not set, initialize it with this valid login attempt
    user.passwordHash = hashed;
    saveStoredUsers(users);
    if (neonPool) {
      updateNeonProfileByIdentifier(user.id, { passwordHash: hashed }).catch(() => {});
    }
  }

  recordUserActivityLog({
    userId: user.id,
    displayId: user.displayId,
    email: user.email,
    name: user.name,
    action: 'login',
    actionLabelAr: 'تسجيل دخول',
    details: 'دخول ناجح إلى الحساب',
    ip: getClientIp(req),
  });

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    const tempToken = '2fa_temp_' + crypto.randomBytes(32).toString('hex');
    temp2FALoginStore.set(tempToken, {
      userId: user.id,
      email: user.email,
      name: user.name,
      displayId: user.displayId,
      isAdmin: isAdminEmail,
      rememberDevice: true,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return res.json({
      success: true,
      requires2FA: true,
      tempToken,
      user: {
        id: user.id,
        displayId: user.displayId,
        name: user.name,
        email: user.email,
      },
    });
  }

  if (checkAndExpireUserFreeze(user)) {
    saveStoredUsers(users);
  }

  const session = createSession(user.id, user.email, user.name, isAdminEmail, user.displayId);

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
      country: user.country || null,
      bio: user.bio || getDefaultUserBio(),
      walletBalance: user.walletBalance ?? (isAdminEmail ? 99999 : 0),
      coinsBalance: user.coinsBalance ?? (isAdminEmail ? 100000 : 0),
      isAdmin: isAdminEmail,
      isBanned: Boolean(user.isBanned),
      bannedAt: user.bannedAt || null,
      banReason: user.banReason || null,
      isFrozen: Boolean(user.isFrozen),
      frozenAt: user.frozenAt || null,
      freezeDurationMinutes: user.freezeDurationMinutes || null,
      freezeExpiresAt: user.freezeExpiresAt || null,
      freezeReason: user.freezeReason || null,
      isVerified: Boolean(user.isVerified),
    },
    isAdmin: isAdminEmail,
  });
});

// 3. Endpoint: إنشاء حساب جديد بالاسم والجنس والدولة وتاريخ الميلاد وكلمة المرور
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { email, name, password, birthDate, gender, country } = req.body;
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

  // 2. Mandatory Country validation
  if (!country || typeof country !== 'string' || !country.trim()) {
    return res.status(400).json({
      success: false,
      message: 'اختيار الدولة خطوة إجبارية لإتمام إنشاء الحساب',
    });
  }
  const cleanCountry = country.trim();

  // 3. Mandatory Date of Birth validation
  if (!birthDate || typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return res.status(400).json({
      success: false,
      message: 'تحديد تاريخ الميلاد خطوة إجبارية لإنشاء الحساب',
    });
  }

  // 4. Age validation (must be 18+)
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
  let createdUserId = crypto.randomUUID(); // Guaranteed valid UUID for Postgres profiles table
  const hashedPass = hashPassword(password);
  const isUserAdmin = getAdminEmails().includes(normalized);

  // 1. Check in Neon PostgreSQL if email is already taken
  if (neonPool) {
    try {
      const neonCheck: any = await withTimeout(
        neonPool.query('SELECT id FROM profiles WHERE email = LOWER($1) LIMIT 1', [normalized]),
        4000
      );
      if (neonCheck?.rows && neonCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'هذا البريد مسجل مسبقاً، يرجى تسجيل الدخول بدلاً من ذلك',
        });
      }
    } catch (neonCheckErr) {
      console.warn('Neon check existing email warning:', neonCheckErr);
    }
  }

  const newUser: StoredUser = {
    id: createdUserId,
    displayId,
    email: normalized,
    name: name.trim(),
    passwordHash: hashedPass,
    createdAt: new Date().toISOString(),
    birthDate,
    gender,
    country: cleanCountry,
    bio: getDefaultUserBio(),
    walletBalance: isUserAdmin ? 99999 : 0,
    coinsBalance: isUserAdmin ? 100000 : 0,
  };

  // 2. Persist locally for instant zero-latency caching
  users.push(newUser);
  saveStoredUsers(users);

  // 3. Immediately persist directly into Neon PostgreSQL profiles table!
  const neonSaveRes = await saveProfileToNeon(newUser);
  if (!neonSaveRes.success && neonPool) {
    console.warn('⚡ Initial Neon save failed, auto-running migration and retrying...', neonSaveRes.error);
    await autoMigrateNeonSchema().catch(() => {});
    await saveProfileToNeon(newUser).catch((retryErr) => {
      console.error('❌ Failed to save user to Neon on retry:', retryErr);
    });
  }

  recordUserActivityLog({
    userId: newUser.id,
    displayId: newUser.displayId,
    email: newUser.email,
    name: newUser.name,
    action: 'register',
    actionLabelAr: 'إنشاء حساب جديد',
    details: `الدولة: ${cleanCountry} | الجنس: ${gender}`,
    ip: getClientIp(req),
  });

  const session = createSession(newUser.id, newUser.email, newUser.name, isUserAdmin, displayId);

  return res.json({
    success: true,
    message: `أهلاً بك يا ${newUser.name} في Soul-X! تم إنشاء حسابك بنجاح`,
    token: session.token,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
    refreshExpiresInDays: 30,
    isAdmin: isUserAdmin,
    user: {
      id: newUser.id,
      displayId,
      name: newUser.name,
      email: newUser.email,
      photoUrl: newUser.photoUrl,
      createdAt: newUser.createdAt,
      birthDate: newUser.birthDate,
      gender: newUser.gender,
      country: newUser.country,
      bio: newUser.bio,
      walletBalance: newUser.walletBalance ?? 0,
      coinsBalance: newUser.coinsBalance ?? 0,
      isAdmin: isUserAdmin,
      isVerified: false,
    },
  });
});

// 3.1 Endpoint: التحقق من صحة جلسة التوكن (Token Verification) مع دعم التجديد التلقائي
app.get('/api/auth/verify', async (req: Request, res: Response) => {
  const authHeader = (req.headers['authorization'] as string) || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  const refreshToken = ((req.headers['x-refresh-token'] as string) || (req.query.refreshToken as string) || '').trim();
  const hintUserId = ((req.headers['x-user-id'] as string) || (req.query.userId as string) || '').trim();
  const hintEmail = ((req.headers['x-user-email'] as string) || (req.query.email as string) || '').trim();

  if (!token && !refreshToken && !hintUserId && !hintEmail) {
    return res.status(401).json({
      success: false,
      message: 'رمز التحقق (Token) مفقود، يرجى تسجيل الدخول مجدداً',
    });
  }

  const result = await verifyToken(token || '', refreshToken, hintUserId, hintEmail);
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
  const hintUserId = ((req.headers['x-user-id'] as string) || req.body?.userId || '').trim();
  const hintEmail = ((req.headers['x-user-email'] as string) || req.body?.email || '').trim();

  const candidate = (
    bodyRefreshToken ||
    headerRefreshToken ||
    (authHeader.startsWith('Bearer ') ? authHeader.substring(7) : '')
  ).trim();

  if (!candidate && !hintUserId && !hintEmail) {
    return res.status(400).json({
      success: false,
      message: 'رمز التجديد (Refresh Token) مطلوب لإعادة تنشيط الجلسة',
    });
  }

  const result = await refreshSession(candidate, hintUserId, hintEmail);
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

  const allSessions = getStoredSessions();
  const matchedSess = allSessions.find(
    (s) => (token && s.token === token) || (refreshToken && s.refreshToken === refreshToken)
  );
  if (matchedSess) {
    const admin2 = getAdmin2Email();
    if (admin2 && matchedSess.email.toLowerCase() === admin2) {
      recordAdmin2ActivityLog({
        adminEmail: matchedSess.email,
        adminId: matchedSess.userId,
        adminName: matchedSess.name,
        action: 'admin2_logout',
        actionLabelAr: 'تسجيل خروج ADMIN2',
        method: 'POST',
        path: '/api/auth/logout',
        ip: getClientIp(req),
      });
    } else if (matchedSess.email.toLowerCase() !== getAdmin1Email()) {
      recordUserActivityLog({
        userId: matchedSess.userId,
        displayId: matchedSess.displayId,
        email: matchedSess.email,
        name: matchedSess.name,
        action: 'logout',
        actionLabelAr: 'تسجيل خروج',
        ip: getClientIp(req),
      });
    }
  }

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
  const { userId, name, birthDate, gender, country, photoUrl, bio } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const cleanUserId = String(userId);

  // Enforce user isolation: prevent modifying another user's profile
  const authCheck = await verifyUserOwnership(req, cleanUserId);
  if (!authCheck.authorized) {
    return res.status(403).json({ success: false, message: authCheck.reason });
  }

  // Update in stored users
  const users = getStoredUsers();
  const index = users.findIndex((u) => u.id === cleanUserId || u.displayId === cleanUserId);
  if (index !== -1) {
    if (name) users[index].name = name.trim();
    if (birthDate !== undefined) users[index].birthDate = birthDate;
    if (gender !== undefined) users[index].gender = gender;
    if (country !== undefined) users[index].country = country ? country.trim() : null;
    if (photoUrl !== undefined) users[index].photoUrl = photoUrl;
    if (bio !== undefined) users[index].bio = bio;
    saveStoredUsers(users);
    if (users[index].email.toLowerCase() !== getAdmin1Email()) {
      const updatedFields: string[] = [];
      if (name) updatedFields.push(`الاسم: ${name.trim()}`);
      if (country !== undefined) updatedFields.push(`الدولة: ${country || '-'}`);
      if (gender !== undefined) updatedFields.push(`الجنس: ${gender || '-'}`);
      if (bio !== undefined) updatedFields.push('تحديث النبذة');
      if (photoUrl !== undefined) updatedFields.push(photoUrl ? 'تحديث الصورة الشخصية' : 'حذف الصورة الشخصية');
      recordUserActivityLog({
        userId: users[index].id,
        displayId: users[index].displayId,
        email: users[index].email,
        name: users[index].name,
        action: 'update_profile',
        actionLabelAr: 'تحديث الملف الشخصي',
        details: updatedFields.join(' | ') || 'تعديل بيانات الحساب',
        ip: getClientIp(req),
      });
    }
  }

  // Update in Neon PostgreSQL profiles table
  await updateNeonProfileByIdentifier(cleanUserId, {
    name: name ? name.trim() : undefined,
    birthDate,
    gender,
    country: country ? country.trim() : undefined,
    photoUrl,
    bio,
  }).catch((err) => {
    console.warn('Neon update-profile error:', err?.message || err);
  });

  return res.json({
    success: true,
    message: 'تم تحديث الملف الشخصي بنجاح',
    user: {
      id: cleanUserId,
      name: name ? name.trim() : undefined,
      birthDate,
      gender,
      country: country ? country.trim() : undefined,
      photoUrl,
      isVerified: Boolean(index !== -1 ? users[index].isVerified : false),
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

    if (user.email.toLowerCase() === getAdmin2Email()) {
      recordAdmin2ActivityLog({
        adminEmail: user.email,
        adminId: user.id,
        adminName: user.name,
        action: 'admin2_change_own_password',
        actionLabelAr: 'ADMIN2 غيّر كلمة مروره الشخصية',
        method: 'POST',
        path: '/api/auth/change-password',
        ip: getClientIp(req),
      });
    } else if (user.email.toLowerCase() !== getAdmin1Email()) {
      recordUserActivityLog({
        userId: user.id,
        displayId: user.displayId,
        email: user.email,
        name: user.name,
        action: 'change_password',
        actionLabelAr: 'تغيير كلمة المرور',
        details: 'قام المستخدم بتغيير كلمة مرور حسابه',
        ip: getClientIp(req),
      });
    }

    // Sync to Neon PostgreSQL
    await updateNeonProfileByIdentifier(user.id, {
      passwordHash: newHash,
    }).catch((err) => {
      console.warn('Neon change-password sync error:', err?.message || err);
    });

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

// 4.2 Endpoint: تقديم طلب استعادة كلمة المرور من شاشة تسجيل الدخول (Web Forgot Password)
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const cleanEmail = String(req.body?.email || '').trim().toLowerCase();
    const rawTelegramInput = String(req.body?.telegramAccount || req.body?.contactNote || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال عنوان بريد إلكتروني صحيح',
      });
    }

    // Check local users + Neon profiles for the registered account
    const users = getStoredUsers();
    let matchedUser = users.find((u) => u.email && u.email.toLowerCase().trim() === cleanEmail);

    if (!matchedUser && neonPool) {
      try {
        const neonRes: any = await withTimeout(
          neonPool.query(
            'SELECT id, display_id, email, name FROM profiles WHERE LOWER(email) = LOWER($1) LIMIT 1',
            [cleanEmail]
          ),
          3500
        );
        if (neonRes?.rows?.[0]) {
          const p = neonRes.rows[0];
          matchedUser = {
            id: p.id,
            displayId: p.display_id,
            email: p.email,
            name: p.name,
            passwordHash: '',
            createdAt: new Date().toISOString(),
          };
        }
      } catch {}
    }

    if (!matchedUser) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على حساب مسجل بهذا البريد الإلكتروني.',
      });
    }

    // Check referral transfers if user didn't enter a Telegram handle, otherwise normalize entered handle/link
    let fallbackTgId: string | undefined;
    let fallbackTgUsername: string | undefined;
    try {
      const refStore = getBotReferralStore();
      const matchedTx = refStore.transfers.find(
        (t) =>
          (matchedUser?.id && t.targetUserId === matchedUser.id) ||
          (matchedUser?.displayId && t.targetDisplayId === matchedUser.displayId)
      );
      if (matchedTx) {
        fallbackTgId = matchedTx.telegramUserId;
        fallbackTgUsername = matchedTx.telegramUsername;
      }
    } catch {}

    const tg = normalizeTelegramContact(rawTelegramInput || fallbackTgUsername, fallbackTgId);
    if (!tg.link) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال معرف أو رابط حسابك في تيليجرام (مثال: @username أو https://t.me/username) للتواصل معك.',
      });
    }

    const allRequests = await getMergedPasswordResets();
    const existingPending = allRequests.find(
      (r) =>
        r.status === 'pending' &&
        ((r.userEmail && r.userEmail.toLowerCase().trim() === cleanEmail) ||
          (r.userId && r.userId === matchedUser!.id))
    );

    if (existingPending) {
      if (tg.username) existingPending.telegramUsername = tg.username;
      if (tg.link) existingPending.telegramLink = tg.link;
      if (fallbackTgId && !existingPending.telegramUserId) existingPending.telegramUserId = fallbackTgId;
      if (rawTelegramInput) existingPending.contactNote = rawTelegramInput;
      existingPending.requestedAt = new Date().toISOString();
      saveStoredPasswordResetRequests(allRequests);
      await savePasswordResetToNeon(existingPending);

      return res.json({
        success: true,
        alreadyPending: true,
        message: 'تم إرسال طلب استعادة كلمة المرور إلى لوحة التحكم بنجاح، وسيتواصل معك فريق الدعم عبر حسابك في تيليجرام.',
        request: {
          id: existingPending.id,
          status: existingPending.status,
          requestedAt: existingPending.requestedAt,
          userEmail: existingPending.userEmail,
          telegramUsername: existingPending.telegramUsername,
          telegramLink: existingPending.telegramLink,
        },
      });
    }

    const newReq: StoredPasswordResetRequest = {
      id: `prr-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`,
      source: 'web',
      userId: matchedUser.id,
      userDisplayId: matchedUser.displayId,
      userEmail: matchedUser.email,
      userName: matchedUser.name,
      telegramUserId: fallbackTgId,
      telegramUsername: tg.username,
      telegramLink: tg.link,
      contactNote: rawTelegramInput || undefined,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    allRequests.unshift(newReq);
    saveStoredPasswordResetRequests(allRequests);
    await savePasswordResetToNeon(newReq);

    if (matchedUser.email.toLowerCase() !== getAdmin1Email() && matchedUser.email.toLowerCase() !== getAdmin2Email()) {
      recordUserActivityLog({
        userId: matchedUser.id,
        displayId: matchedUser.displayId,
        email: matchedUser.email,
        name: matchedUser.name,
        action: 'forgot_password_request',
        actionLabelAr: 'طلب استعادة كلمة المرور',
        details: `تيليجرام: ${tg.username || tg.link}`,
        ip: getClientIp(req),
      });
    }

    return res.json({
      success: true,
      alreadyPending: false,
      message: 'تم إرسال طلب استعادة كلمة المرور إلى لوحة التحكم بنجاح، وسيتواصل معك فريق الدعم عبر حسابك في تيليجرام.',
      request: {
        id: newReq.id,
        status: newReq.status,
        requestedAt: newReq.requestedAt,
        userEmail: newReq.userEmail,
        telegramUsername: newReq.telegramUsername,
        telegramLink: newReq.telegramLink,
      },
    });
  } catch (err: any) {
    console.error('Web forgot-password error:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء إرسال طلب استعادة كلمة المرور',
    });
  }
});

// 4.3 Endpoint: التحقق من حالة طلب استعادة كلمة المرور للمستخدم بالبريد الإلكتروني
app.get('/api/auth/forgot-password/status', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const cleanEmail = String(req.query.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني مطلوب' });
    }
    const allRequests = await getMergedPasswordResets();
    const matched = allRequests.find(
      (r) => r.userEmail && r.userEmail.toLowerCase().trim() === cleanEmail
    );
    if (!matched) {
      return res.json({ success: true, found: false, request: null });
    }
    return res.json({
      success: true,
      found: true,
      request: {
        id: matched.id,
        status: matched.status,
        requestedAt: matched.requestedAt,
        resolvedAt: matched.resolvedAt,
        adminNotes: matched.adminNotes,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'تعذر التحقق من حالة الطلب' });
  }
});

// ==========================================
// Two-Factor Authentication (Google Authenticator) Endpoints
// ==========================================

// 1. Verify 2FA challenge during login
app.post('/api/2fa/verify-login', async (req: Request, res: Response) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      return res.status(400).json({
        success: false,
        message: 'رمز التحقق مطلوب للمتابعة',
      });
    }

    const pending = temp2FALoginStore.get(tempToken);
    if (!pending || pending.expiresAt < Date.now()) {
      temp2FALoginStore.delete(tempToken);
      return res.status(401).json({
        success: false,
        message: 'انتهت صلاحية جلسة تسجيل الدخول، يرجى إعادة المحاولة من البداية',
      });
    }

    const users = getStoredUsers();
    const userIndex = users.findIndex(
      (u) => u.id === pending.userId || u.email.toLowerCase() === pending.email.toLowerCase()
    );

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على الحساب',
      });
    }

    const user = users[userIndex];
    const cleanCode = String(code).trim().toUpperCase();

    // Check if code is a valid 6-digit TOTP
    let isValid = false;
    let usedBackup = false;

    if (/^\d{6}$/.test(cleanCode) && user.twoFactorSecret) {
      isValid = verifyTOTP(cleanCode, user.twoFactorSecret, 1);
    }

    // If not valid TOTP, check if it's one of the backup recovery codes
    if (!isValid && Array.isArray(user.twoFactorBackupCodes)) {
      const normalizedInput = cleanCode.replace(/[^A-Z0-9]/g, '');
      const backupIndex = user.twoFactorBackupCodes.findIndex(
        (b) => b.replace(/[^A-Z0-9]/g, '').toUpperCase() === normalizedInput
      );
      if (backupIndex !== -1) {
        isValid = true;
        usedBackup = true;
        // Consume the backup code
        user.twoFactorBackupCodes.splice(backupIndex, 1);
        users[userIndex] = user;
        saveStoredUsers(users);
      }
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'رمز التحقق غير صحيح! يرجى التأكد من مطابقة الوقت في هاتفك أو استخدام أحد الرموز الاحتياطية',
      });
    }

    // Code verified! Remove tempToken
    temp2FALoginStore.delete(tempToken);

    // Issue full session
    const adminEmails = getAdminEmails();
    const isAdmin = Boolean(pending.isAdmin || adminEmails.includes(user.email.toLowerCase()));
    const session = createSession(user.id, user.email, user.name, isAdmin, user.displayId);

    recordGeneralSiteLog({
      category: 'auth',
      userId: user.id,
      displayId: user.displayId,
      email: user.email,
      userName: user.name,
      action: '2fa_login_verified',
      actionLabelAr: 'تحقق ناجح من المصادقة الثنائية للدخول',
      details: usedBackup ? 'باستخدام رمز احتياطي' : 'باستخدام رمز TOTP',
      ip: getClientIp(req),
      status: 'success',
    });

    return res.json({
      success: true,
      message: usedBackup
        ? `تم تسجيل الدخول بنجاح باستخدام الرمز الاحتياطي! تبقى لديك ${user.twoFactorBackupCodes?.length || 0} رموز احتياطية.`
        : `تم التحقق بنجاح! مرحباً بك يا ${user.name}`,
      token: session.token,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      refreshExpiresAt: session.refreshExpiresAt,
      refreshExpiresInDays: 30,
      isAdmin,
      user: {
        id: user.id,
        displayId: user.displayId,
        name: user.name,
        email: user.email,
        photoUrl: user.photoUrl,
        createdAt: user.createdAt,
        birthDate: user.birthDate || null,
        gender: user.gender || null,
        country: user.country || null,
        bio: user.bio || getDefaultUserBio(),
        walletBalance: user.walletBalance ?? (isAdmin ? 99999 : 0),
        coinsBalance: user.coinsBalance ?? (isAdmin ? 100000 : 0),
        isAdmin,
        twoFactorEnabled: true,
        isVerified: Boolean(user.isVerified),
      },
    });
  } catch (err: any) {
    console.error('2FA verify-login error:', err);
    return res.status(500).json({
      success: false,
      message: 'حدث خطأ أثناء التحقق: ' + (err?.message || 'خطأ غير متوقع'),
    });
  }
});

// 2. Setup 2FA: Generate secret, QR code data URL, and backup codes for the user
app.post('/api/2fa/setup', async (req: Request, res: Response) => {
  try {
    const authHeader = (req.headers['authorization'] as string) || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    const refreshToken = ((req.headers['x-refresh-token'] as string) || '').trim();

    if (!token && !refreshToken) {
      return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول لتفعيل المصادقة الثنائية' });
    }

    const tokenResult = await verifyToken(token || '', refreshToken);
    if (!tokenResult.valid || !tokenResult.user) {
      return res.status(401).json({ success: false, message: tokenResult.reason || 'جلسة الدخول منتهية' });
    }

    const user = tokenResult.user;
    const secret = generateTotpSecret(20);
    const backupCodes = generateBackupCodes(8);
    const otpUri = generateTotpUri(user.email || user.name, 'Soul-X', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpUri, {
      width: 280,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    // Store in pending map (15 minutes expiry)
    pending2FASetup.set(user.id, {
      secret,
      backupCodes,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    const formattedKey = secret.match(/.{1,4}/g)?.join(' ') || secret;

    return res.json({
      success: true,
      secret,
      manualEntryKey: formattedKey,
      backupCodes,
      qrCodeDataUrl,
    });
  } catch (err: any) {
    console.error('2FA setup error:', err);
    return res.status(500).json({ success: false, message: 'فشل إنشاء إعدادات المصادقة: ' + (err?.message || 'خطأ') });
  }
});

// 3. Confirm & Enable 2FA: Requires user to enter the 6-digit TOTP code generated by Google Authenticator
app.post('/api/2fa/enable', async (req: Request, res: Response) => {
  try {
    const authHeader = (req.headers['authorization'] as string) || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    const refreshToken = ((req.headers['x-refresh-token'] as string) || '').trim();

    if (!token && !refreshToken) {
      return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول لتفعيل المصادقة' });
    }

    const tokenResult = await verifyToken(token || '', refreshToken);
    if (!tokenResult.valid || !tokenResult.user) {
      return res.status(401).json({ success: false, message: tokenResult.reason || 'جلسة الدخول منتهية' });
    }

    const { code } = req.body;
    if (!code || !/^\d{6}$/.test(String(code).trim())) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إدخال رمز التحقق المكون من 6 أرقام من تطبيق Google Authenticator',
      });
    }

    const pending = pending2FASetup.get(tokenResult.user.id);
    if (!pending || pending.expiresAt < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'انتهت صلاحية جلسة الإعداد، يرجى الضغط على زر التفعيل مرة أخرى',
      });
    }

    // Verify TOTP code against pending secret
    const isValid = verifyTOTP(String(code).trim(), pending.secret, 1);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'رمز التحقق غير صحيح! تأكد من إدخال الكود الظاهر حالياً في تطبيق Google Authenticator ومزامنة الوقت بهاتفك',
      });
    }

    // Valid -> Save to user permanently
    const users = getStoredUsers();
    const userIndex = users.findIndex(
      (u) => u.id === tokenResult.user.id || u.email.toLowerCase() === tokenResult.user.email.toLowerCase()
    );

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    users[userIndex].twoFactorEnabled = true;
    users[userIndex].twoFactorSecret = pending.secret;
    users[userIndex].twoFactorBackupCodes = pending.backupCodes;
    users[userIndex].twoFactorEnabledAt = new Date().toISOString();
    saveStoredUsers(users);

    pending2FASetup.delete(tokenResult.user.id);

    const enabledUser = users[userIndex];
    if (enabledUser && enabledUser.email.toLowerCase() !== getAdmin1Email() && enabledUser.email.toLowerCase() !== getAdmin2Email()) {
      recordUserActivityLog({
        userId: enabledUser.id,
        displayId: enabledUser.displayId,
        email: enabledUser.email,
        name: enabledUser.name,
        action: '2fa_enable',
        actionLabelAr: 'تفعيل المصادقة الثنائية (2FA)',
        ip: getClientIp(req),
      });
    }

    return res.json({
      success: true,
      message: 'تم تفعيل المصادقة الثنائية (Google Authenticator) بنجاح!',
      twoFactorEnabled: true,
      backupCodes: pending.backupCodes,
    });
  } catch (err: any) {
    console.error('2FA enable error:', err);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء التفعيل: ' + (err?.message || 'خطأ') });
  }
});

// 4. Disable 2FA: "بعد التفعيل يتطلب كود تحقق مصادقة حتى الغائه يطلب كود التحقق"
app.post('/api/2fa/disable', async (req: Request, res: Response) => {
  try {
    const authHeader = (req.headers['authorization'] as string) || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    const refreshToken = ((req.headers['x-refresh-token'] as string) || '').trim();

    if (!token && !refreshToken) {
      return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول لتعطيل المصادقة' });
    }

    const tokenResult = await verifyToken(token || '', refreshToken);
    if (!tokenResult.valid || !tokenResult.user) {
      return res.status(401).json({ success: false, message: tokenResult.reason || 'جلسة الدخول منتهية' });
    }

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'كود التحقق مطلوب لإلغاء تفعيل المصادقة الثنائية',
      });
    }

    const users = getStoredUsers();
    const userIndex = users.findIndex(
      (u) => u.id === tokenResult.user.id || u.email.toLowerCase() === tokenResult.user.email.toLowerCase()
    );

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    const user = users[userIndex];
    if (!user.twoFactorEnabled) {
      return res.json({ success: true, message: 'المصادقة الثنائية معطلة بالفعل', twoFactorEnabled: false });
    }

    const cleanCode = String(code).trim().toUpperCase();
    let isValid = false;

    // Verify 6-digit TOTP
    if (/^\d{6}$/.test(cleanCode) && user.twoFactorSecret) {
      isValid = verifyTOTP(cleanCode, user.twoFactorSecret, 1);
    }

    // Or check backup code
    if (!isValid && Array.isArray(user.twoFactorBackupCodes)) {
      const normalizedInput = cleanCode.replace(/[^A-Z0-9]/g, '');
      const backupIndex = user.twoFactorBackupCodes.findIndex(
        (b) => b.replace(/[^A-Z0-9]/g, '').toUpperCase() === normalizedInput
      );
      if (backupIndex !== -1) {
        isValid = true;
      }
    }

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'رمز التحقق غير صحيح! لا يمكن تعطيل المصادقة دون إدخال كود التحقق من Google Authenticator أو رمز استرداد احتياطي.',
      });
    }

    // Clear 2FA data
    users[userIndex].twoFactorEnabled = false;
    users[userIndex].twoFactorSecret = undefined;
    users[userIndex].twoFactorBackupCodes = undefined;
    users[userIndex].twoFactorEnabledAt = undefined;
    saveStoredUsers(users);

    const disabledUser = users[userIndex];
    if (disabledUser && disabledUser.email.toLowerCase() !== getAdmin1Email() && disabledUser.email.toLowerCase() !== getAdmin2Email()) {
      recordUserActivityLog({
        userId: disabledUser.id,
        displayId: disabledUser.displayId,
        email: disabledUser.email,
        name: disabledUser.name,
        action: '2fa_disable',
        actionLabelAr: 'تعطيل المصادقة الثنائية (2FA)',
        ip: getClientIp(req),
      });
    }

    return res.json({
      success: true,
      message: 'تم تعطيل المصادقة الثنائية بنجاح!',
      twoFactorEnabled: false,
    });
  } catch (err: any) {
    console.error('2FA disable error:', err);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء تعطيل المصادقة: ' + (err?.message || 'خطأ') });
  }
});

// 5. Get current user 2FA status
app.get('/api/2fa/status', async (req: Request, res: Response) => {
  try {
    const authHeader = (req.headers['authorization'] as string) || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    const refreshToken = ((req.headers['x-refresh-token'] as string) || '').trim();

    if (!token && !refreshToken) {
      return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول' });
    }

    const tokenResult = await verifyToken(token || '', refreshToken);
    if (!tokenResult.valid || !tokenResult.user) {
      return res.status(401).json({ success: false, message: 'جلسة منتهية' });
    }

    const users = getStoredUsers();
    const user = users.find(
      (u) => u.id === tokenResult.user.id || u.email.toLowerCase() === tokenResult.user.email.toLowerCase()
    );

    return res.json({
      success: true,
      twoFactorEnabled: Boolean(user?.twoFactorEnabled),
      twoFactorEnabledAt: user?.twoFactorEnabledAt || null,
      backupCodesCount: user?.twoFactorBackupCodes?.length || 0,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'خطأ في جلب حالة المصادقة' });
  }
});

// 5. Endpoint: رفع الصورة الشخصية للملف الشخصي وتخزينها
app.post('/api/profile/upload-avatar', async (req: Request, res: Response) => {
  try {
    const { userId, fileData, avatarUrl } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }

    const cleanUserId = String(userId);
    const photo = fileData || avatarUrl;
    if (!photo) {
      return res.status(400).json({ success: false, message: 'بيانات الصورة مطلوبة' });
    }

    // Update in local stored users
    const users = getStoredUsers();
    const userIndex = users.findIndex((u) => u.id === cleanUserId || u.displayId === cleanUserId);
    if (userIndex !== -1) {
      users[userIndex].photoUrl = photo;
      saveStoredUsers(users);
    }

    // Sync to Neon PostgreSQL
    await updateNeonProfileByIdentifier(cleanUserId, {
      photoUrl: photo,
    }).catch((err) => {
      console.warn('Neon upload-avatar sync error:', err?.message || err);
    });

    // Sync to Supabase if configured
    if (supabaseAdmin) {
      try {
        await supabaseAdmin
          .from('profiles')
          .update({
            avatar_url: photo,
            updated_at: new Date().toISOString(),
          })
          .or(`id.eq.${cleanUserId},display_id.eq.${cleanUserId}`);
      } catch (sbErr) {
        console.warn('Supabase upload-avatar sync error:', sbErr);
      }
    }

    const avatarUploader = users.find((x) => x.id === cleanUserId || x.displayId === cleanUserId);
    recordGeneralSiteLog({
      category: 'profile',
      userId: avatarUploader?.id || cleanUserId,
      displayId: avatarUploader?.displayId,
      email: avatarUploader?.email,
      userName: avatarUploader?.name,
      action: 'upload_avatar',
      actionLabelAr: 'تحديث الصورة الشخصية',
      ip: getClientIp(req),
      status: 'success',
    });

    return res.json({
      success: true,
      avatarUrl: photo,
      message: 'تم حفظ الصورة الشخصية بنجاح',
    });
  } catch (err: any) {
    console.error('Upload avatar error:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء حفظ الصورة الشخصية',
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

    recordGeneralSiteLog({
      category: 'profile',
      userId: u?.id || cleanUserId,
      displayId: u?.displayId,
      email: u?.email,
      userName: u?.name,
      action: 'delete_avatar',
      actionLabelAr: 'حذف الصورة الشخصية',
      ip: getClientIp(req),
      status: 'success',
    });

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

// 8. Endpoint: بحث عن مستخدم بالمعرف أو الباركود (يشترط مطابقة 70% على الأقل من المعرف بدون اقتراحات عامة)
function computeIdMatchRatio(queryRaw: string, candidateRaw: string): number {
  const q = String(queryRaw || '').trim().toLowerCase().replace(/[-\s]/g, '');
  const c = String(candidateRaw || '').trim().toLowerCase().replace(/[-\s]/g, '');
  if (!q || !c) return 0;
  if (q === c) return 1;
  if (q.length > 128 || c.length > 128) return 0;

  const m = q.length;
  const n = c.length;
  const dp = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    let prev = 0;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (q[i - 1] === c[j - 1]) {
        dp[j] = prev + 1;
      } else if (dp[j - 1] > dp[j]) {
        dp[j] = dp[j - 1];
      }
      prev = temp;
    }
  }
  return dp[n] / Math.max(m, n);
}

app.get('/api/users/search', async (req: Request, res: Response) => {
  const rawQuery = ((req.query.q as string) || '').trim();
  const query = rawQuery.toLowerCase();
  const currentUserId = ((req.query.currentUserId as string) || '').trim().toLowerCase();

  // إزالة اقتراحات النتائج تماماً عند عدم وجود بحث بالمعرف
  if (!query) {
    return res.json({ success: true, users: [] });
  }

  const storedUsers = getStoredUsers();

  const maleDefaultSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="#1e40af"/><circle cx="80" cy="65" r="28" fill="#fed7aa"/><path d="M35 140c0-26 20-42 45-42s45 16 45 42z" fill="#3b82f6"/></svg>');
  const femaleDefaultSvg = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="#db2777"/><circle cx="80" cy="65" r="28" fill="#fce7f3"/><path d="M35 140c0-26 20-42 45-42s45 16 45 42z" fill="#ec4899"/></svg>');

  // Fetch real profiles from Supabase Database
  let supabaseProfiles: any[] = [];
  if (supabaseAdmin) {
    try {
      const { data: dbProfiles, error: sbSearchError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .limit(500);
      if (sbSearchError) {
        console.warn('Supabase profiles query error in search:', sbSearchError);
      }

      if (dbProfiles) {
        supabaseProfiles = dbProfiles.map((p: any) => ({
          id: p.display_id || p.id,
          displayId: p.display_id || p.id,
          originalId: p.id,
          name: p.name || 'مستخدم Soul-X',
          nameEn: undefined,
          username: p.email ? p.email.split('@')[0] : (p.display_id || p.id),
          bio: p.bio || 'مستخدم مسجل في منصة Soul-X ✨',
          avatar:
            p.avatar_url ||
            (p.gender === 'female' ? femaleDefaultSvg : maleDefaultSvg),
          gender: p.gender || null,
          age: p.birth_date
            ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
            : 24,
          country: p.country || 'المملكة العربية السعودية',
          location: p.country || 'المملكة العربية السعودية',
          matchScore: 95,
          status: 'online' as const,
        }));
      }
    } catch (e) {
      console.warn('Could not query Supabase profiles in search:', e);
    }
  }

  const adminEmails = getAdminEmails();
  const verifiedSet = getVerifiedIdentifierSet(storedUsers);

  // Real registered users from local storage
  const mappedStored = storedUsers.map((u) => {
    const isUserAdmin = Boolean(
      (u.email && adminEmails.includes(u.email.toLowerCase())) ||
      u.id === 'admin-1001' || u.id === 'admin-1002' ||
      u.displayId === '1' || u.displayId === '2' ||
      (u.name && u.name.includes('مدير النظام'))
    );
    return {
      id: u.displayId || u.id,
      displayId: u.displayId || u.id,
      originalId: u.id,
      name: u.name || 'مستخدم Soul-X',
      nameEn: undefined as string | undefined,
      username: u.email ? u.email.split('@')[0] : (u.displayId || u.id),
      bio: u.bio || 'مستخدم مسجل في منصة Soul-X ✨',
      avatar:
        u.photoUrl ||
        (u.gender === 'female' ? femaleDefaultSvg : maleDefaultSvg),
      gender: u.gender || null,
      age: u.birthDate
        ? Math.floor((Date.now() - new Date(u.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
        : 24,
      country: u.country || 'المملكة العربية السعودية',
      location: u.country || 'المملكة العربية السعودية',
      matchScore: isUserAdmin ? 99 : 92,
      status: 'online' as const,
      isAdmin: isUserAdmin,
      isVerified: Boolean(u.isVerified || isUserIdentifierVerified(u.id, verifiedSet)),
    };
  });

  // Ensure default Admin 1 and Admin 2 are in the user pool
  const admin1Account = {
    id: 'admin-1001',
    displayId: '1',
    originalId: 'admin-1001',
    name: 'مدير النظام (ADMIN1)',
    nameEn: 'System Admin (ADMIN1)',
    username: 'admin1',
    bio: 'الحساب الرسمي لإدارة منصة Soul-X (ADMIN 1) 🛡️',
    avatar: maleDefaultSvg,
    gender: 'male' as const,
    age: 28,
    country: 'الجمهورية العربية السورية',
    location: 'الجمهورية العربية السورية',
    matchScore: 99,
    status: 'online' as const,
    isAdmin: true,
  };

  const admin2Account = {
    id: 'admin-1002',
    displayId: '2',
    originalId: 'admin-1002',
    name: 'مدير النظام (ADMIN2)',
    nameEn: 'System Admin (ADMIN2)',
    username: 'admin2',
    bio: 'الحساب الرسمي لإدارة منصة Soul-X (ADMIN 2) 🛡️',
    avatar: maleDefaultSvg,
    gender: 'male' as const,
    age: 29,
    country: 'الجمهورية العربية السورية',
    location: 'الجمهورية العربية السورية',
    matchScore: 99,
    status: 'online' as const,
    isAdmin: true,
  };

  // Merge unique real users
  const userList = [
    ...supabaseProfiles,
    ...mappedStored.filter(
      (m) =>
        !supabaseProfiles.some(
          (s) =>
            s.id === m.id ||
            s.displayId === m.displayId ||
            (m.originalId && s.originalId === m.originalId)
        )
    ),
  ];

  if (!userList.some((u) => u.displayId === '1' || u.id === 'admin-1001')) {
    userList.push(admin1Account);
  }
  if (!userList.some((u) => u.displayId === '2' || u.id === 'admin-1002')) {
    userList.push(admin2Account);
  }

  const combined = userList.filter((u) => {
    if (!currentUserId) return true;
    const uidLower = String(u.id || '').toLowerCase();
    const udispLower = String(u.displayId || '').toLowerCase();
    const uorigLower = String(u.originalId || '').toLowerCase();
    // Allow viewing admins even if querying oneself unless exactly identical id
    if (u.isAdmin && (currentUserId !== uidLower && currentUserId !== udispLower)) return true;
    return (
      uidLower !== currentUserId &&
      udispLower !== currentUserId &&
      uorigLower !== currentUserId
    );
  });

  const scoredResults = combined
    .map((u) => {
      const candidates = [u.displayId, u.id, u.originalId].filter(Boolean) as string[];
      let bestRatio = 0;
      for (const cand of candidates) {
        const ratio = computeIdMatchRatio(rawQuery, cand);
        if (ratio > bestRatio) bestRatio = ratio;
      }
      return { user: u, ratio: bestRatio };
    })
    .filter((entry) => entry.ratio >= 0.7)
    .sort((a, b) => b.ratio - a.ratio)
    .map((entry) => entry.user);

  return res.json({ success: true, users: scoredResults });
});

// Endpoint: جلب الملف الشخصي لمستخدم معين مع العمر والدولة
app.get('/api/users/profile', async (req: Request, res: Response) => {
  const rawTargetId = ((req.query.id as string) || (req.query.userId as string) || (req.query.displayId as string) || '').trim();
  const callerId = ((req.query.callerId as string) || (req.query.myId as string) || '').trim();
  const targetName = ((req.query.name as string) || '').trim();

  let targetId = rawTargetId;
  const storedUsers = getStoredUsers();

  if (targetId.startsWith('conv-')) {
    const rawNoPrefix = targetId.replace('conv-', '');
    if (callerId) {
      if (rawNoPrefix.startsWith(`${callerId}-`)) {
        targetId = rawNoPrefix.slice(callerId.length + 1);
      } else if (rawNoPrefix.endsWith(`-${callerId}`)) {
        targetId = rawNoPrefix.slice(0, -(callerId.length + 1));
      }
    }
    // If targetId is still raw or starts with conv-, match against stored users
    if (targetId === rawTargetId || targetId.startsWith('conv-')) {
      const matched = storedUsers.find((u) => {
        if (callerId && (u.id === callerId || u.displayId === callerId)) return false;
        return (u.id && rawNoPrefix.includes(u.id)) || (u.displayId && rawNoPrefix.includes(u.displayId));
      });
      if (matched) {
        targetId = matched.displayId || matched.id;
      } else {
        const parts = rawNoPrefix.split('-');
        if (callerId) {
          targetId = parts.find((p) => p && p !== callerId) || parts[0];
        } else {
          targetId = parts[0];
        }
      }
    }
  }

  if (!targetId && !targetName) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }
  const targetLower = targetId.toLowerCase();
  const foundLocal = storedUsers.find(
    (u) =>
      (targetId && (u.id === targetId || u.displayId === targetId || u.email.toLowerCase() === targetLower)) ||
      (targetName && u.name.trim().toLowerCase() === targetName.toLowerCase())
  );

  if (foundLocal) {
    const age = foundLocal.birthDate
      ? Math.floor((Date.now() - new Date(foundLocal.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
      : 24;
    return res.json({
      success: true,
      user: {
        id: foundLocal.displayId || foundLocal.id,
        displayId: foundLocal.displayId,
        name: foundLocal.name,
        avatar: foundLocal.photoUrl,
        age,
        country: foundLocal.country || 'المملكة العربية السعودية',
        gender: foundLocal.gender,
        bio: foundLocal.bio,
        isVerified: Boolean(foundLocal.isVerified),
      },
    });
  }

  if (neonPool && targetId) {
    const neonProf = await getNeonProfileByIdentifier(targetId).catch(() => null);
    if (neonProf) {
      const age = neonProf.birthDate
        ? Math.floor((Date.now() - new Date(neonProf.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
        : 24;
      return res.json({
        success: true,
        user: {
          id: neonProf.displayId || neonProf.id,
          displayId: neonProf.displayId,
          name: neonProf.name,
          avatar: neonProf.photoUrl,
          age,
          country: neonProf.country || 'المملكة العربية السعودية',
          gender: neonProf.gender,
          bio: neonProf.bio,
          isVerified: Boolean(neonProf.isVerified),
        },
      });
    }
  }

  if (supabaseAdmin) {
    try {
      const orQueries: string[] = [];
      if (targetId) orQueries.push(`id.eq.${targetId}`, `display_id.eq.${targetId}`, `email.ilike.${targetId}`);
      if (targetName) orQueries.push(`name.ilike.${targetName}`);

      const { data: dbProfiles } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .or(orQueries.join(','))
        .limit(1);

      if (dbProfiles && dbProfiles.length > 0) {
        const p = dbProfiles[0];
        const age = p.birth_date
          ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
          : 24;
        return res.json({
          success: true,
          user: {
            id: p.display_id || p.id,
            displayId: p.display_id,
            name: p.name,
            avatar: p.avatar_url,
            age,
            country: p.country || 'المملكة العربية السعودية',
            gender: p.gender,
            bio: p.bio,
            isVerified: Boolean(p.is_verified),
          },
        });
      }
    } catch {}
  }

  return res.json({
    success: true,
    user: {
      id: targetId || rawTargetId,
      name: targetName || 'مستخدم Soul-X',
      age: 24,
      country: 'المملكة العربية السعودية',
    },
  });
});

// ==========================================
// Blocked Users Endpoints (حظر المستخدمين وإدارتهم)
// ==========================================

// Endpoint: جلب قائمة المستخدمين المحظورين للمستخدم الحالي
app.get('/api/users/blocked', async (req: Request, res: Response) => {
  try {
    const rawUserId = ((req.query.userId as string) || (req.headers['x-user-id'] as string) || '').trim();
    const rawDisplayId = ((req.query.displayId as string) || '').trim();
    const rawEmail = ((req.query.email as string) || (req.headers['x-user-email'] as string) || '').trim();

    let effectiveUserId = rawUserId;
    if (!effectiveUserId) {
      const authHeader = (req.headers['authorization'] as string) || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
      if (token) {
        const verifyRes = await verifyToken(token);
        if (verifyRes.valid && verifyRes.user) {
          effectiveUserId = verifyRes.user.id;
        }
      }
    }

    if (!effectiveUserId && !rawDisplayId && !rawEmail) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }

    const identSet = await getUserIdentifierSet(effectiveUserId, rawEmail, rawDisplayId);
    const blockedList = getStoredBlockedUsers();
    const allUsers = getStoredUsers();

    // Filter to those blocked by THIS user
    const myBlocked = blockedList.filter((item) => {
      const bIds = [item.blockerId, item.blockerDisplayId].filter(Boolean) as string[];
      return bIds.some((k) => identSet.has(k) || identSet.has(k.toLowerCase()));
    });

    const result = myBlocked.map((item) => {
      const targetUser = allUsers.find(
        (u) =>
          (u.id && (u.id === item.blockedId || u.id === item.blockedDisplayId)) ||
          (u.displayId && (u.displayId === item.blockedDisplayId || u.displayId === item.blockedId))
      );
      return {
        id: item.id,
        blockerId: item.blockerId,
        blockerDisplayId: item.blockerDisplayId,
        blockedId: item.blockedId,
        blockedDisplayId: item.blockedDisplayId || targetUser?.displayId,
        name: targetUser?.name || item.blockedName || 'مستخدم Soul-X',
        displayId: targetUser?.displayId || item.blockedDisplayId || item.blockedId,
        photoUrl: targetUser?.photoUrl || item.blockedAvatar || '',
        gender: targetUser?.gender || null,
        country: targetUser?.country || null,
        bio: targetUser?.bio || '',
        blockedAt: item.blockedAt,
        isVerified: Boolean(targetUser?.isVerified),
      };
    });

    return res.json({ success: true, blockedUsers: result });
  } catch (err: any) {
    console.error('Error fetching blocked users:', err);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء جلب قائمة المحظورين' });
  }
});

// Endpoint: حظر مستخدم
app.post('/api/users/block', async (req: Request, res: Response) => {
  try {
    const { userId, targetUserId, targetName, targetAvatar, targetDisplayId } = req.body;
    if (!userId || !targetUserId) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم والمستخدم المراد حظره مطلوبان' });
    }

    const allUsers = getStoredUsers();
    const blockerSet = await getUserIdentifierSet(userId);
    const targetSet = await getUserIdentifierSet(targetUserId);

    // Prevent self-block
    if (Array.from(targetSet).some((k) => blockerSet.has(k) || blockerSet.has(k.toLowerCase()))) {
      return res.status(400).json({ success: false, message: 'لا يمكنك حظر حسابك الشخصي' });
    }

    const blockerUser = allUsers.find((u) => blockerSet.has(u.id) || (u.displayId && blockerSet.has(u.displayId)));
    const targetUser = allUsers.find((u) => targetSet.has(u.id) || (u.displayId && targetSet.has(u.displayId)));

    const blockedList = getStoredBlockedUsers();

    // Check if already blocked
    const alreadyBlocked = blockedList.some((item) => {
      const bIds = [item.blockerId, item.blockerDisplayId].filter(Boolean) as string[];
      const tIds = [item.blockedId, item.blockedDisplayId].filter(Boolean) as string[];
      const isMe = bIds.some((k) => blockerSet.has(k) || blockerSet.has(k.toLowerCase()));
      const isTarget = tIds.some((k) => targetSet.has(k) || targetSet.has(k.toLowerCase()));
      return isMe && isTarget;
    });

    if (!alreadyBlocked) {
      const newBlockRecord: StoredBlockedUser = {
        id: `blk-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        blockerId: blockerUser?.id || userId,
        blockerDisplayId: blockerUser?.displayId,
        blockedId: targetUser?.id || targetUserId,
        blockedDisplayId: targetUser?.displayId || targetDisplayId,
        blockedName: targetUser?.name || targetName || 'مستخدم',
        blockedAvatar: targetUser?.photoUrl || targetAvatar || '',
        blockedAt: new Date().toISOString(),
      };
      blockedList.push(newBlockRecord);
      saveStoredBlockedUsers(blockedList);
    }

    // Automatically remove friendship if existing between the two
    try {
      const friendsData = getStoredFriendsData();
      const initialCount = friendsData.friends.length;
      friendsData.friends = friendsData.friends.filter((f) => {
        const hasBlocker =
          blockerSet.has(f.userId) ||
          (f.userDisplayId && blockerSet.has(f.userDisplayId)) ||
          blockerSet.has(f.friendId) ||
          (f.friendDisplayId && blockerSet.has(f.friendDisplayId));
        const hasTarget =
          targetSet.has(f.userId) ||
          (f.userDisplayId && targetSet.has(f.userDisplayId)) ||
          targetSet.has(f.friendId) ||
          (f.friendDisplayId && targetSet.has(f.friendDisplayId));
        return !(hasBlocker && hasTarget);
      });
      // Also cancel any pending friend requests between them
      friendsData.requests = (friendsData.requests || []).filter((r) => {
        const hasBlocker =
          blockerSet.has(r.senderId) ||
          (r.senderDisplayId && blockerSet.has(r.senderDisplayId)) ||
          blockerSet.has(r.receiverId) ||
          (r.receiverDisplayId && blockerSet.has(r.receiverDisplayId));
        const hasTarget =
          targetSet.has(r.senderId) ||
          (r.senderDisplayId && targetSet.has(r.senderDisplayId)) ||
          targetSet.has(r.receiverId) ||
          (r.receiverDisplayId && targetSet.has(r.receiverDisplayId));
        return !(hasBlocker && hasTarget);
      });
      if (friendsData.friends.length !== initialCount) {
        saveStoredFriendsData(friendsData);
      }
    } catch {}

    if (blockerUser && blockerUser.email.toLowerCase() !== getAdmin1Email() && blockerUser.email.toLowerCase() !== getAdmin2Email()) {
      recordUserActivityLog({
        userId: blockerUser.id,
        displayId: blockerUser.displayId,
        email: blockerUser.email,
        name: blockerUser.name,
        action: 'block_user',
        actionLabelAr: 'حظر مستخدم',
        details: `حظر: ${targetUser?.name || targetName || targetUserId} (${targetUser?.email || targetUserId})`,
        ip: getClientIp(req),
      });
    }

    return res.json({ success: true, message: 'تم حظر المستخدم بنجاح' });
  } catch (err: any) {
    console.error('Error blocking user:', err);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء حظر المستخدم' });
  }
});

// Endpoint: إلغاء حظر مستخدم (فك الحظر)
app.post('/api/users/unblock', async (req: Request, res: Response) => {
  try {
    const { userId, targetUserId } = req.body;
    if (!userId || !targetUserId) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم والمستخدم المراد إلغاء حظره مطلوبان' });
    }

    const blockerSet = await getUserIdentifierSet(userId);
    const targetSet = await getUserIdentifierSet(targetUserId);

    const blockedList = getStoredBlockedUsers();
    const initialLen = blockedList.length;

    const remaining = blockedList.filter((item) => {
      const bIds = [item.blockerId, item.blockerDisplayId].filter(Boolean) as string[];
      const tIds = [item.blockedId, item.blockedDisplayId].filter(Boolean) as string[];
      const isMe = bIds.some((k) => blockerSet.has(k) || blockerSet.has(k.toLowerCase()));
      const isTarget = tIds.some((k) => targetSet.has(k) || targetSet.has(k.toLowerCase()));
      return !(isMe && isTarget);
    });

    if (remaining.length !== initialLen) {
      saveStoredBlockedUsers(remaining);
    }

    const unblockerUser = getStoredUsers().find(
      (u) => blockerSet.has(u.id) || (u.displayId && blockerSet.has(u.displayId))
    );
    if (unblockerUser && unblockerUser.email.toLowerCase() !== getAdmin1Email() && unblockerUser.email.toLowerCase() !== getAdmin2Email()) {
      recordUserActivityLog({
        userId: unblockerUser.id,
        displayId: unblockerUser.displayId,
        email: unblockerUser.email,
        name: unblockerUser.name,
        action: 'unblock_user',
        actionLabelAr: 'إلغاء حظر مستخدم',
        details: `فك الحظر عن: ${targetUserId}`,
        ip: getClientIp(req),
      });
    }

    return res.json({ success: true, message: 'تم إلغاء الحظر بنجاح' });
  } catch (err: any) {
    console.error('Error unblocking user:', err);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء إلغاء الحظر' });
  }
});

// Endpoint: التحقق من حالة الحظر بين مستخدمين
app.get('/api/users/block-status', async (req: Request, res: Response) => {
  try {
    const userId = ((req.query.userId as string) || '').trim();
    const targetUserId = ((req.query.targetUserId as string) || '').trim();

    if (!userId || !targetUserId) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم والمستخدم الهدف مطلوبان' });
    }

    const check = await isUserBlockedPair(userId, targetUserId);
    return res.json({
      success: true,
      isBlocked: check.isBlocked,
      isBlockedByMe: check.blockedByA,
      isBlockedByThem: check.blockedByB,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'Error checking block status' });
  }
});

// 6. Endpoint: قائمة الأصدقاء والطلبات الحقيقية للمستخدم من Supabase وقاعدة البيانات
app.get('/api/friends/list', async (req: Request, res: Response) => {
  const userId = ((req.query.userId as string) || '').trim();
  const displayId = ((req.query.displayId as string) || '').trim();
  const email = ((req.query.email as string) || '').trim();

  if (!userId && !displayId && !email) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const identSet = await getUserIdentifierSet(userId, email, displayId);
  const localData = getStoredFriendsData();
  const allUsers = getStoredUsers();

  let friendsList: any[] = [];
  let incomingRequests: any[] = [];
  let sentRequests: any[] = [];

  if (supabaseAdmin) {
    try {
      const resolvedUids = new Set<string>();
      for (const id of Array.from(identSet)) {
        if (id) {
          const resolved = await resolveProfileId(id);
          if (resolved) resolvedUids.add(resolved);
        }
      }

      const uidList = Array.from(resolvedUids);

      if (uidList.length > 0) {
        // 1. Fetch friendships from Supabase public.friends
        const orConditions = uidList.map((u) => `user_id.eq.${u},friend_id.eq.${u}`).join(',');
        const { data: dbFriendships } = await supabaseAdmin
          .from('friends')
          .select('user_id, friend_id')
          .or(orConditions);

        if (dbFriendships && dbFriendships.length > 0) {
          const friendUids = dbFriendships.map((f: any) =>
            resolvedUids.has(f.user_id) ? f.friend_id : f.user_id
          );
          const { data: dbProfiles } = await supabaseAdmin
            .from('profiles')
            .select('id, display_id, name, avatar_url, bio, birth_date, country')
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
              age: p.birth_date
                ? Math.floor((Date.now() - new Date(p.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
                : 24,
              country: p.country || 'المملكة العربية السعودية',
            }));
          }
        }

        // 2. Fetch requests from Supabase public.friend_requests
        const reqOrConditions = uidList.map((u) => `receiver_id.eq.${u},sender_id.eq.${u}`).join(',');
        const { data: dbRequests } = await supabaseAdmin
          .from('friend_requests')
          .select('*')
          .or(reqOrConditions);

        if (dbRequests && dbRequests.length > 0) {
          const allRelatedIds = Array.from(
            new Set(dbRequests.flatMap((r: any) => [r.sender_id, r.receiver_id]))
          );
          const { data: reqProfiles } = await supabaseAdmin
            .from('profiles')
            .select('id, display_id, name, avatar_url, bio')
            .in('id', allRelatedIds);

          const profileMap = new Map<string, any>((reqProfiles || []).map((p: any) => [p.id, p]));

          incomingRequests = dbRequests
            .filter((r: any) => resolvedUids.has(r.receiver_id) && r.status === 'pending')
            .map((r: any) => {
              const sender = profileMap.get(r.sender_id);
              return {
                id: r.id,
                senderId: sender?.display_id || r.sender_id,
                receiverId: userId || displayId,
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
            .filter((r: any) => resolvedUids.has(r.sender_id) && r.status === 'pending')
            .map((r: any) => {
              const receiver = profileMap.get(r.receiver_id);
              return {
                id: r.id,
                senderId: userId || displayId,
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
      }
    } catch (dbErr) {
      console.warn('Friends list database query warning:', dbErr);
    }
  }

  // Merge with local persistent friendships (bidirectional check against all user aliases in identSet)
  const userFriendships = localData.friends.filter(
    (f) =>
      identSet.has(f.userId) ||
      (f.userDisplayId && identSet.has(f.userDisplayId)) ||
      identSet.has(f.friendId) ||
      (f.friendDisplayId && identSet.has(f.friendDisplayId))
  );

  for (const f of userFriendships) {
    const isUserSide = identSet.has(f.userId) || (f.userDisplayId && identSet.has(f.userDisplayId));
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
        age: u?.birthDate
          ? Math.floor((Date.now() - new Date(u.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
          : 24,
        country: u?.country || 'المملكة العربية السعودية',
        isVerified: Boolean(u?.isVerified),
      });
    }
  }

  // Build a comprehensive set of all friend identifiers (UUID, displayId, numeric ID, email)
  const allFriendIdentifiers = new Set<string>();
  for (const f of friendsList) {
    if (f.id) {
      allFriendIdentifiers.add(f.id);
      allFriendIdentifiers.add(f.id.toLowerCase());
    }
    if (f.originalId) {
      allFriendIdentifiers.add(f.originalId);
      allFriendIdentifiers.add(f.originalId.toLowerCase());
    }
  }
  for (const u of allUsers) {
    if (
      (u.id && allFriendIdentifiers.has(u.id)) ||
      (u.displayId && allFriendIdentifiers.has(u.displayId)) ||
      (u.email && allFriendIdentifiers.has(u.email.toLowerCase()))
    ) {
      if (u.id) allFriendIdentifiers.add(u.id);
      if (u.displayId) allFriendIdentifiers.add(u.displayId);
      if (u.email) allFriendIdentifiers.add(u.email.toLowerCase());
    }
  }

  // Self-heal: If any local requests between the user and any existing friend are still marked 'pending', mark them 'accepted'
  let requestsAutoHealed = false;
  for (const r of localData.requests) {
    const isUserSender = identSet.has(r.senderId) || (r.senderDisplayId && identSet.has(r.senderDisplayId));
    const isUserReceiver = identSet.has(r.receiverId) || (r.receiverDisplayId && identSet.has(r.receiverDisplayId));
    if (isUserSender || isUserReceiver) {
      const otherId = isUserSender
        ? (r.receiverDisplayId || r.receiverId)
        : (r.senderDisplayId || r.senderId);
      if (otherId && allFriendIdentifiers.has(otherId) && r.status === 'pending') {
        r.status = 'accepted';
        r.updatedAt = new Date().toISOString();
        requestsAutoHealed = true;
      }
    }
  }
  if (requestsAutoHealed) {
    saveStoredFriendsData(localData);
  }

  // Filter incoming requests from Supabase to exclude users who are already friends
  incomingRequests = incomingRequests.filter((r) => {
    return !allFriendIdentifiers.has(r.senderId) && !allFriendIdentifiers.has(r.id);
  });

  // Filter sent requests from Supabase to exclude users who are already friends or self
  sentRequests = sentRequests.filter((r) => {
    return (
      !allFriendIdentifiers.has(r.receiverId) &&
      !identSet.has(r.receiverId) &&
      !allFriendIdentifiers.has(r.id)
    );
  });

  // Local incoming requests (matched against all user aliases, strictly excluding existing friends)
  const verifiedSetForFriends = getVerifiedIdentifierSet(allUsers);
  const localIncoming = localData.requests.filter(
    (r) =>
      (identSet.has(r.receiverId) || (r.receiverDisplayId && identSet.has(r.receiverDisplayId))) &&
      r.status === 'pending' &&
      !allFriendIdentifiers.has(r.senderId) &&
      (!r.senderDisplayId || !allFriendIdentifiers.has(r.senderDisplayId))
  );
  for (const r of localIncoming) {
    const sId = r.senderDisplayId || r.senderId;
    if (!incomingRequests.some((x) => x.id === r.id || x.senderId === sId || (r.senderId && x.senderId === r.senderId))) {
      const senderVerified = isUserIdentifierVerified(sId, verifiedSetForFriends) || isUserIdentifierVerified(r.senderId, verifiedSetForFriends);
      incomingRequests.push({
        id: r.id,
        senderId: sId,
        receiverId: r.receiverDisplayId || r.receiverId,
        senderName: r.senderName || 'مستخدم Soul-X',
        senderAvatar:
          r.senderAvatar ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        senderBio: r.senderBio || 'طلب صداقة في Soul-X ✨',
        status: r.status,
        createdAt: r.createdAt,
        isVerified: senderVerified,
      });
    }
  }

  // Local sent requests (matched against all user aliases, strictly excluding existing friends and self)
  const localSent = localData.requests.filter(
    (r) =>
      (identSet.has(r.senderId) || (r.senderDisplayId && identSet.has(r.senderDisplayId))) &&
      r.status === 'pending' &&
      !allFriendIdentifiers.has(r.receiverId) &&
      (!r.receiverDisplayId || !allFriendIdentifiers.has(r.receiverDisplayId)) &&
      !identSet.has(r.receiverId) &&
      (!r.receiverDisplayId || !identSet.has(r.receiverDisplayId))
  );
  for (const r of localSent) {
    const recId = r.receiverDisplayId || r.receiverId;
    if (!sentRequests.some((x) => x.id === r.id || x.receiverId === recId || (r.receiverId && x.receiverId === r.receiverId))) {
      const receiverVerified = isUserIdentifierVerified(recId, verifiedSetForFriends) || isUserIdentifierVerified(r.receiverId, verifiedSetForFriends);
      sentRequests.push({
        id: r.id,
        senderId: r.senderDisplayId || r.senderId,
        receiverId: recId,
        senderName: 'أنا',
        receiverName: r.receiverName || 'مستخدم Soul-X',
        receiverAvatar:
          r.receiverAvatar ||
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        receiverBio: r.receiverBio || '',
        status: r.status,
        createdAt: r.createdAt,
        isVerified: receiverVerified,
      });
    }
  }

  // Ensure all Supabase-fetched items also carry accurate isVerified
  friendsList = friendsList.map((f) => ({
    ...f,
    isVerified: Boolean(f.isVerified || isUserIdentifierVerified(f.id, verifiedSetForFriends) || isUserIdentifierVerified(f.originalId, verifiedSetForFriends)),
  }));
  incomingRequests = incomingRequests.map((r) => ({
    ...r,
    isVerified: Boolean(r.isVerified || isUserIdentifierVerified(r.senderId, verifiedSetForFriends)),
  }));
  sentRequests = sentRequests.map((r) => ({
    ...r,
    isVerified: Boolean(r.isVerified || isUserIdentifierVerified(r.receiverId, verifiedSetForFriends)),
  }));

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

  recordGeneralSiteLog({
    refId: `freq:${reqItem.id}`,
    category: 'social',
    userId: senderUser?.id || senderId,
    displayId: effSenderDisplayId,
    email: senderUser?.email,
    userName: effSenderName,
    targetUserId: targetUser?.id || targetUserId,
    targetDisplayId: effTargetDisplayId,
    targetEmail: targetUser?.email,
    targetName: effTargetName,
    action: 'friend_request_sent',
    actionLabelAr: 'إرسال طلب صداقة',
    details: `إلى ${effTargetName} (${effTargetDisplayId})`,
    ip: getClientIp(req),
    status: 'pending',
  });

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
        (r.senderId === rId && r.receiverId === senderId) ||
        (r.senderDisplayId === senderId && r.receiverDisplayId === rId) ||
        (r.senderDisplayId === rId && r.receiverDisplayId === senderId) ||
        (r.senderId === senderId && r.receiverDisplayId === rId) ||
        (r.senderDisplayId === senderId && r.receiverId === rId)
    );
  }

  const effSenderId = reqItem?.senderId || senderId;
  const effReceiverId = reqItem?.receiverId || receiverId || userId;

  const senderIdents = await getUserIdentifierSet(effSenderId, undefined, reqItem?.senderDisplayId);
  const receiverIdents = await getUserIdentifierSet(effReceiverId, undefined, reqItem?.receiverDisplayId);
  const statusValue = action === 'accept' ? 'accepted' : 'declined';

  // Mark ALL matching requests between these two users (in both directions) as accepted or declined
  for (const r of localData.requests) {
    const isIdMatch = requestId && r.id === requestId;
    const isDirectMatch =
      (senderIdents.has(r.senderId) || (r.senderDisplayId && senderIdents.has(r.senderDisplayId))) &&
      (receiverIdents.has(r.receiverId) || (r.receiverDisplayId && receiverIdents.has(r.receiverDisplayId)));
    const isReverseMatch =
      (receiverIdents.has(r.senderId) || (r.senderDisplayId && receiverIdents.has(r.senderDisplayId))) &&
      (senderIdents.has(r.receiverId) || (r.receiverDisplayId && senderIdents.has(r.receiverDisplayId)));

    if (isIdMatch || isDirectMatch || isReverseMatch) {
      r.status = statusValue;
      r.updatedAt = new Date().toISOString();
    }
  }

  if (supabaseAdmin) {
    try {
      if (requestId && isUuidString(requestId)) {
        await supabaseAdmin
          .from('friend_requests')
          .update({ status: statusValue, updated_at: new Date().toISOString() })
          .eq('id', requestId);
      }
      if (effSenderId && effReceiverId) {
        const sUuid = await resolveProfileId(effSenderId);
        const rUuid = await resolveProfileId(effReceiverId);
        if (sUuid && rUuid && isUuidString(sUuid) && isUuidString(rUuid)) {
          await supabaseAdmin
            .from('friend_requests')
            .update({ status: statusValue, updated_at: new Date().toISOString() })
            .or(`and(sender_id.eq.${sUuid},receiver_id.eq.${rUuid}),and(sender_id.eq.${rUuid},receiver_id.eq.${sUuid})`);

          if (action === 'accept') {
            await supabaseAdmin.from('friends').upsert(
              [
                { user_id: sUuid, friend_id: rUuid, created_at: new Date().toISOString() },
                { user_id: rUuid, friend_id: sUuid, created_at: new Date().toISOString() },
              ],
              { onConflict: 'user_id,friend_id' }
            );
          }
        }
      }
    } catch (dbErr) {
      console.warn('Supabase friend response warning:', dbErr);
    }
  }

  if (action === 'accept' && effSenderId && effReceiverId) {
    const sUser = allUsers.find((u) => senderIdents.has(u.id) || (u.displayId && senderIdents.has(u.displayId)));
    const rUser = allUsers.find((u) => receiverIdents.has(u.id) || (u.displayId && receiverIdents.has(u.displayId)));

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
        (senderIdents.has(f.userId) && receiverIdents.has(f.friendId)) ||
        (receiverIdents.has(f.userId) && senderIdents.has(f.friendId)) ||
        (f.userDisplayId && f.friendDisplayId &&
          ((senderIdents.has(f.userDisplayId) && receiverIdents.has(f.friendDisplayId)) ||
           (receiverIdents.has(f.userDisplayId) && senderIdents.has(f.friendDisplayId))))
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

    // إرسال إشعار رسمي لمركز إشعارات المستخدم صاحب الطلب الأصلي بقبول الصداقة
    try {
      createAndSaveUserNotification({
        userId: effSenderId,
        userDisplayId: sDisplayId,
        type: 'friend_request_accepted',
        titleAr: 'قبول طلب صداقة 🤝',
        titleEn: 'Friend Request Accepted 🤝',
        messageAr: `تم قبول طلب الصداقة الذي أرسلته الى: ${rName}`,
        messageEn: `The friend request you sent to ${rName} has been accepted.`,
        metadata: {
          friendId: effReceiverId,
          friendDisplayId: rDisplayId,
          friendName: rName,
          friendAvatar: rAvatar,
        },
      });
    } catch (notifErr) {
      console.warn('Error saving friend acceptance notification:', notifErr);
    }
  }

  saveStoredFriendsData(localData);

  if (effSenderId && effReceiverId) {
    const sU = allUsers.find((u) => senderIdents.has(u.id) || (u.displayId && senderIdents.has(u.displayId)));
    const rU = allUsers.find((u) => receiverIdents.has(u.id) || (u.displayId && receiverIdents.has(u.displayId)));
    recordGeneralSiteLog({
      category: 'social',
      userId: rU?.id || effReceiverId,
      displayId: rU?.displayId,
      email: rU?.email,
      userName: rU?.name || reqItem?.receiverName,
      targetUserId: sU?.id || effSenderId,
      targetDisplayId: sU?.displayId,
      targetEmail: sU?.email,
      targetName: sU?.name || reqItem?.senderName,
      action: action === 'accept' ? 'friend_request_accepted' : 'friend_request_declined',
      actionLabelAr: action === 'accept' ? 'قبول طلب صداقة' : 'رفض طلب صداقة',
      details: `طلب من ${sU?.name || reqItem?.senderName || effSenderId}`,
      ip: getClientIp(req),
      status: action === 'accept' ? 'accepted' : 'declined',
    });
  }

  return res.json({
    success: true,
    message: action === 'accept' ? 'تم قبول طلب الصداقة بنجاح! أصبحتم أصدقاء الآن ✨' : 'تم رفض طلب الصداقة',
    status: action === 'accept' ? 'accepted' : 'declined',
  });
});

// 8a. Endpoint: إلغاء طلب الصداقة المرسل (Cancel Sent Friend Request)
app.post('/api/friends/cancel-request', async (req: Request, res: Response) => {
  const { senderId, targetUserId, requestId } = req.body;
  if (!senderId && !requestId && !targetUserId) {
    return res.status(400).json({ success: false, message: 'معرف الطلب أو المستخدم مطلوب' });
  }

  const localData = getStoredFriendsData();
  const senderIdents = senderId ? await getUserIdentifierSet(senderId) : new Set<string>();
  const targetIdents = targetUserId ? await getUserIdentifierSet(targetUserId) : new Set<string>();

  localData.requests = localData.requests.filter((r) => {
    if (requestId && r.id === requestId) return false;
    if (senderId && targetUserId) {
      const isSenderMatch = senderIdents.has(r.senderId) || (r.senderDisplayId && senderIdents.has(r.senderDisplayId));
      const isTargetMatch = targetIdents.has(r.receiverId) || (r.receiverDisplayId && targetIdents.has(r.receiverDisplayId));
      if (isSenderMatch && isTargetMatch) return false;
    }
    return true;
  });

  saveStoredFriendsData(localData);

  if (supabaseAdmin) {
    try {
      if (requestId && isUuidString(requestId)) {
        await supabaseAdmin.from('friend_requests').delete().eq('id', requestId);
      } else if (senderId && targetUserId) {
        const sUuid = await resolveProfileId(senderId);
        const tUuid = await resolveProfileId(targetUserId);
        if (sUuid && tUuid && isUuidString(sUuid) && isUuidString(tUuid)) {
          await supabaseAdmin
            .from('friend_requests')
            .delete()
            .eq('sender_id', sUuid)
            .eq('receiver_id', tUuid);
        }
      }
    } catch (e) {
      console.warn('Supabase cancel friend request warning:', e);
    }
  }

  return res.json({ success: true, message: 'تم إلغاء طلب الصداقة بنجاح' });
});

// 8b. Endpoint: إلغاء الصداقة وحذف العلاقة من الطرفين (Unfriend)
app.post('/api/friends/remove', async (req: Request, res: Response) => {
  const { userId, friendId, displayId, email, friendDisplayId, friendEmail } = req.body;
  if (!userId || !friendId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم ومعرف الصديق مطلوبان' });
  }

  // Resolve all alias keys for both parties (UUID, displayId, numeric ID, email)
  const userIdents = await getUserIdentifierSet(userId, email, displayId);
  const friendIdents = await getUserIdentifierSet(friendId, friendEmail, friendDisplayId);

  const localData = getStoredFriendsData();

  // 1. Remove from local friends list in both directions matching ANY alias
  const beforeCount = localData.friends.length;
  localData.friends = localData.friends.filter((f) => {
    const isUserSide1 = userIdents.has(f.userId) || (f.userDisplayId && userIdents.has(f.userDisplayId));
    const isFriendSide1 = friendIdents.has(f.friendId) || (f.friendDisplayId && friendIdents.has(f.friendDisplayId));
    const directMatch = isUserSide1 && isFriendSide1;

    const isUserSide2 = userIdents.has(f.friendId) || (f.friendDisplayId && userIdents.has(f.friendDisplayId));
    const isFriendSide2 = friendIdents.has(f.userId) || (f.userDisplayId && friendIdents.has(f.userDisplayId));
    const reverseMatch = isUserSide2 && isFriendSide2;

    return !directMatch && !reverseMatch;
  });

  // 2. Also remove any pending or accepted requests between these two users in both directions
  localData.requests = localData.requests.filter((r) => {
    const isUserSender = userIdents.has(r.senderId) || (r.senderDisplayId && userIdents.has(r.senderDisplayId));
    const isFriendReceiver = friendIdents.has(r.receiverId) || (r.receiverDisplayId && friendIdents.has(r.receiverDisplayId));
    const directMatch = isUserSender && isFriendReceiver;

    const isFriendSender = friendIdents.has(r.senderId) || (r.senderDisplayId && friendIdents.has(r.senderDisplayId));
    const isUserReceiver = userIdents.has(r.receiverId) || (r.receiverDisplayId && userIdents.has(r.receiverDisplayId));
    const reverseMatch = isFriendSender && isUserReceiver;

    return !directMatch && !reverseMatch;
  });

  saveStoredFriendsData(localData);

  // 3. Supabase Deletion if table exists (executed safely with timeouts)
  if (supabaseAdmin && verifiedTablesState.friends) {
    try {
      const uUuid = await resolveProfileId(userId);
      const fUuid = await resolveProfileId(friendId);
      if (uUuid && fUuid && isUuidString(uUuid) && isUuidString(fUuid)) {
        await withTimeout(
          supabaseAdmin.from('friends').delete().eq('user_id', uUuid).eq('friend_id', fUuid),
          2000
        );
        await withTimeout(
          supabaseAdmin.from('friends').delete().eq('user_id', fUuid).eq('friend_id', uUuid),
          2000
        );
        if (verifiedTablesState.friend_requests) {
          await withTimeout(
            supabaseAdmin.from('friend_requests').delete().eq('sender_id', uUuid).eq('receiver_id', fUuid),
            2000
          );
          await withTimeout(
            supabaseAdmin.from('friend_requests').delete().eq('sender_id', fUuid).eq('receiver_id', uUuid),
            2000
          );
        }
      }
    } catch (dbErr) {
      console.warn('Supabase friend delete warning:', dbErr);
    }
  }

  console.log(`🤝 [Soul-X] Unfriended [${userId}] and [${friendId}]. Removed records: ${beforeCount - localData.friends.length}`);

  const usersForLog = getStoredUsers();
  const actorU = usersForLog.find((u) => userIdents.has(u.id) || (u.displayId && userIdents.has(u.displayId)));
  const targetU = usersForLog.find((u) => friendIdents.has(u.id) || (u.displayId && friendIdents.has(u.displayId)));
  recordGeneralSiteLog({
    category: 'social',
    userId: actorU?.id || userId,
    displayId: actorU?.displayId || displayId,
    email: actorU?.email || email,
    userName: actorU?.name,
    targetUserId: targetU?.id || friendId,
    targetDisplayId: targetU?.displayId || friendDisplayId,
    targetEmail: targetU?.email || friendEmail,
    targetName: targetU?.name,
    action: 'friend_removed',
    actionLabelAr: 'إلغاء صداقة',
    details: `إلغاء الصداقة مع ${targetU?.name || friendId}`,
    ip: getClientIp(req),
    status: 'success',
  });

  return res.json({
    success: true,
    message: 'تم إلغاء الصداقة وحذف العلاقة بنجاح',
    removed: true,
  });
});

// ==========================================
// Active Real-Time SSE Message Listeners for Instant Delivery
// ==========================================
const activeMessageClients = new Map<string, Set<Response>>();

function registerMessageClient(key: string, res: Response) {
  const cleanKey = String(key || '').trim().toLowerCase();
  if (!cleanKey) return;
  let set = activeMessageClients.get(cleanKey);
  if (!set) {
    set = new Set<Response>();
    activeMessageClients.set(cleanKey, set);
  }
  set.add(res);
}

function unregisterMessageClient(key: string, res: Response) {
  const cleanKey = String(key || '').trim().toLowerCase();
  if (!cleanKey) return;
  const set = activeMessageClients.get(cleanKey);
  if (set) {
    set.delete(res);
    if (set.size === 0) {
      activeMessageClients.delete(cleanKey);
    }
  }
}

function broadcastChatMessage(identKeys: (string | undefined)[], payload: any) {
  const seenResponses = new Set<Response>();
  const payloadStr = `data: ${JSON.stringify(payload)}\n\n`;

  for (const key of identKeys) {
    if (!key) continue;
    const cleanKey = String(key).trim().toLowerCase();
    const set = activeMessageClients.get(cleanKey);
    if (set) {
      for (const clientRes of set) {
        if (!seenResponses.has(clientRes)) {
          seenResponses.add(clientRes);
          try {
            clientRes.write(payloadStr);
            if (typeof (clientRes as any).flush === 'function') {
              (clientRes as any).flush();
            }
          } catch {}
        }
      }
    }
  }
}

function broadcastToAllClients(payload: any) {
  const seenResponses = new Set<Response>();
  const payloadStr = `data: ${JSON.stringify(payload)}\n\n`;

  for (const set of activeMessageClients.values()) {
    for (const clientRes of set) {
      if (!seenResponses.has(clientRes)) {
        seenResponses.add(clientRes);
        try {
          clientRes.write(payloadStr);
          if (typeof (clientRes as any).flush === 'function') {
            (clientRes as any).flush();
          }
        } catch {}
      }
    }
  }
}

// Endpoint: SSE Stream for real-time messages & instant chat updates
app.get('/api/messages/stream', async (req: Request, res: Response) => {
  const userId = ((req.query.userId as string) || '').trim();
  const displayId = ((req.query.displayId as string) || '').trim();
  const email = ((req.query.email as string) || '').trim();

  if (!userId && !displayId && !email) {
    return res.status(400).end('User identifier required');
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*',
  });

  const identSet = await getUserIdentifierSet(userId, email, displayId);
  const keys = Array.from(identSet);
  for (const k of keys) {
    registerMessageClient(k, res);
  }

  // Initial handshake
  res.write(`: connected\ndata: ${JSON.stringify({ type: 'handshake', status: 'connected' })}\n\n`);

  // Heartbeat ping every 25 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {}
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    for (const k of keys) {
      unregisterMessageClient(k, res);
    }
  });
});

// 9. Endpoint: جلب محادثات ورسائل المستخدم الحقيقية من Supabase وقاعدة البيانات
app.get('/api/conversations/list', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const userId = ((req.query.userId as string) || '').trim();
  const displayId = ((req.query.displayId as string) || '').trim();
  const email = ((req.query.email as string) || '').trim();

  if (!userId && !displayId && !email) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const identSet = await getUserIdentifierSet(userId, email, displayId);
  const messagesData = getStoredMessagesData();
  const friendsData = getStoredFriendsData();
  const allUsers = getStoredUsers();
  let dbConversations: any[] = [];
  let resolvedUid = userId;

  // Query Neon PostgreSQL for persistent conversations & messages
  if (neonPool && verifiedNeonTables.conversations && verifiedNeonTables.messages) {
    try {
      const aliasArray = Array.from(identSet);
      if (aliasArray.length > 0) {
        const partRes: any = await neonPool.query(
          `SELECT DISTINCT conversation_id FROM conversation_participants WHERE user_id = ANY($1::text[])`,
          [aliasArray]
        );
        const convIds = (partRes.rows || []).map((r: any) => r.conversation_id);

        if (convIds.length > 0) {
          const convRes: any = await neonPool.query(
            `SELECT id, created_at, updated_at FROM conversations WHERE id = ANY($1::text[]) ORDER BY updated_at DESC`,
            [convIds]
          );
          const convRows = convRes.rows || [];

          const allPartsRes: any = await neonPool.query(
            `SELECT conversation_id, user_id FROM conversation_participants WHERE conversation_id = ANY($1::text[])`,
            [convIds]
          );
          const allParticipants = allPartsRes.rows || [];

          const msgRes: any = await neonPool.query(
            `SELECT id, conversation_id, sender_id, text, is_gift, gift_cost, created_at, sender_name, gift_icon, gift_name, read, media_type, media_url, audio_duration
             FROM messages
             WHERE conversation_id = ANY($1::text[])
             ORDER BY created_at ASC`,
            [convIds]
          );
          const dbMessages = msgRes.rows || [];

          const deletedKeys = getDeletedUserKeys();
          dbConversations = convRows
            .filter((c: any) => {
              const parts = allParticipants.filter((p: any) => p.conversation_id === c.id);
              return !parts.some((p: any) => deletedKeys.has(String(p.user_id || '').trim().toLowerCase()));
            })
            .map((c: any) => {
            const otherParticipants = allParticipants.filter(
              (p: any) => p.conversation_id === c.id && !identSet.has(p.user_id) && !identSet.has(p.user_id.toLowerCase())
            );
            const matchedOtherPart = otherParticipants.find((p: any) =>
              allUsers.some(
                (u) =>
                  u.id === p.user_id ||
                  u.displayId === p.user_id ||
                  (p.user_id && u.email.toLowerCase() === p.user_id.toLowerCase())
              )
            );
            const part = matchedOtherPart || otherParticipants[0];
            const otherUserId = part ? part.user_id : 'unknown';
            const otherUser = allUsers.find(
              (u) =>
                u.id === otherUserId ||
                u.displayId === otherUserId ||
                (otherUserId && u.email.toLowerCase() === otherUserId.toLowerCase())
            );

            const friendship = friendsData.friends.find((f) => {
              const matchMe =
                identSet.has(f.userId) ||
                (f.userDisplayId && identSet.has(f.userDisplayId)) ||
                identSet.has(f.friendId) ||
                (f.friendDisplayId && identSet.has(f.friendDisplayId));
              const matchOther =
                f.userId === otherUserId ||
                f.userDisplayId === otherUserId ||
                f.friendId === otherUserId ||
                f.friendDisplayId === otherUserId;
              return matchMe && matchOther;
            });

            const isUserSide = friendship
              ? identSet.has(friendship.userId) || (friendship.userDisplayId && identSet.has(friendship.userDisplayId))
              : true;

            const displayName =
              otherUser?.name ||
              (friendship ? (isUserSide ? friendship.friendName : friendship.userName) : undefined) ||
              `صديق Soul-X`;

            const displayAvatar =
              otherUser?.photoUrl ||
              (friendship ? (isUserSide ? friendship.friendAvatar : friendship.userAvatar) : undefined) ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

            const msgs = dbMessages.filter((m: any) => m.conversation_id === c.id);
            const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
            const isFromOther = lastMsg && !identSet.has(lastMsg.sender_id) && !identSet.has(lastMsg.sender_id.toLowerCase());
            const isDbRead = Boolean(lastMsg?.read);
            const unreadMsgs = msgs.filter((m: any) => (!identSet.has(m.sender_id) && !identSet.has(m.sender_id.toLowerCase())) && !m.read);
            const calculatedUnread = !isDbRead ? (unreadMsgs.length > 0 ? unreadMsgs.length : (isFromOther ? 1 : 0)) : 0;

            const partnerAge = otherUser?.birthDate
              ? Math.floor((Date.now() - new Date(otherUser.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
              : 24;
            const partnerCountry = otherUser?.country || 'المملكة العربية السعودية';

            return {
              id: c.id,
              partnerId: otherUser?.displayId || otherUserId,
              name: displayName,
              avatar: displayAvatar,
              status: 'online' as const,
              lastMessage: lastMsg ? lastMsg.text : 'بدء محادثة جديدة',
              time: lastMsg ? (lastMsg.created_at || new Date().toISOString()) : (c.updated_at || c.created_at || new Date().toISOString()),
              createdAt: lastMsg ? (lastMsg.created_at || new Date().toISOString()) : (c.updated_at || c.created_at || new Date().toISOString()),
              unreadCount: calculatedUnread,
              age: partnerAge,
              country: partnerCountry,
              isVerified: Boolean(otherUser?.isVerified),
              messages: msgs.map((m: any) => {
                const rawUrl = m.media_url || m.mediaUrl;
                const rawType = inferMediaType(rawUrl, m.media_type || m.mediaType);
                const resolvedUrl = resolveExternalMediaUrl(m.id, rawUrl, rawType);
                return {
                  id: m.id,
                  sender: (identSet.has(m.sender_id) || identSet.has(m.sender_id.toLowerCase())) ? ('me' as const) : ('them' as const),
                  text: m.text,
                  createdAt: m.created_at || new Date().toISOString(),
                  time: m.created_at || new Date().toISOString(),
                  mediaType: rawType,
                  mediaUrl: resolvedUrl,
                  audioDuration: m.audio_duration !== null && m.audio_duration !== undefined ? Number(m.audio_duration) : m.audioDuration,
                };
              }),
            };
          });
        }
      }
    } catch (neonConvErr) {
      console.warn('Neon conversations list warning:', neonConvErr);
    }
  }

  if (supabaseAdmin && dbConversations.length === 0) {
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
          .select('id, display_id, name, avatar_url, birth_date, country')
          .in('id', otherUserIds);

        const profileMap = new Map<string, any>((partProfiles || []).map((p: any) => [p.id, p]));

        dbConversations = (convRows || []).map((c: any) => {
          const part = (allParticipants || []).find(
            (p: any) => p.conversation_id === c.id && p.user_id !== resolvedUid
          );
          const otherProfile = part ? profileMap.get(part.user_id) : null;
          const msgs = (dbMessages || []).filter((m: any) => m.conversation_id === c.id);
          const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
          const isFromOther = lastMsg && lastMsg.sender_id !== resolvedUid;
          const isDbRead = Boolean(
            (lastMsg as any)?.read ||
            (c as any)?.readBy?.[resolvedUid] ||
            (c as any)?.readBy?.[userId]
          );

          const partnerAge = otherProfile?.birth_date
            ? Math.floor((Date.now() - new Date(otherProfile.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
            : 24;
          const partnerCountry = otherProfile?.country || 'المملكة العربية السعودية';

          return {
            id: c.id,
            partnerId: otherProfile?.display_id || part?.user_id,
            name: otherProfile?.name || `مستخدم ${c.id.substring(0, 6)}`,
            avatar:
              otherProfile?.avatar_url ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
            status: 'online' as const,
            lastMessage: lastMsg ? lastMsg.text : 'بدء محادثة جديدة',
            time: lastMsg ? (lastMsg.created_at || new Date().toISOString()) : new Date().toISOString(),
            unreadCount: isFromOther && !isDbRead ? 1 : 0,
            age: partnerAge,
            country: partnerCountry,
            isVerified: Boolean(otherProfile?.is_verified),
            messages: msgs.map((m: any) => ({
              id: m.id,
              sender: m.sender_id === resolvedUid ? ('me' as const) : ('them' as const),
              text: m.text,
              createdAt: m.created_at || new Date().toISOString(),
              time: m.created_at || new Date().toISOString(),
            })),
          };
        });
      }
    } catch (dbErr) {
      console.warn('Supabase conversations list warning:', dbErr);
    }
  }

  // Format local conversations (bidirectional participant matching across all user aliases)
  const deletedKeysLocal = getDeletedUserKeys();
  const userConvs = messagesData.conversations.filter((c) =>
    c.participants.some((p) => identSet.has(p) || identSet.has(p.toLowerCase())) &&
    !c.participants.some((p) => deletedKeysLocal.has(String(p || '').trim().toLowerCase()))
  );

  const localFormatted = userConvs.map((c) => {
    const otherParticipants = c.participants.filter(
      (p) => !identSet.has(p) && !identSet.has(p.toLowerCase()) && !p.startsWith('conv-')
    );
    const otherUserId =
      otherParticipants.find((p) =>
        allUsers.some(
          (u) => u.id === p || u.displayId === p || (p && u.email.toLowerCase() === p.toLowerCase())
        )
      ) ||
      otherParticipants[0] ||
      c.participants.find((p) => p !== userId && p !== resolvedUid) ||
      'unknown';

    // 1. Participant details saved inside conversation
    const storedDetail =
      c.participantDetails?.[otherUserId] ||
      (Object.values(c.participantDetails || {}).find(
        (d: any) => d && (d.id === otherUserId || d.displayId === otherUserId)
      ));

    // 2. Lookup in friends list
    const friendship = friendsData.friends.find((f) => {
      const matchMe =
        identSet.has(f.userId) ||
        (f.userDisplayId && identSet.has(f.userDisplayId)) ||
        identSet.has(f.friendId) ||
        (f.friendDisplayId && identSet.has(f.friendDisplayId));
      const matchOther =
        f.userId === otherUserId ||
        f.userDisplayId === otherUserId ||
        f.friendId === otherUserId ||
        f.friendDisplayId === otherUserId;
      return matchMe && matchOther;
    });

    const isUserSide = friendship
      ? identSet.has(friendship.userId) || (friendship.userDisplayId && identSet.has(friendship.userDisplayId))
      : true;

    const friendName = friendship
      ? (isUserSide ? friendship.friendName : friendship.userName)
      : undefined;

    const friendAvatar = friendship
      ? (isUserSide ? friendship.friendAvatar : friendship.userAvatar)
      : undefined;

    // 3. Lookup in registered users
    const otherUser = allUsers.find(
      (u) =>
        u.id === otherUserId ||
        u.displayId === otherUserId ||
        (otherUserId && u.email.toLowerCase() === otherUserId.toLowerCase())
    );

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
    const isFromOther = lastMsg && !identSet.has(lastMsg.senderId) && !identSet.has(lastMsg.senderId.toLowerCase());

    const partnerId =
      otherUser?.displayId ||
      storedDetail?.displayId ||
      storedDetail?.id ||
      (friendship ? (isUserSide ? (friendship.friendDisplayId || friendship.friendId) : (friendship.userDisplayId || friendship.userId)) : undefined) ||
      otherUserId;

    const isMarkedRead = Boolean(
      (lastMsg as any)?.read === true ||
      (c as any)?.readBy?.[userId] ||
      (c as any)?.readBy?.[resolvedUid] ||
      (c as any)?.isRead === true
    );

    const partnerAge = otherUser?.birthDate
      ? Math.floor((Date.now() - new Date(otherUser.birthDate).getTime()) / (365.25 * 24 * 3600 * 1000))
      : ((storedDetail as any)?.age || 24);
    const partnerCountry = otherUser?.country || (storedDetail as any)?.country || 'المملكة العربية السعودية';
    const unreadMsgs = c.messages.filter((m) => (!identSet.has(m.senderId) && !identSet.has(m.senderId.toLowerCase())) && !(m as any).read);
    const calculatedUnread = !isMarkedRead ? (unreadMsgs.length > 0 ? unreadMsgs.length : (isFromOther ? 1 : 0)) : 0;

    return {
      id: c.id,
      partnerId,
      name: displayName,
      avatar: displayAvatar,
      status: 'online' as const,
      lastMessage: lastMsg ? lastMsg.text : 'بدء محادثة جديدة',
      time: lastMsg ? (lastMsg.createdAt || new Date().toISOString()) : (c.updatedAt || c.createdAt || new Date().toISOString()),
      createdAt: lastMsg ? (lastMsg.createdAt || new Date().toISOString()) : (c.updatedAt || c.createdAt || new Date().toISOString()),
      unreadCount: calculatedUnread,
      age: partnerAge,
      country: partnerCountry,
      isVerified: Boolean(otherUser?.isVerified),
      messages: c.messages.map((m) => {
        const rawType = inferMediaType(m.mediaUrl, m.mediaType);
        const resolvedUrl = resolveExternalMediaUrl(m.id, m.mediaUrl, rawType);
        return {
          id: m.id,
          sender: (identSet.has(m.senderId) || identSet.has(m.senderId.toLowerCase())) ? ('me' as const) : ('them' as const),
          text: m.text,
          createdAt: m.createdAt || new Date().toISOString(),
          time: m.createdAt || new Date().toISOString(),
          mediaType: rawType,
          mediaUrl: resolvedUrl,
          audioDuration: m.audioDuration,
        };
      }),
    };
  });

  // Merge database and local conversations, combining message threads by message ID
  const convMap = new Map<string, any>();

  for (const c of [...dbConversations, ...localFormatted]) {
    const key = c.id;
    if (!convMap.has(key)) {
      convMap.set(key, { ...c, messages: [...c.messages] });
    } else {
      const existing = convMap.get(key)!;
      // Merge messages by ID
      const msgMap = new Map<string, any>();
      for (const m of existing.messages) {
        msgMap.set(m.id, m);
      }
      for (const m of c.messages) {
        const prevM = msgMap.get(m.id);
        if (prevM) {
          msgMap.set(m.id, {
            ...prevM,
            ...m,
            mediaUrl: m.mediaUrl || prevM.mediaUrl,
            mediaType: m.mediaType || prevM.mediaType,
            audioDuration: m.audioDuration || prevM.audioDuration,
          });
        } else {
          msgMap.set(m.id, m);
        }
      }
      const mergedMsgs = Array.from(msgMap.values());
      mergedMsgs.sort(
        (a, b) => new Date(a.createdAt || a.time || 0).getTime() - new Date(b.createdAt || b.time || 0).getTime()
      );
      const latestMsg = mergedMsgs.length > 0 ? mergedMsgs[mergedMsgs.length - 1] : null;

      existing.messages = mergedMsgs;
      if (latestMsg) {
        existing.lastMessage = latestMsg.text;
        existing.time = latestMsg.createdAt || latestMsg.time;
      }
      if (c.avatar && (!existing.avatar || existing.avatar.includes('photo-1534528741775'))) {
        existing.avatar = c.avatar;
      }
      if (c.name && (!existing.name || existing.name.includes('مستخدم'))) {
        existing.name = c.name;
      }
      if (c.isVerified) {
        existing.isVerified = true;
      }
      if (c.unreadCount > 0) {
        existing.unreadCount = Math.max(existing.unreadCount, c.unreadCount);
      }
    }
  }

  const merged = Array.from(convMap.values());

  const allBlocked = getStoredBlockedUsers();
  const annotated = merged.map((c) => {
    let isBlockedByMe = false;
    let isBlockedByThem = false;
    const pId = c.partnerId;
    if (pId) {
      for (const item of allBlocked) {
        const bIds = [item.blockerId, item.blockerDisplayId].filter(Boolean) as string[];
        const tIds = [item.blockedId, item.blockedDisplayId].filter(Boolean) as string[];

        const meIsBlocker = bIds.some((k) => identSet.has(k) || identSet.has(k.toLowerCase()));
        const partnerIsBlocked = tIds.some((k) => k === pId || k.toLowerCase() === pId.toLowerCase());
        if (meIsBlocker && partnerIsBlocked) isBlockedByMe = true;

        const partnerIsBlocker = bIds.some((k) => k === pId || k.toLowerCase() === pId.toLowerCase());
        const meIsBlocked = tIds.some((k) => identSet.has(k) || identSet.has(k.toLowerCase()));
        if (partnerIsBlocker && meIsBlocked) isBlockedByThem = true;
      }
    }
    return {
      ...c,
      isBlockedByMe,
      isBlockedByThem,
    };
  });

  // ALWAYS sort by latest activity timestamp descending so latest conversation is at top!
  annotated.sort((a, b) => {
    const timeA = new Date(a.time || a.createdAt || 0).getTime();
    const timeB = new Date(b.time || b.createdAt || 0).getTime();
    return timeB - timeA;
  });

  return res.json({ success: true, conversations: annotated });
});

// Endpoint: تمييز الرسائل كمقروءة وإلغاء عداد الرسائل غير المقروءة
app.post('/api/conversations/mark-read', async (req: Request, res: Response) => {
  try {
    const { conversationId, userId } = req.body;
    if (!conversationId && !userId) {
      return res.status(400).json({ success: false, message: 'معرف المحادثة أو المستخدم مطلوب' });
    }

    const messagesData = getStoredMessagesData();
    let updated = false;

    for (const c of messagesData.conversations) {
      const matchConv =
        c.id === conversationId ||
        c.participants.includes(conversationId) ||
        (userId && c.participants.includes(userId) && c.participants.some((p) => p === conversationId || conversationId.includes(p)));

      if (matchConv) {
        (c as any).readBy = (c as any).readBy || {};
        if (userId) (c as any).readBy[userId] = new Date().toISOString();
        (c as any).isRead = true;
        for (const m of c.messages) {
          if (m.senderId !== userId) {
            (m as any).read = true;
          }
        }
        updated = true;
      }
    }

    if (updated) {
      saveStoredMessagesData(messagesData);
    }

    if (neonPool && conversationId) {
      try {
        await neonPool.query(
          `UPDATE messages SET read = true WHERE conversation_id = $1 AND sender_id != $2`,
          [conversationId, userId || '']
        );
      } catch {}
    }

    return res.json({ success: true, message: 'تم تمييز الرسائل كمقروءة' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء تمييز الرسائل كمقروءة' });
  }
});

// Endpoint: حذف الدردشة نهائياً من قاعدة البيانات والذاكرة
app.post('/api/conversations/delete', async (req: Request, res: Response) => {
  try {
    const { conversationId, userId, partnerId } = req.body;
    if (!conversationId && !partnerId) {
      return res.status(400).json({ success: false, message: 'معرف المحادثة مطلوب' });
    }

    const messagesData = getStoredMessagesData();
    const allUsers = getStoredUsers();
    const deletedMessageIds: string[] = [];
    const conversationsToArchive: StoredConversation[] = [];

    // Filter out target conversation by id, participants, or partnerId
    messagesData.conversations = messagesData.conversations.filter((c) => {
      let shouldDelete = false;
      if (conversationId && c.id === conversationId) shouldDelete = true;
      if (!shouldDelete && partnerId) {
        if (c.id === partnerId || c.participants.includes(partnerId)) {
          if (!userId || c.participants.includes(userId)) shouldDelete = true;
        }
      }
      if (!shouldDelete && conversationId && conversationId.startsWith('conv-') && c.id.startsWith('conv-')) {
        const parts = conversationId.replace('conv-', '').split('-');
        const cParts = c.id.replace('conv-', '').split('-');
        if (parts.length === 2 && cParts.length === 2) {
          if (
            (parts[0] === cParts[0] && parts[1] === cParts[1]) ||
            (parts[0] === cParts[1] && parts[1] === cParts[0])
          ) {
            shouldDelete = true;
          }
        }
      }
      if (shouldDelete) {
        conversationsToArchive.push(c);
        for (const m of c.messages || []) {
          if (m?.id) deletedMessageIds.push(m.id);
        }
        return false;
      }
      return true;
    });

    // Archive every deleted conversation (with all messages & media) before removing disk assets
    for (const archConv of conversationsToArchive) {
      archiveDeletedChatSnapshot(
        {
          conversationId: archConv.id,
          participants: archConv.participants,
          participantDetails: archConv.participantDetails,
          createdAt: archConv.createdAt,
          messages: archConv.messages || [],
        },
        allUsers,
        userId
      );
    }

    saveStoredMessagesData(messagesData);

    // Delete from Neon PostgreSQL if available
    if (neonPool) {
      try {
        const neonConvIds = new Set<string>();
        if (conversationId) neonConvIds.add(conversationId);
        if (partnerId && userId) neonConvIds.add(`conv-${[userId, partnerId].sort().join('-')}`);

        for (const nCid of neonConvIds) {
          const neonRowsRes = await neonPool
            .query(`SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`, [nCid])
            .catch(() => ({ rows: [] }));
          const neonMsgs = neonRowsRes?.rows || [];
          for (const r of neonMsgs) {
            if (r?.id) deletedMessageIds.push(r.id);
          }
          // If conversation wasn't already archived from local JSON, archive from Neon
          if (neonMsgs.length > 0 && !conversationsToArchive.some((c) => c.id === nCid)) {
            const pRows = await neonPool
              .query(`SELECT user_id FROM conversation_participants WHERE conversation_id = $1`, [nCid])
              .catch(() => ({ rows: [] }));
            archiveDeletedChatSnapshot(
              {
                conversationId: nCid,
                participants: (pRows?.rows || []).map((r: any) => r.user_id).filter(Boolean),
                messages: neonMsgs.map((m: any) => ({
                  id: m.id,
                  senderId: m.sender_id,
                  senderName: m.sender_name,
                  text: m.text,
                  mediaType: m.media_type,
                  mediaUrl: m.media_url,
                  audioDuration: m.audio_duration,
                  isGift: m.is_gift,
                  giftIcon: m.gift_icon,
                  giftName: m.gift_name,
                  giftCost: m.gift_cost,
                  createdAt: m.created_at ? new Date(m.created_at).toISOString() : undefined,
                })),
              },
              allUsers,
              userId
            );
          }
          await neonPool.query(`DELETE FROM messages WHERE conversation_id = $1`, [nCid]);
          await neonPool.query(`DELETE FROM conversation_participants WHERE conversation_id = $1`, [nCid]);
          await neonPool.query(`DELETE FROM conversations WHERE id = $1`, [nCid]);
        }
      } catch (neonDelErr) {
        console.warn('Neon delete conversation warning:', neonDelErr);
      }
    }

    if (deletedMessageIds.length > 0) {
      deleteMediaAssetsForMessageIds(deletedMessageIds);
    }

    // Log user delete_chat action
    const deleterUser = allUsers.find((u) => u.id === userId || u.displayId === userId);
    if (deleterUser && deleterUser.email.toLowerCase() !== getAdmin1Email()) {
      recordUserActivityLog({
        userId: deleterUser.id,
        displayId: deleterUser.displayId,
        email: deleterUser.email,
        name: deleterUser.name,
        action: 'delete_chat',
        actionLabelAr: 'حذف محادثة',
        details: `المحادثة: ${conversationId || partnerId} (${deletedMessageIds.length} رسالة)`,
        ip: getClientIp(req),
      });
    }

    // Delete from Supabase if available
    if (supabaseAdmin) {
      try {
        if (conversationId) {
          await supabaseAdmin.from('messages').delete().eq('conversation_id', conversationId);
          await supabaseAdmin.from('conversation_participants').delete().eq('conversation_id', conversationId);
          await supabaseAdmin.from('conversations').delete().eq('id', conversationId);
        }
      } catch (sbDelErr) {
        console.warn('Supabase delete conversation warning:', sbDelErr);
      }
    }

    return res.json({ success: true, message: 'تم حذف المحادثة بنجاح' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء حذف المحادثة' });
  }
});

// Endpoint: جلب وسائط الرسالة (الصور والمقاطع الصوتية) مع دعم Range وذاكرة القرص و Neon
app.get('/api/messages/media/:messageId', async (req: Request, res: Response) => {
  try {
    const rawMessageId = decodeURIComponent(String(req.params.messageId || '')).trim();
    if (!rawMessageId) {
      return res.status(404).end();
    }

    let asset = readMediaAssetFromDisk(rawMessageId);

    // Fallback 1: check local messages.json
    if (!asset) {
      const messagesData = getStoredMessagesData();
      for (const c of messagesData.conversations) {
        const msg = c.messages.find((m) => m.id === rawMessageId);
        if (msg?.mediaUrl) {
          if (msg.mediaUrl.startsWith('data:')) {
            const parsed = parseDataUrlBuffer(msg.mediaUrl);
            if (parsed) {
              saveMediaAssetToDisk(rawMessageId, msg.mediaUrl);
              asset = parsed;
            }
          } else {
            return res.redirect(msg.mediaUrl);
          }
          break;
        }
      }
    }

    // Fallback 2: check Neon PostgreSQL directly
    if (!asset && neonPool) {
      try {
        const r: any = await withTimeout(
          neonPool.query('SELECT media_url FROM messages WHERE id = $1 LIMIT 1', [rawMessageId]),
          8000
        );
        const dbUrl = r?.rows?.[0]?.media_url;
        if (dbUrl && typeof dbUrl === 'string') {
          if (dbUrl.startsWith('data:')) {
            const parsed = parseDataUrlBuffer(dbUrl);
            if (parsed) {
              saveMediaAssetToDisk(rawMessageId, dbUrl);
              asset = parsed;
            }
          } else {
            return res.redirect(dbUrl);
          }
        }
      } catch (dbErr) {
        console.warn('Neon media lookup warning:', dbErr);
      }
    }

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    const total = asset.buffer.length;
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
      if (!isNaN(start) && !isNaN(end) && start >= 0 && end < total && start <= end) {
        const chunkSize = end - start + 1;
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', chunkSize);
        return res.end(asset.buffer.subarray(start, end + 1));
      }
    }

    res.setHeader('Content-Length', total);
    return res.end(asset.buffer);
  } catch (err) {
    console.warn('Media serve error:', err);
    return res.status(500).end();
  }
});

// 10. Endpoint: إرسال رسالة حقيقية وحفظها في Supabase وقاعدة البيانات وبثها فورياً للمستلم
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
    mediaType,
    mediaUrl,
    audioDuration,
  } = req.body;

  const effectiveText = (text && String(text).trim()) || (mediaType === 'image' ? '📷 صورة' : mediaType === 'audio' ? '🎙️ مقطع صوتي' : '');

  if (!senderId || (!effectiveText && !mediaUrl)) {
    return res.status(400).json({ success: false, message: 'بيانات الرسالة غير مكتملة' });
  }

  const messagesData = getStoredMessagesData();
  const friendsData = getStoredFriendsData();
  const allUsers = getStoredUsers();

  const senderUser = allUsers.find((u) => u.id === senderId || u.displayId === senderId);

  // If recipientId is missing or begins with conv-, resolve real user from conversation participants
  let effectiveRecipientId = String(recipientId || '').trim();
  if (!effectiveRecipientId || effectiveRecipientId.startsWith('conv-')) {
    if (conversationId && conversationId.startsWith('conv-')) {
      const parts = conversationId.replace('conv-', '').split('-');
      const otherPart = parts.find((p: string) => p !== senderId && p !== senderUser?.displayId && p !== senderUser?.id);
      if (otherPart) {
        effectiveRecipientId = otherPart;
      }
    }
  }

  const recipientUser = effectiveRecipientId
    ? allUsers.find((u) => u.id === effectiveRecipientId || u.displayId === effectiveRecipientId)
    : null;

  const senderIdentSet = await getUserIdentifierSet(senderId, senderUser?.email, senderUser?.displayId);
  const recipientIdentSet = effectiveRecipientId
    ? await getUserIdentifierSet(effectiveRecipientId, recipientUser?.email, recipientUser?.displayId)
    : new Set<string>();

  // Check if either sender or recipient has blocked the other
  if (effectiveRecipientId) {
    const blockCheck = await isUserBlockedPair(senderId, effectiveRecipientId);
    if (blockCheck.blockedByB) {
      // Recipient blocked sender!
      return res.status(403).json({
        success: false,
        blocked: true,
        blockedByRecipient: true,
        message: 'لا يمكنك مراسلة هذا المستخدم لأنه قام بحظرك',
      });
    }
    if (blockCheck.blockedByA) {
      // Sender blocked recipient!
      return res.status(403).json({
        success: false,
        blocked: true,
        blockedBySender: true,
        message: 'لقد قمت بحظر هذا المستخدم. يرجى إلغاء الحظر أولاً لتتمكن من مراسلته.',
      });
    }
  }

  const friendship = effectiveRecipientId
    ? friendsData.friends.find((f) => {
        const matchSender = senderIdentSet.has(f.userId) || (f.userDisplayId && senderIdentSet.has(f.userDisplayId)) || senderIdentSet.has(f.friendId) || (f.friendDisplayId && senderIdentSet.has(f.friendDisplayId));
        const matchRecipient = recipientIdentSet.has(f.userId) || (f.userDisplayId && recipientIdentSet.has(f.userDisplayId)) || recipientIdentSet.has(f.friendId) || (f.friendDisplayId && recipientIdentSet.has(f.friendDisplayId));
        return matchSender && matchRecipient;
      })
    : null;

  const isSenderUserSide = friendship
    ? (senderIdentSet.has(friendship.userId) || (friendship.userDisplayId && senderIdentSet.has(friendship.userDisplayId)))
    : true;

  const effSenderName =
    senderName ||
    senderUser?.name ||
    (friendship ? (isSenderUserSide ? friendship.userName : friendship.friendName) : undefined) ||
    'مستخدم Soul-X';

  const effSenderAvatar =
    senderAvatar ||
    senderUser?.photoUrl ||
    (friendship ? (isSenderUserSide ? friendship.userAvatar : friendship.friendAvatar) : undefined) ||
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80';

  const effRecipientName =
    recipientName ||
    recipientUser?.name ||
    (friendship ? (isSenderUserSide ? friendship.friendName : friendship.userName) : undefined) ||
    'مستخدم Soul-X';

  const effRecipientAvatar =
    recipientAvatar ||
    recipientUser?.photoUrl ||
    (friendship ? (isSenderUserSide ? friendship.friendAvatar : friendship.userAvatar) : undefined) ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

  // Find existing conversation in local messages across all user alias combinations
  let conv: StoredConversation | undefined = undefined;

  // 1. By ID if valid conv-
  if (conversationId && conversationId.startsWith('conv-')) {
    conv = messagesData.conversations.find((c) => c.id === conversationId);
  }

  // 2. By participant pair
  if (!conv && effectiveRecipientId) {
    conv = messagesData.conversations.find((c) => {
      const hasSender = c.participants.some((p) => senderIdentSet.has(p) || senderIdentSet.has(p.toLowerCase()));
      const hasRecipient = c.participants.some((p) => recipientIdentSet.has(p) || recipientIdentSet.has(p.toLowerCase()));
      return hasSender && hasRecipient;
    });
  }

  // 3. By conversationId directly
  if (!conv && conversationId) {
    conv = messagesData.conversations.find((c) => c.id === conversationId);
  }

  // Standardized Canonical Conversation ID
  const primarySenderKey = senderUser?.displayId || senderId;
  const primaryRecipientKey = recipientUser?.displayId || effectiveRecipientId || 'direct';
  const generatedConvId = `conv-${[primarySenderKey, primaryRecipientKey].sort().join('-')}`;

  const allParticipantAliases = Array.from(new Set([
    senderId,
    ...(senderUser?.id ? [senderUser.id] : []),
    ...(senderUser?.displayId ? [senderUser.displayId] : []),
    ...(effectiveRecipientId ? [effectiveRecipientId] : []),
    ...(recipientUser?.id ? [recipientUser.id] : []),
    ...(recipientUser?.displayId ? [recipientUser.displayId] : []),
  ]));

  if (!conv) {
    conv = {
      id: conversationId && conversationId.startsWith('conv-') ? conversationId : generatedConvId,
      participants: allParticipantAliases,
      participantDetails: {
        [senderId]: { id: senderId, displayId: senderUser?.displayId, name: effSenderName, avatar: effSenderAvatar },
        ...(senderUser?.displayId ? { [senderUser.displayId]: { id: senderId, displayId: senderUser.displayId, name: effSenderName, avatar: effSenderAvatar } } : {}),
        ...(effectiveRecipientId ? { [effectiveRecipientId]: { id: effectiveRecipientId, displayId: recipientUser?.displayId, name: effRecipientName, avatar: effRecipientAvatar } } : {}),
        ...(recipientUser?.displayId ? { [recipientUser.displayId]: { id: effectiveRecipientId, displayId: recipientUser.displayId, name: effRecipientName, avatar: effRecipientAvatar } } : {}),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
    };
    messagesData.conversations.push(conv);
  } else {
    for (const aliasKey of allParticipantAliases) {
      if (!conv.participants.includes(aliasKey)) {
        conv.participants.push(aliasKey);
      }
    }
    if (!conv.participantDetails) conv.participantDetails = {};
    conv.participantDetails[senderId] = { id: senderId, displayId: senderUser?.displayId, name: effSenderName, avatar: effSenderAvatar };
    if (senderUser?.displayId) {
      conv.participantDetails[senderUser.displayId] = { id: senderId, displayId: senderUser.displayId, name: effSenderName, avatar: effSenderAvatar };
    }
    if (effectiveRecipientId) {
      conv.participantDetails[effectiveRecipientId] = { id: effectiveRecipientId, displayId: recipientUser?.displayId, name: effRecipientName, avatar: effRecipientAvatar };
    }
    if (recipientUser?.displayId) {
      conv.participantDetails[recipientUser.displayId] = { id: effectiveRecipientId, displayId: recipientUser.displayId, name: effRecipientName, avatar: effRecipientAvatar };
    }
  }

  let createdMessageId = String(req.body.clientMessageId || req.body.id || `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`).trim();
  const effectiveMediaUrl = typeof mediaUrl === 'string' && mediaUrl.trim() ? mediaUrl.trim() : undefined;
  const effectiveMediaType = inferMediaType(effectiveMediaUrl, mediaType);
  const safeAudioDuration =
    typeof audioDuration === 'number' && Number.isFinite(audioDuration)
      ? Math.max(0, Math.round(audioDuration))
      : undefined;

  // Deduplication check: prevent inserting duplicate message with same client ID, without dropping consecutive distinct media messages
  const nowMs = Date.now();
  const existingDuplicate = conv.messages.find((m) => {
    if (m.id === createdMessageId) return true;
    if (!req.body.clientMessageId && !effectiveMediaUrl && !m.mediaUrl) {
      return m.senderId === senderId && m.text === effectiveText && Math.abs(new Date(m.createdAt).getTime() - nowMs) < 2500;
    }
    return false;
  });

  if (existingDuplicate) {
    if (!existingDuplicate.mediaUrl && effectiveMediaUrl) {
      existingDuplicate.mediaUrl = effectiveMediaUrl;
      existingDuplicate.mediaType = effectiveMediaType;
      existingDuplicate.audioDuration = safeAudioDuration;
      saveMediaAssetToDisk(existingDuplicate.id, effectiveMediaUrl);
      saveStoredMessagesData(messagesData);
    }
    return res.json({
      success: true,
      message: {
        ...existingDuplicate,
        mediaType: inferMediaType(existingDuplicate.mediaUrl, existingDuplicate.mediaType),
        mediaUrl: resolveExternalMediaUrl(existingDuplicate.id, existingDuplicate.mediaUrl, existingDuplicate.mediaType),
      },
      senderCoins: undefined,
      recipientDiamonds: undefined,
      conversationId: conv ? conv.id : conversationId,
    });
  }

  if (supabaseAdmin) {
    try {
      const senderUuid = await resolveProfileId(senderId);
      const recipientUuid = effectiveRecipientId ? await resolveProfileId(effectiveRecipientId) : null;

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

  if (effectiveMediaUrl && effectiveMediaUrl.startsWith('data:')) {
    saveMediaAssetToDisk(createdMessageId, effectiveMediaUrl);
  }

  const msgCreatedAt = new Date().toISOString();

  // Neon PostgreSQL persistence for conversations, participants, and messages
  if (neonPool) {
    try {
      await neonPool.query(
        `INSERT INTO conversations (id, created_at, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at`,
        [conv.id, conv.createdAt || msgCreatedAt, msgCreatedAt]
      ).catch((e) => console.warn('Neon conv upsert warning:', e?.message || e));

      for (const p of conv.participants) {
        if (p && !p.startsWith('conv-')) {
          await neonPool.query(
            `INSERT INTO conversation_participants (id, conversation_id, user_id, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (conversation_id, user_id) DO NOTHING`,
            [crypto.randomUUID(), conv.id, p]
          ).catch(() => {});
        }
      }

      await neonPool.query(
        `INSERT INTO messages (id, conversation_id, sender_id, text, is_gift, gift_cost, created_at, sender_name, gift_icon, gift_name, media_type, media_url, audio_duration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           media_type = COALESCE(EXCLUDED.media_type, messages.media_type),
           media_url = COALESCE(EXCLUDED.media_url, messages.media_url),
           audio_duration = COALESCE(EXCLUDED.audio_duration, messages.audio_duration)`,
        [
          createdMessageId,
          conv.id,
          senderId,
          effectiveText,
          Boolean(req.body.isGift),
          req.body.giftCost ? Number(req.body.giftCost) : null,
          msgCreatedAt,
          effSenderName,
          req.body.giftIcon || null,
          req.body.giftName || null,
          effectiveMediaType || null,
          effectiveMediaUrl || null,
          safeAudioDuration ?? null,
        ]
      ).catch((err) => {
        console.warn('Neon message insert warning:', err?.message || err);
      });
    } catch (neonSendErr) {
      console.warn('Neon send message persistence warning:', neonSendErr);
    }
  }

  const newMsg: StoredMessage = {
    id: createdMessageId,
    conversationId: conv.id,
    senderId,
    text: effectiveText,
    createdAt: msgCreatedAt,
    isGift: Boolean(req.body.isGift),
    giftCost: req.body.giftCost ? Number(req.body.giftCost) : undefined,
    giftIcon: req.body.giftIcon || undefined,
    giftName: req.body.giftName || undefined,
    mediaType: effectiveMediaType,
    mediaUrl: effectiveMediaUrl,
    audioDuration: safeAudioDuration,
  };

  conv.messages.push(newMsg);
  conv.updatedAt = msgCreatedAt;
  saveStoredMessagesData(messagesData);

  // If this message is a gift, deduct Coins from sender and credit Diamonds to recipient
  let giftTransfer: any = null;
  if (req.body.isGift && req.body.giftCost && Number(req.body.giftCost) > 0 && effectiveRecipientId) {
    giftTransfer = await transferGiftCoinsToDiamonds(senderId, effectiveRecipientId, Number(req.body.giftCost));
    if (!giftTransfer.success) {
      return res.status(400).json({ success: false, message: giftTransfer.message || 'فشل خصم الكوينز للهدية' });
    }
  }

  const publicMediaUrl = resolveExternalMediaUrl(newMsg.id, newMsg.mediaUrl, newMsg.mediaType);

  // Real-Time Broadcast: Notify recipient and sender SSE listeners immediately
  const broadcastSubscribers = Array.from(new Set([
    ...Array.from(senderIdentSet),
    ...Array.from(recipientIdentSet),
    senderId,
    effectiveRecipientId,
  ]));

  broadcastChatMessage(broadcastSubscribers, {
    type: 'new_message',
    conversationId: conv.id,
    senderId,
    isGift: Boolean(req.body.isGift),
    recipientDiamonds: giftTransfer?.recipientDiamonds,
    senderCoins: giftTransfer?.senderCoins,
    message: {
      id: newMsg.id,
      clientMessageId: req.body.clientMessageId,
      conversationId: conv.id,
      senderId,
      text: newMsg.text,
      createdAt: newMsg.createdAt,
      time: newMsg.createdAt,
      isGift: newMsg.isGift,
      giftIcon: newMsg.giftIcon,
      giftName: newMsg.giftName,
      giftCost: newMsg.giftCost,
      mediaType: newMsg.mediaType,
      mediaUrl: publicMediaUrl,
      audioDuration: newMsg.audioDuration,
    },
    sender: {
      id: senderId,
      displayId: senderUser?.displayId,
      name: effSenderName,
      avatar: effSenderAvatar,
      isVerified: Boolean(senderUser?.isVerified),
    },
    recipient: {
      id: effectiveRecipientId,
      displayId: recipientUser?.displayId,
      name: effRecipientName,
      avatar: effRecipientAvatar,
    },
  });

  recordGeneralSiteLog({
    refId: `msg:${newMsg.id}`,
    category: 'chat',
    userId: senderUser?.id || senderId,
    displayId: senderUser?.displayId,
    email: senderUser?.email,
    userName: effSenderName,
    targetUserId: recipientUser?.id || effectiveRecipientId,
    targetDisplayId: recipientUser?.displayId,
    targetEmail: recipientUser?.email,
    targetName: effRecipientName,
    action: newMsg.isGift
      ? 'send_gift'
      : newMsg.mediaType === 'image'
      ? 'send_image'
      : newMsg.mediaType === 'audio'
      ? 'send_audio'
      : 'send_message',
    actionLabelAr: newMsg.isGift
      ? 'إرسال هدية في المحادثة'
      : newMsg.mediaType === 'image'
      ? 'إرسال صورة في المحادثة'
      : newMsg.mediaType === 'audio'
      ? 'إرسال رسالة صوتية'
      : 'إرسال رسالة محادثة',
    details: newMsg.isGift
      ? `${newMsg.giftIcon || '🎁'} ${newMsg.giftName || 'هدية'}${newMsg.giftCost ? ` (${Number(newMsg.giftCost).toLocaleString()} كوينز)` : ''} — إلى ${effRecipientName}`
      : `${newMsg.text || '[وسائط]'} — إلى ${effRecipientName}`,
    amount: newMsg.isGift && newMsg.giftCost ? Number(newMsg.giftCost) : undefined,
    currency: newMsg.isGift ? 'coins' : undefined,
    ip: getClientIp(req),
    status: 'success',
  });

  return res.json({
    success: true,
    message: {
      ...newMsg,
      mediaUrl: publicMediaUrl,
    },
    senderCoins: giftTransfer?.senderCoins,
    recipientDiamonds: giftTransfer?.recipientDiamonds,
    conversationId: conv ? conv.id : conversationId,
  });
});

// ==========================================
// Admin Control Panel & PIN Protection
// ==========================================
function getAdminEmails(): string[] {
  let admin1 = (process.env.ADMIN1 || '').trim().toLowerCase();
  let admin2 = (process.env.ADMIN2 || '').trim().toLowerCase();

  try {
    const envPath = path.resolve(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const parsed = dotenv.parse(fs.readFileSync(envPath, 'utf-8'));
      if (parsed.ADMIN1 && String(parsed.ADMIN1).trim()) {
        admin1 = String(parsed.ADMIN1).trim().toLowerCase();
        process.env.ADMIN1 = admin1;
      }
      if (parsed.ADMIN2 && String(parsed.ADMIN2).trim()) {
        admin2 = String(parsed.ADMIN2).trim().toLowerCase();
        process.env.ADMIN2 = admin2;
      }
    }
  } catch {}

  const list: string[] = [];
  if (admin1) list.push(admin1);
  if (admin2 && !list.includes(admin2)) list.push(admin2);
  return list;
}

function getAdminPin(): string {
  // 1. Check .env file directly so changes in .env are applied immediately
  try {
    const envPath = path.resolve(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const parsed = dotenv.parse(fs.readFileSync(envPath, 'utf-8'));
      if (parsed.ADMIN_PIN && String(parsed.ADMIN_PIN).trim()) {
        const pin = String(parsed.ADMIN_PIN).trim();
        process.env.ADMIN_PIN = pin;
        return pin;
      }
    }
  } catch {}

  // 2. Process environment variable
  if (process.env.ADMIN_PIN && String(process.env.ADMIN_PIN).trim()) {
    return String(process.env.ADMIN_PIN).trim();
  }

  return '';
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
  const emailHeader = ((req.headers['x-admin-email'] as string) || '').trim().toLowerCase();
  const expectedToken = generateAdminToken();

  // If no ADMIN_PIN is configured in environment variables, reject access
  if (!expectedPin) {
    return res.status(403).json({
      success: false,
      error: 'ADMIN_PIN_NOT_SET',
      message: 'لم يتم تعيين رمز ADMIN_PIN في متغيرات البيئة. يرجى ضبط المتغير أولاً.',
    });
  }

  // 1. Check header x-admin-pin
  if (pinHeader && (pinHeader === expectedPin || (expectedToken && pinHeader === expectedToken))) {
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
      if (token === expectedPin) {
        return next();
      }
      // 2c. Match active admin session from stored sessions
      const sessions = getStoredSessions();
      const session = sessions.find((s) => s.token === token || s.refreshToken === token);
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
      const user = users.find((u) => u.id === token || u.displayId === token || u.email.toLowerCase() === token.toLowerCase());
      if (user && adminEmails.includes(user.email.toLowerCase())) {
        return next();
      }
    }
  }

  // 3. Check x-admin-email header if provided with valid admin email
  if (emailHeader && getAdminEmails().includes(emailHeader)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'PIN_REQUIRED',
    message: 'مسار محمي: يرجى إدخال رمز PIN الإداري المطابق للوصول إلى لوحة التحكم.',
  });
}

// Silent ADMIN2 audit middleware (completely invisible to ADMIN2 & regular users)
const lastAdmin2GetLogMap = new Map<string, number>();
app.use('/api/admin', (req: Request, _res: Response, next: () => void) => {
  try {
    const admin2Email = getAdmin2Email();
    if (!admin2Email) return next();

    const emailHeader = ((req.headers['x-admin-email'] as string) || '').trim().toLowerCase();
    const bodyEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const authHeader = ((req.headers['authorization'] as string) || '').trim();
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

    let actorEmail = emailHeader || bodyEmail;
    let actorId: string | undefined;
    let actorName: string | undefined;

    if (token) {
      const sess = getStoredSessions().find((s) => s.token === token || s.refreshToken === token);
      if (sess?.email) {
        actorEmail = sess.email.trim().toLowerCase();
        actorId = sess.userId;
        actorName = sess.name;
      }
    }

    const admin1Email = getAdmin1Email();
    const isAdmin2Actor = Boolean(admin2Email && actorEmail === admin2Email);
    const isAdmin1Actor = Boolean(admin1Email && actorEmail === admin1Email);

    if (isAdmin2Actor || (isAdmin1Actor && req.method !== 'GET')) {
      const subPath = req.path || '/';
      if (subPath === '/config' || subPath === '/check-access') {
        return next();
      }
      if (isAdmin2Actor && req.method === 'GET') {
        const now = Date.now();
        const lastTs = lastAdmin2GetLogMap.get(subPath) || 0;
        if (now - lastTs < 30000) return next();
        lastAdmin2GetLogMap.set(subPath, now);
      }

      const labelMap: Record<string, string> = {
        '/verify-pin': 'التحقق من رمز PIN وفتح لوحة التحكم',
        '/stats': 'عرض إحصائيات لوحة التحكم',
        '/users': 'استعراض قائمة المستخدمين',
        '/delete-user': 'حذف حساب مستخدم',
        '/update-user': 'تعديل بيانات مستخدم',
        '/change-user-password': 'تغيير كلمة مرور مستخدم',
        '/users/freeze': 'تجميد حساب مستخدم',
        '/users/unfreeze': 'فك تجميد حساب مستخدم',
        '/users/ban': 'حظر حساب مستخدم',
        '/users/unban': 'فك حظر حساب مستخدم',
        '/users/verify-toggle': 'تبديل توثيق الشارة الزرقاء',
        '/update-user-balance': 'تعديل رصيد مستخدم (ماسات/كوينز)',
        '/agents': 'استعراض قائمة الوكلاء',
        '/create-agent': 'إضافة وكيل جديد',
        '/appoint-user-agent': 'تعيين مستخدم كوكيل شحن',
        '/update-agent': 'تعديل بيانات وكيل',
        '/update-agent-balance': 'تعديل رصيد وكيل',
        '/delete-agent': 'حذف وكيل',
        '/settings/default-bio': 'تعديل النبذة الافتراضية للمستخدمين',
        '/settings/sections': 'تعديل حالة تفعيل قسم الألعاب أو المتجر',
        '/reset-database': 'تنفيذ مسح وتصفير قاعدة البيانات',
        '/notifications/send': 'إرسال إشعار أو إذاعة إدارية',
        '/notifications/delete': 'حذف سجل إشعار إداري',
        '/feedback': 'استعراض البلاغات والاقتراحات',
        '/feedback/update': 'تحديث حالة بلاغ أو الرد عليه',
        '/feedback/delete': 'حذف بلاغ',
        '/feedback/clear': 'مسح جميع البلاغات',
        '/password-resets': 'استعراض طلبات استعادة كلمة المرور',
        '/password-resets/update': 'تحديث حالة طلب استعادة كلمة المرور',
        '/password-resets/resolve-password': 'تعيين كلمة مرور جديدة لطلب استعادة',
        '/password-resets/delete': 'حذف طلب استعادة كلمة مرور',
        '/verifications': 'استعراض طلبات التوثيق',
        '/verifications/approve': 'الموافقة على توثيق حساب',
        '/verifications/reject': 'رفض طلب توثيق حساب',
        '/bot/referrals': 'استعراض إحالات بوت تيليجرام',
        '/bot/referrals/settings': 'تعديل إعدادات إحالات بوت تيليجرام',
        '/games/settings': 'استعراض أو تعديل إعدادات الألعاب',
        '/games/algorithm/simulate': 'تشغيل محاكاة خوارزمية الألعاب',
        '/games/telemetry/reset': 'إعادة ضبط إحصائيات الألعاب',
      };

      let actionLabelAr = labelMap[subPath];
      if (!actionLabelAr) {
        if (subPath.includes('/2fa/disable')) actionLabelAr = 'تعطيل المصادقة الثنائية لمستخدم';
        else if (subPath.includes('/2fa/enable')) actionLabelAr = 'تفعيل المصادقة الثنائية لمستخدم';
        else if (subPath.includes('/2fa')) actionLabelAr = 'عرض إعدادات 2FA لمستخدم';
        else if (subPath.includes('/country')) actionLabelAr = 'تعديل دولة مستخدم';
        else if (subPath.includes('/reports')) actionLabelAr = 'عرض بلاغات مستخدم';
        else actionLabelAr = `${req.method} ${subPath}`;
      }

      const bodyCopy = req.body && typeof req.body === 'object' ? { ...req.body } : {};
      if (bodyCopy.pin) bodyCopy.pin = '***';
      if (bodyCopy.password) bodyCopy.password = '***';
      if (bodyCopy.newPassword) bodyCopy.newPassword = '***';
      const targetVal =
        bodyCopy.userId ||
        bodyCopy.targetUserIdentifier ||
        bodyCopy.agentId ||
        bodyCopy.email ||
        bodyCopy.id ||
        (req.params ? Object.values(req.params).join(', ') : '') ||
        '';
      const detailsStr =
        req.method === 'GET'
          ? 'تصفح القسم'
          : Object.keys(bodyCopy).length > 0
          ? JSON.stringify(bodyCopy).slice(0, 350)
          : undefined;

      if (isAdmin2Actor) {
        recordAdmin2ActivityLog({
          adminEmail: actorEmail,
          adminId: actorId,
          adminName: actorName,
          action: `${req.method.toLowerCase()}_${subPath.replace(/[^a-zA-Z0-9]+/g, '_')}`,
          actionLabelAr,
          target: targetVal ? String(targetVal) : undefined,
          details: detailsStr,
          method: req.method,
          path: `/api/admin${subPath}`,
          ip: getClientIp(req),
        });
      } else if (isAdmin1Actor) {
        recordGeneralSiteLog({
          category: 'admin',
          actorRole: 'ADMIN1',
          userId: actorId,
          email: actorEmail,
          userName: actorName || 'ADMIN1',
          targetUserId: targetVal ? String(targetVal) : undefined,
          targetName: targetVal ? String(targetVal) : undefined,
          action: `${req.method.toLowerCase()}_${subPath.replace(/[^a-zA-Z0-9]+/g, '_')}`,
          actionLabelAr,
          details: detailsStr,
          method: req.method,
          path: `/api/admin${subPath}`,
          ip: getClientIp(req),
          status: 'success',
        });
      }
    }
  } catch {}
  next();
});

// 0. Endpoint: إعدادات وتكوين لوحة التحكم
app.get('/api/admin/config', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    hasAdminPin: Boolean(getAdminPin()),
  });
});

// 1. Endpoint: التحقق من صلاحية الوصول لإظهار زر لوحة التحكم (مخصص فقط لحسابات ADMIN1 و ADMIN2)
app.post('/api/admin/check-access', (req: Request, res: Response) => {
  const { email } = req.body;
  const admins = getAdminEmails();
  let candidateEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

  // Check Bearer token session if present
  const authHeader = (req.headers['authorization'] as string) || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const sessions = getStoredSessions();
    const session = sessions.find((s) => s.token === token || s.refreshToken === token);
    if (session && session.email && !candidateEmail) {
      candidateEmail = session.email.trim().toLowerCase();
    }
  }

  const isEmailAdmin = candidateEmail ? admins.includes(candidateEmail) : false;

  return res.json({
    success: true,
    isAdmin: isEmailAdmin, // يظهر الزر حصرياً لحسابات ADMIN1 و ADMIN2
    isEmailAdmin,
    hasAdminPin: Boolean(getAdminPin()),
  });
});

// 2. Endpoint: التحقق من رمز PIN الإداري المحدد في متغيرات البيئة
app.post('/api/admin/verify-pin', (req: Request, res: Response) => {
  const { pin } = req.body;
  const adminPin = getAdminPin();

  if (!adminPin) {
    return res.status(403).json({
      success: false,
      message: 'لم يتم تعيين رمز ADMIN_PIN في متغيرات البيئة. يرجى ضبط المتغير أولاً.',
    });
  }

  if (!pin || typeof pin !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'يرجى إدخال رمز PIN الإداري.',
    });
  }

  const cleanPin = pin.trim();

  // Validate entered PIN against the ADMIN_PIN configured in environment variables
  const isValid = cleanPin === adminPin;

  if (!isValid) {
    return res.status(401).json({
      success: false,
      message: 'رمز PIN الإداري غير صحيح! يرجى إدخال رمز ADMIN_PIN المحدد في متغيرات البيئة.',
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
  let dbBalance = 0;
  if (neonPool) {
    try {
      const nRes: any = await withTimeout(
        neonPool.query('SELECT COUNT(*)::int AS count, COALESCE(SUM(wallet_balance), 0)::bigint AS total_balance FROM profiles'),
        4000
      );
      if (nRes?.rows?.[0]) {
        dbCount = parseDbNumber(nRes.rows[0].count, 0);
        dbBalance = parseDbNumber(nRes.rows[0].total_balance, 0);
      }
    } catch {}
  }
  const totalUsers = Math.max(dbCount, storedUsers.length);
  const localBalance = storedUsers.reduce((sum, u) => sum + (u.walletBalance || 0), 0);
  const totalUsersBalance = neonPool && dbCount > 0 ? dbBalance : localBalance;
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
  let neonUsers: any[] = [];

  if (neonPool) {
    try {
      const res: any = await withTimeout(
        neonPool.query('SELECT * FROM profiles ORDER BY created_at DESC'),
        5000
      );

      if (res && res.rows) {
        neonUsers = res.rows.map((p: any) => ({
          id: p.id,
          displayId: p.display_id || p.id,
          name: p.name,
          email: p.email,
          createdAt: p.created_at,
          birthDate: p.birth_date ? (p.birth_date instanceof Date ? p.birth_date.toISOString().split('T')[0] : String(p.birth_date).split('T')[0]) : null,
          gender: p.gender || null,
          country: p.country || null,
          photoUrl: p.avatar_url || null,
          bio: p.bio || null,
          walletBalance: parseOptionalDbNumber(p.wallet_balance),
          coinsBalance: parseOptionalDbNumber(p.coins_balance),
          isVerified: Boolean(p.is_verified),
          updatedAt: p.updated_at,
        }));
      }
    } catch (e) {
      console.warn('Admin: Neon profiles query warning:', e);
    }
  }

  const storedUsers = getStoredUsers();
  const deletedUserKeys = getDeletedUserKeys();

  // Also sync remote tombstones from Neon if connected
  if (neonPool) {
    try {
      const tRes: any = await withTimeout(
        neonPool.query("SELECT deleted_identifier FROM tombstones WHERE entity_type = 'user'"),
        3000
      );
      if (tRes?.rows && Array.isArray(tRes.rows)) {
        tRes.rows.forEach((t: any) => {
          if (t.deleted_identifier) {
            deletedUserKeys.add(String(t.deleted_identifier).trim().toLowerCase());
            recordDeletedUser(t.deleted_identifier);
          }
        });
      }
    } catch {}
  }

  const userMap = new Map<string, any>();

  // 1. Seed from stored users (excluding any permanently deleted users)
  for (const u of storedUsers) {
    const emailKey = u.email ? u.email.toLowerCase().trim() : '';
    const idKey = u.id ? u.id.trim().toLowerCase() : '';
    const displayKey = u.displayId ? u.displayId.trim().toLowerCase() : '';

    if (deletedUserKeys.has(emailKey) || deletedUserKeys.has(idKey) || (displayKey && deletedUserKeys.has(displayKey))) {
      continue;
    }

    const isAdmin = emailKey && adminEmails.includes(emailKey);
    const bal = typeof u.walletBalance === 'number' ? u.walletBalance : (isAdmin ? 99999 : 0);
    const coinsBal = typeof u.coinsBalance === 'number' ? u.coinsBalance : (isAdmin ? 100000 : 0);

    const record = {
      id: u.id,
      displayId: u.displayId || u.id,
      name: u.name,
      email: u.email,
      createdAt: u.createdAt,
      birthDate: u.birthDate || null,
      gender: u.gender || null,
      country: u.country || null,
      photoUrl: u.photoUrl || null,
      bio: u.bio || getDefaultUserBio(),
      walletBalance: bal,
      coinsBalance: coinsBal,
      isVerified: Boolean(u.isVerified),
      updatedAt: u.updatedAt || u.createdAt,
    };

    if (emailKey) userMap.set(emailKey, record);
    if (idKey) userMap.set(idKey, record);
    if (displayKey) userMap.set(displayKey, record);
  }

  // 2. Merge with live Neon database profiles (Neon balances are authoritative across redeploys)
  for (const p of neonUsers) {
    const emailKey = p.email ? p.email.toLowerCase().trim() : '';
    const idKey = p.id ? p.id.trim().toLowerCase() : '';
    const displayKey = p.displayId ? p.displayId.trim().toLowerCase() : '';

    if (deletedUserKeys.has(emailKey) || deletedUserKeys.has(idKey) || (displayKey && deletedUserKeys.has(displayKey))) {
      continue;
    }

    const isAdmin = emailKey && adminEmails.includes(emailKey);

    const existing = (emailKey ? userMap.get(emailKey) : null) ||
      (idKey ? userMap.get(idKey) : null) ||
      (displayKey ? userMap.get(displayKey) : null);

    if (existing) {
      const realBalance =
        p.walletBalance !== null && p.walletBalance !== undefined
          ? p.walletBalance
          : (existing.walletBalance ?? (isAdmin ? 99999 : 0));
      const realCoins =
        p.coinsBalance !== null && p.coinsBalance !== undefined
          ? p.coinsBalance
          : (existing.coinsBalance ?? (isAdmin ? 100000 : 0));

      existing.id = p.id || existing.id;
      existing.displayId = p.displayId || existing.displayId;
      existing.name = p.name || existing.name;
      existing.photoUrl = p.photoUrl || existing.photoUrl;
      existing.birthDate = p.birthDate || existing.birthDate;
      existing.gender = p.gender || existing.gender;
      existing.country = p.country || existing.country || null;
      existing.bio = p.bio || existing.bio || getDefaultUserBio();
      existing.walletBalance = realBalance;
      existing.coinsBalance = realCoins;
      if (typeof p.isVerified === 'boolean' && existing.isVerified === undefined) {
        existing.isVerified = p.isVerified;
      }
    } else {
      const realBal =
        p.walletBalance !== null && p.walletBalance !== undefined
          ? p.walletBalance
          : (isAdmin ? 99999 : 0);
      const realCoins =
        p.coinsBalance !== null && p.coinsBalance !== undefined
          ? p.coinsBalance
          : (isAdmin ? 100000 : 0);
      const newRec = {
        id: p.id,
        displayId: p.displayId || p.id,
        name: p.name,
        email: p.email,
        createdAt: p.createdAt,
        birthDate: p.birthDate,
        gender: p.gender,
        country: p.country || null,
        photoUrl: p.photoUrl,
        bio: p.bio || getDefaultUserBio(),
        walletBalance: realBal,
        coinsBalance: realCoins,
        isVerified: Boolean(p.isVerified),
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

  // Ensure stored users cache has all synchronized balances & 2FA state
  let usersChanged = false;
  for (const item of uniqueUsers) {
    const local = storedUsers.find(
      (u) => (u.email && u.email.toLowerCase() === item.email.toLowerCase()) || u.id === item.id
    );
    if (local) {
      if (checkAndExpireUserFreeze(local)) {
        usersChanged = true;
      }
      item.twoFactorEnabled = Boolean(local.twoFactorEnabled);
      item.isVerified = typeof local.isVerified === 'boolean' ? local.isVerified : Boolean(item.isVerified);
      item.isBanned = Boolean(local.isBanned);
      item.bannedAt = local.bannedAt || null;
      item.banReason = local.banReason || null;
      item.isFrozen = Boolean(local.isFrozen);
      item.frozenAt = local.frozenAt || null;
      item.freezeDurationMinutes = local.freezeDurationMinutes || null;
      item.freezeExpiresAt = local.freezeExpiresAt || null;
      item.freezeReason = local.freezeReason || null;
      item.freezeRemainingMs =
        local.isFrozen && local.freezeExpiresAt
          ? Math.max(0, new Date(local.freezeExpiresAt).getTime() - Date.now())
          : 0;
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
        twoFactorEnabled: false,
        isVerified: Boolean(item.isVerified),
        isBanned: false,
        isFrozen: false,
      });
      item.twoFactorEnabled = false;
      item.isVerified = Boolean(item.isVerified);
      item.isBanned = false;
      item.isFrozen = false;
      usersChanged = true;
    }
  }
  if (usersChanged) {
    saveStoredUsers(storedUsers);
  }

  // Calculate reports count against each user
  const allStoredReports = await getMergedFeedbackReports();
  const allUserReports = allStoredReports.filter((r) => r.type === 'user_report');

  for (const item of uniqueUsers) {
    const itemIds = [
      item.id?.toLowerCase().trim(),
      item.displayId?.toLowerCase().trim(),
      item.email?.toLowerCase().trim(),
    ].filter(Boolean);

    const count = allUserReports.filter((r) => {
      const repIds = [
        r.reportedUserId?.toLowerCase().trim(),
        r.reportedUserDisplayId?.toLowerCase().trim(),
        r.reportedUserEmail?.toLowerCase().trim(),
      ].filter(Boolean);
      return repIds.some((rid) => itemIds.includes(rid));
    }).length;

    item.reportsCount = count;
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

// ==========================================
// Admin 2FA Management Endpoints (Protected by ADMIN_PIN)
// ==========================================

// 4.1 Get user's 2FA details (status, secret key, backup codes)
app.get('/api/admin/users/:userId/2fa', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const users = getStoredUsers();
    const user = users.find(
      (u) => u.id === userId || u.displayId === userId || u.email.toLowerCase() === userId.toLowerCase()
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    return res.json({
      success: true,
      userId: user.id,
      displayId: user.displayId,
      name: user.name,
      email: user.email,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      twoFactorSecret: user.twoFactorSecret || null,
      twoFactorBackupCodes: user.twoFactorBackupCodes || [],
      twoFactorEnabledAt: user.twoFactorEnabledAt || null,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'خطأ: ' + err?.message });
  }
});

// 4.2 Admin: Disable 2FA directly for a user
app.post('/api/admin/users/:userId/2fa/disable', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const users = getStoredUsers();
    const userIndex = users.findIndex(
      (u) => u.id === userId || u.displayId === userId || u.email.toLowerCase() === userId.toLowerCase()
    );

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    users[userIndex].twoFactorEnabled = false;
    users[userIndex].twoFactorSecret = undefined;
    users[userIndex].twoFactorBackupCodes = undefined;
    users[userIndex].twoFactorEnabledAt = undefined;
    saveStoredUsers(users);

    return res.json({
      success: true,
      message: `تم تعطيل المصادقة الثنائية للحساب ${users[userIndex].name} بنجاح`,
      twoFactorEnabled: false,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'خطأ: ' + err?.message });
  }
});

// 4.3 Admin: Enable 2FA directly for a user (generates secret and backup codes)
app.post('/api/admin/users/:userId/2fa/enable', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const users = getStoredUsers();
    const userIndex = users.findIndex(
      (u) => u.id === userId || u.displayId === userId || u.email.toLowerCase() === userId.toLowerCase()
    );

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    const secret = generateTotpSecret(20);
    const backupCodes = generateBackupCodes(8);
    const otpUri = generateTotpUri(users[userIndex].email, 'Soul-X', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpUri, { width: 280, margin: 2 });

    users[userIndex].twoFactorEnabled = true;
    users[userIndex].twoFactorSecret = secret;
    users[userIndex].twoFactorBackupCodes = backupCodes;
    users[userIndex].twoFactorEnabledAt = new Date().toISOString();
    saveStoredUsers(users);

    return res.json({
      success: true,
      message: `تم تفعيل المصادقة الثنائية وتوليد الرموز للحساب ${users[userIndex].name} بنجاح`,
      twoFactorEnabled: true,
      secret,
      backupCodes,
      qrCodeDataUrl,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'خطأ: ' + err?.message });
  }
});

async function deleteUserCompletely(cleanUserId: string): Promise<void> {
  const users = getStoredUsers();
  const matchedUser = users.find(
    (u) =>
      u.id === cleanUserId ||
      u.displayId === cleanUserId ||
      u.email.toLowerCase() === cleanUserId.toLowerCase()
  );

  const targetKeys = Array.from(
    new Set(
      [cleanUserId, matchedUser?.id, matchedUser?.displayId, matchedUser?.email]
        .filter((v): v is string => Boolean(v && v.trim()))
        .flatMap((v) => [v.trim(), v.trim().toLowerCase()])
    )
  );
  const lowerTargetSet = new Set(targetKeys.map((k) => k.toLowerCase()));

  // Archive local conversations involving this user BEFORE deleting them
  const messagesData = getStoredMessagesData();
  const removedMsgIds: string[] = [];
  const filteredConvs = messagesData.conversations.filter((c) => {
    const matches =
      c.participants.some((p) => lowerTargetSet.has(String(p || '').trim().toLowerCase())) ||
      c.messages.some((m) => lowerTargetSet.has(String(m.senderId || '').trim().toLowerCase()));
    if (matches) {
      archiveDeletedChatSnapshot(
        {
          conversationId: c.id,
          participants: c.participants,
          participantDetails: c.participantDetails,
          createdAt: c.createdAt,
          messages: c.messages || [],
        },
        users,
        matchedUser?.id || cleanUserId
      );
      for (const m of c.messages || []) {
        if (m?.id) removedMsgIds.push(m.id);
      }
      return false;
    }
    return true;
  });
  if (filteredConvs.length !== messagesData.conversations.length) {
    saveStoredMessagesData({ conversations: filteredConvs });
    if (removedMsgIds.length > 0) {
      deleteMediaAssetsForMessageIds(removedMsgIds);
    }
  }

  // 1. Record tombstone locally so that redeploying never resurrects this user
  recordDeletedUser(cleanUserId, matchedUser?.email, matchedUser?.displayId);
  if (matchedUser?.id && matchedUser.id !== cleanUserId) {
    recordDeletedUser(matchedUser.id, matchedUser.email, matchedUser.displayId);
  }

  // 2. Delete from Neon PostgreSQL profiles, conversations, messages, friends, and store tombstone
  if (neonPool) {
    try {
      const lowerKeys = Array.from(lowerTargetSet);
      await withTimeout(
        neonPool.query(
          'DELETE FROM profiles WHERE LOWER(id) = ANY($1) OR LOWER(COALESCE(display_id, \'\')) = ANY($1) OR LOWER(email) = ANY($1)',
          [lowerKeys]
        ),
        5000
      );
      await withTimeout(
        neonPool.query(
          'DELETE FROM friends WHERE LOWER(user_id) = ANY($1) OR LOWER(friend_id) = ANY($1)',
          [lowerKeys]
        ),
        4000
      ).catch(() => {});
      await withTimeout(
        neonPool.query(
          'DELETE FROM friend_requests WHERE LOWER(sender_id) = ANY($1) OR LOWER(receiver_id) = ANY($1)',
          [lowerKeys]
        ),
        4000
      ).catch(() => {});
      const convRes: any = await withTimeout(
        neonPool.query(
          `SELECT DISTINCT conversation_id FROM conversation_participants WHERE LOWER(user_id) = ANY($1)
           UNION
           SELECT DISTINCT conversation_id FROM messages WHERE LOWER(sender_id) = ANY($1)`,
          [lowerKeys]
        ),
        4000
      ).catch(() => ({ rows: [] }));
      const convIds = (convRes?.rows || []).map((r: any) => r.conversation_id).filter(Boolean);
      if (convIds.length > 0) {
        await neonPool.query('DELETE FROM messages WHERE conversation_id = ANY($1::text[])', [convIds]).catch(() => {});
        await neonPool.query('DELETE FROM conversation_participants WHERE conversation_id = ANY($1::text[])', [convIds]).catch(() => {});
        await neonPool.query('DELETE FROM conversations WHERE id = ANY($1::text[])', [convIds]).catch(() => {});
      }
      await neonPool.query('DELETE FROM conversation_participants WHERE LOWER(user_id) = ANY($1)', [lowerKeys]).catch(() => {});
      await neonPool.query('DELETE FROM messages WHERE LOWER(sender_id) = ANY($1)', [lowerKeys]).catch(() => {});
      await withTimeout(
        neonPool.query(
          `INSERT INTO tombstones (id, entity_type, deleted_identifier, deleted_at)
           VALUES ($1, 'user', $2, NOW())`,
          [crypto.randomUUID(), cleanUserId]
        ),
        3000
      ).catch(() => {});
    } catch (neonErr) {
      console.warn('Neon admin delete user error:', neonErr);
    }
  }

  // 3. Delete local user record
  const filtered = users.filter(
    (u) =>
      !lowerTargetSet.has(u.id.toLowerCase()) &&
      !(u.displayId && lowerTargetSet.has(u.displayId.toLowerCase())) &&
      !lowerTargetSet.has(u.email.toLowerCase())
  );
  saveStoredUsers(filtered);

  // 4. Delete local friends, friend requests, blocked users, and notifications
  const friendsData = getStoredFriendsData();
  const filteredFriends = friendsData.friends.filter(
    (f) =>
      !lowerTargetSet.has(String(f.userId || '').toLowerCase()) &&
      !lowerTargetSet.has(String(f.friendId || '').toLowerCase()) &&
      !(f.userDisplayId && lowerTargetSet.has(f.userDisplayId.toLowerCase())) &&
      !(f.friendDisplayId && lowerTargetSet.has(f.friendDisplayId.toLowerCase()))
  );
  const filteredRequests = friendsData.requests.filter(
    (r) =>
      !lowerTargetSet.has(String(r.senderId || '').toLowerCase()) &&
      !lowerTargetSet.has(String(r.receiverId || '').toLowerCase()) &&
      !(r.senderDisplayId && lowerTargetSet.has(r.senderDisplayId.toLowerCase())) &&
      !(r.receiverDisplayId && lowerTargetSet.has(r.receiverDisplayId.toLowerCase()))
  );
  if (filteredFriends.length !== friendsData.friends.length || filteredRequests.length !== friendsData.requests.length) {
    saveStoredFriendsData({ friends: filteredFriends, requests: filteredRequests });
  }

  const blocked = getStoredBlockedUsers();
  const filteredBlocked = blocked.filter(
    (b) =>
      !lowerTargetSet.has(String(b.blockerId || '').toLowerCase()) &&
      !lowerTargetSet.has(String(b.blockedId || '').toLowerCase())
  );
  if (filteredBlocked.length !== blocked.length) {
    saveStoredBlockedUsers(filteredBlocked);
  }

  const notifs = getStoredUserNotifications();
  const filteredNotifs = notifs.filter(
    (n) =>
      !lowerTargetSet.has(String(n.userId || '').toLowerCase()) &&
      !(n.userDisplayId && lowerTargetSet.has(n.userDisplayId.toLowerCase()))
  );
  if (filteredNotifs.length !== notifs.length) {
    saveStoredUserNotifications(filteredNotifs);
  }

  // 5. Revoke active sessions
  const sessions = getStoredSessions();
  saveStoredSessions(
    sessions.filter(
      (s) =>
        !lowerTargetSet.has(String(s.userId || '').toLowerCase()) &&
        !(s.displayId && lowerTargetSet.has(s.displayId.toLowerCase())) &&
        !lowerTargetSet.has(String(s.email || '').toLowerCase())
    )
  );
}

// 5. Endpoint: حذف مستخدم من لوحة التحكم (محمية بـ ADMIN_PIN)
app.post('/api/admin/delete-user', verifyAdminAuth, async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  await deleteUserCompletely(String(userId).trim());

  return res.json({
    success: true,
    message: 'تم حذف المستخدم وجميع محادثاته وبياناته من النظام نهائياً وضمان عدم عودته بعد إعادة النشر.',
  });
});

// 6. Endpoint: تعديل مستخدم بالكامل (اسم المستخدم - البريد - ID الحساب - تاريخ الميلاد - الجنس - الدولة - النبذة)
app.post('/api/admin/update-user', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      userId,
      originalEmail,
      originalDisplayId,
      name,
      email,
      displayId,
      birthDate,
      gender,
      bio,
      country,
    } = req.body || {};

    if (!userId && !originalEmail && !originalDisplayId) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }

    const cleanUserId = userId ? String(userId).trim() : '';
    const cleanOriginalEmail = originalEmail ? String(originalEmail).trim().toLowerCase() : '';
    const cleanOriginalDisplayId = originalDisplayId ? String(originalDisplayId).trim() : '';

    const cleanName = name !== undefined ? String(name).trim() : undefined;
    const cleanEmail = email !== undefined ? String(email).trim().toLowerCase() : undefined;
    const cleanDisplayId = displayId !== undefined ? String(displayId).trim() : undefined;

    if (cleanName !== undefined && !cleanName) {
      return res.status(400).json({ success: false, message: 'اسم المستخدم لا يمكن أن يكون فارغاً' });
    }
    if (cleanEmail !== undefined && !cleanEmail) {
      return res.status(400).json({ success: false, message: 'البريد الإلكتروني لا يمكن أن يكون فارغاً' });
    }
    if (cleanDisplayId !== undefined && !cleanDisplayId) {
      return res.status(400).json({ success: false, message: 'معرف الحساب ID لا يمكن أن يكون فارغاً' });
    }

    let cleanBirthDate: string | null | undefined = undefined;
    if (birthDate !== undefined) {
      if (birthDate === null || String(birthDate).trim() === '') {
        cleanBirthDate = null;
      } else {
        const normalizedDate = String(birthDate).trim().split('T')[0];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
          return res.status(400).json({ success: false, message: 'صيغة تاريخ الميلاد غير صالحة (YYYY-MM-DD)' });
        }
        cleanBirthDate = normalizedDate;
      }
    }

    let cleanGender: 'male' | 'female' | null | undefined = undefined;
    if (gender !== undefined) {
      cleanGender = gender === 'male' || gender === 'female' ? gender : null;
    }

    const cleanBio =
      bio !== undefined
        ? typeof bio === 'string'
          ? bio.trim() || null
          : null
        : undefined;
    const cleanCountry =
      country !== undefined
        ? typeof country === 'string'
          ? country.trim() || null
          : null
        : undefined;

    // 1. Locate user in Neon PostgreSQL (if connected) and in local users.json
    let neonProfile: any = null;
    if (neonPool) {
      neonProfile =
        (cleanUserId ? await getNeonProfileByIdentifier(cleanUserId).catch(() => null) : null) ||
        (cleanOriginalDisplayId ? await getNeonProfileByIdentifier(cleanOriginalDisplayId).catch(() => null) : null) ||
        (cleanOriginalEmail ? await getNeonProfileByIdentifier(cleanOriginalEmail).catch(() => null) : null);
    }

    const users = getStoredUsers();
    let userIndex = users.findIndex(
      (u) =>
        (cleanUserId && (u.id === cleanUserId || u.displayId === cleanUserId)) ||
        (cleanOriginalDisplayId && (u.displayId === cleanOriginalDisplayId || u.id === cleanOriginalDisplayId)) ||
        (cleanOriginalEmail && (u.email || '').toLowerCase() === cleanOriginalEmail) ||
        (neonProfile &&
          (u.id === neonProfile.id ||
            (neonProfile.email && (u.email || '').toLowerCase() === String(neonProfile.email).toLowerCase())))
    );

    if (userIndex === -1 && !neonProfile) {
      return res.status(404).json({ success: false, message: 'لم يتم العثور على المستخدم المطلوب' });
    }

    const localUser = userIndex !== -1 ? users[userIndex] : null;
    const targetIds = new Set(
      [
        cleanUserId,
        cleanOriginalDisplayId,
        localUser?.id,
        localUser?.displayId,
        neonProfile?.id,
        neonProfile?.displayId || neonProfile?.display_id,
      ]
        .filter(Boolean)
        .map((v) => String(v).trim())
    );
    const targetEmails = new Set(
      [cleanOriginalEmail, localUser?.email, neonProfile?.email]
        .filter(Boolean)
        .map((v) => String(v).trim().toLowerCase())
    );

    const isSameTargetUser = (candidate: { id?: string; displayId?: string; display_id?: string; email?: string }) => {
      const cid = candidate.id ? String(candidate.id).trim() : '';
      const cdid = (candidate.displayId || candidate.display_id || '').trim();
      const cemail = (candidate.email || '').trim().toLowerCase();
      return (
        (cid && targetIds.has(cid)) ||
        (cdid && targetIds.has(cdid)) ||
        (cemail && targetEmails.has(cemail))
      );
    };

    // 2. Validate displayId uniqueness across local users & Neon
    if (cleanDisplayId) {
      const existingLocalWithId = users.find(
        (u, idx) =>
          idx !== userIndex &&
          !isSameTargetUser(u) &&
          (u.displayId === cleanDisplayId || u.id === cleanDisplayId)
      );
      if (existingLocalWithId) {
        return res.status(400).json({
          success: false,
          message: `معرف الحساب ID (${cleanDisplayId}) مستخدم بالفعل من قبل حساب آخر!`,
        });
      }
      if (neonPool) {
        const dupRes: any = await withTimeout(
          neonPool.query('SELECT id, display_id, email FROM profiles WHERE display_id = $1 OR id = $1 LIMIT 5', [
            cleanDisplayId,
          ]),
          4000
        ).catch(() => null);
        const dupRow = dupRes?.rows?.find((row: any) => !isSameTargetUser(row));
        if (dupRow) {
          return res.status(400).json({
            success: false,
            message: `معرف الحساب ID (${cleanDisplayId}) مستخدم بالفعل من قبل حساب آخر!`,
          });
        }
      }
    }

    // 3. Validate email uniqueness across local users & Neon
    if (cleanEmail) {
      const existingLocalWithEmail = users.find(
        (u, idx) =>
          idx !== userIndex &&
          !isSameTargetUser(u) &&
          (u.email || '').trim().toLowerCase() === cleanEmail
      );
      if (existingLocalWithEmail) {
        return res.status(400).json({
          success: false,
          message: `البريد الإلكتروني (${cleanEmail}) مسجل مسبقاً لمستخدم آخر!`,
        });
      }
      if (neonPool) {
        const dupEmailRes: any = await withTimeout(
          neonPool.query('SELECT id, display_id, email FROM profiles WHERE LOWER(email) = LOWER($1) LIMIT 5', [
            cleanEmail,
          ]),
          4000
        ).catch(() => null);
        const dupEmailRow = dupEmailRes?.rows?.find((row: any) => !isSameTargetUser(row));
        if (dupEmailRow) {
          return res.status(400).json({
            success: false,
            message: `البريد الإلكتروني (${cleanEmail}) مسجل مسبقاً لمستخدم آخر!`,
          });
        }
      }
    }

    const nowIso = new Date().toISOString();
    const resolvedId = neonProfile?.id || localUser?.id || cleanUserId;
    const resolvedName = cleanName ?? localUser?.name ?? neonProfile?.name ?? 'مستخدم Soul-X';
    const resolvedEmail = cleanEmail ?? (localUser?.email || neonProfile?.email || '').toLowerCase();
    const resolvedDisplayId =
      cleanDisplayId ?? localUser?.displayId ?? neonProfile?.displayId ?? neonProfile?.display_id ?? resolvedId;
    const resolvedBirthDate =
      cleanBirthDate !== undefined
        ? cleanBirthDate
        : (localUser?.birthDate ?? (neonProfile?.birth_date ? String(neonProfile.birth_date).split('T')[0] : null));
    const resolvedGender =
      cleanGender !== undefined ? cleanGender : (localUser?.gender ?? neonProfile?.gender ?? null);
    const resolvedBio =
      cleanBio !== undefined ? cleanBio : (localUser?.bio ?? neonProfile?.bio ?? null);
    const resolvedCountry =
      cleanCountry !== undefined ? cleanCountry : (localUser?.country ?? neonProfile?.country ?? null);

    // 4. Persist to local users.json cache first
    if (userIndex !== -1) {
      const target = users[userIndex];
      target.name = resolvedName;
      target.email = resolvedEmail;
      target.displayId = resolvedDisplayId;
      target.birthDate = resolvedBirthDate;
      target.gender = resolvedGender;
      if (cleanBio !== undefined) {
        if (cleanBio) target.bio = cleanBio;
        else delete target.bio;
      }
      if (cleanCountry !== undefined) {
        if (cleanCountry) target.country = cleanCountry;
        else delete target.country;
      }
      target.updatedAt = nowIso;
    } else if (neonProfile) {
      users.push({
        id: resolvedId,
        displayId: resolvedDisplayId,
        email: resolvedEmail,
        name: resolvedName,
        passwordHash: neonProfile.password_hash || hashPassword(DEFAULT_ADMIN_PASSWORD),
        createdAt: neonProfile.created_at || nowIso,
        birthDate: resolvedBirthDate,
        gender: resolvedGender,
        country: resolvedCountry || undefined,
        photoUrl: neonProfile.avatar_url || undefined,
        bio: resolvedBio || undefined,
        walletBalance: parseDbNumber(neonProfile.wallet_balance, 0),
        coinsBalance: parseDbNumber(neonProfile.coins_balance, 0),
        updatedAt: nowIso,
      });
      userIndex = users.length - 1;
    }
    saveStoredUsers(users);

    // 5. Persist to Neon PostgreSQL profiles table (if connected)
    if (neonPool) {
      if (neonProfile?.id) {
        const sets: string[] = [
          'name = $1',
          'email = LOWER($2)',
          'display_id = $3',
          'updated_at = NOW()',
        ];
        const params: any[] = [resolvedName, resolvedEmail, resolvedDisplayId];
        let pIdx = 4;

        if (cleanBirthDate !== undefined) {
          sets.push(`birth_date = $${pIdx++}::date`);
          params.push(cleanBirthDate);
        }
        if (cleanGender !== undefined) {
          sets.push(`gender = $${pIdx++}`);
          params.push(cleanGender);
        }
        if (cleanBio !== undefined) {
          sets.push(`bio = $${pIdx++}`);
          params.push(cleanBio);
        }
        if (cleanCountry !== undefined) {
          sets.push(`country = $${pIdx++}`);
          params.push(cleanCountry);
        }
        params.push(neonProfile.id);

        await withTimeout(
          neonPool.query(`UPDATE profiles SET ${sets.join(', ')} WHERE id = $${pIdx}`, params),
          5000
        );
        verifiedNeonTables.profiles = true;
      } else {
        const storedTarget = users[userIndex];
        const upsertRes = await saveProfileToNeon({
          id: resolvedId,
          displayId: resolvedDisplayId,
          email: resolvedEmail,
          name: resolvedName,
          passwordHash: storedTarget?.passwordHash,
          photoUrl: storedTarget?.photoUrl,
          birthDate: resolvedBirthDate,
          gender: resolvedGender,
          country: resolvedCountry,
          bio: resolvedBio || undefined,
          walletBalance: storedTarget?.walletBalance,
          coinsBalance: storedTarget?.coinsBalance,
          createdAt: storedTarget?.createdAt,
        });
        if (!upsertRes.success) {
          console.warn('Neon admin update-user upsert warning:', upsertRes.error);
        }
      }
    }

    // 6. Update active sessions matching any previous/current identifier of this user
    const sessions = getStoredSessions();
    let sessionsUpdated = false;
    sessions.forEach((s) => {
      const sId = s.userId ? String(s.userId).trim() : '';
      const sDid = s.displayId ? String(s.displayId).trim() : '';
      const sEmail = s.email ? String(s.email).trim().toLowerCase() : '';
      if (
        (sId && targetIds.has(sId)) ||
        (sDid && targetIds.has(sDid)) ||
        (sEmail && targetEmails.has(sEmail))
      ) {
        s.name = resolvedName;
        s.email = resolvedEmail;
        s.displayId = resolvedDisplayId;
        if (cleanCountry !== undefined) {
          s.country = cleanCountry || undefined;
        }
        sessionsUpdated = true;
      }
    });
    if (sessionsUpdated) saveStoredSessions(sessions);

    return res.json({
      success: true,
      message: 'تم تحديث بيانات المستخدم بنجاح',
      user: {
        id: resolvedId,
        name: resolvedName,
        email: resolvedEmail,
        displayId: resolvedDisplayId,
        birthDate: resolvedBirthDate,
        gender: resolvedGender,
        bio: resolvedBio,
        country: resolvedCountry,
        updatedAt: nowIso,
      },
    });
  } catch (err: any) {
    console.error('Admin update-user error:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء حفظ بيانات المستخدم',
    });
  }
});

// 6.1 Endpoint: تعديل دولة المستخدم مباشرة من لوحة التحكم (محمية بـ ADMIN_PIN)
app.post('/api/admin/users/:userId/country', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { country } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }

    const cleanUserId = String(userId).trim();
    const cleanCountry = typeof country === 'string' ? country.trim() : '';

    if (!cleanCountry) {
      return res.status(400).json({ success: false, message: 'اسم الدولة مطلوب' });
    }

    // 1. Update in Neon PostgreSQL
    await updateNeonProfileByIdentifier(cleanUserId, { country: cleanCountry }).catch((err) => {
      console.warn('Neon update user country warning:', err?.message || err);
    });

    // 2. Update in stored users
    const users = getStoredUsers();
    const userIndex = users.findIndex(
      (u) => u.id === cleanUserId || u.displayId === cleanUserId || u.email.toLowerCase() === cleanUserId.toLowerCase()
    );
    if (userIndex !== -1) {
      users[userIndex].country = cleanCountry;
      saveStoredUsers(users);
    }

    // 3. Update in active sessions
    const sessions = getStoredSessions();
    let sessionsUpdated = false;
    sessions.forEach((s) => {
      if (s.userId === cleanUserId || s.displayId === cleanUserId || s.email.toLowerCase() === cleanUserId.toLowerCase()) {
        s.country = cleanCountry;
        sessionsUpdated = true;
      }
    });
    if (sessionsUpdated) saveStoredSessions(sessions);

    return res.json({
      success: true,
      message: `تم تحديث دولة المستخدم إلى "${cleanCountry}" بنجاح`,
      country: cleanCountry,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'خطأ أثناء تحديث الدولة: ' + err?.message });
  }
});

// Endpoint: جلب البايو الافتراضي العام عند بدء التسجيل
app.get('/api/settings/default-bio', (_req: Request, res: Response) => {
  const settings = getAppSettings();
  return res.json({
    success: true,
    defaultBio: settings.defaultBio,
    defaultBioEn: settings.defaultBioEn,
    updatedAt: settings.updatedAt,
  });
});

// Endpoint: تعديل البايو الافتراضي العام من لوحة التحكم (محمية بـ verifyAdminAuth)
app.post('/api/admin/settings/default-bio', verifyAdminAuth, async (req: Request, res: Response) => {
  const { defaultBio, defaultBioEn, applyToExisting } = req.body;
  if (!defaultBio || typeof defaultBio !== 'string' || !defaultBio.trim()) {
    return res.status(400).json({ success: false, message: 'نص البايو الافتراضي مطلوب' });
  }

  const cleanBio = defaultBio.trim();
  const cleanBioEn = defaultBioEn && typeof defaultBioEn === 'string' ? defaultBioEn.trim() : undefined;

  saveAppSettings({ defaultBio: cleanBio, defaultBioEn: cleanBioEn });

  let updatedCount = 0;
  if (applyToExisting) {
    const users = getStoredUsers();
    users.forEach((u) => {
      if (!u.bio || !u.bio.trim() || u.bio.includes('لم أقم بتعيين الوصف') || u.bio.includes('أبحث عن تواصل حقيقي')) {
        u.bio = cleanBio;
        updatedCount++;
      }
    });
    if (updatedCount > 0) {
      saveStoredUsers(users);
    }
  }

  return res.json({
    success: true,
    message: applyToExisting && updatedCount > 0
      ? `تم حفظ البايو الافتراضي وتحديث (${updatedCount}) حساب مستخدم بنجاح ✨`
      : 'تم حفظ وتحديث البايو الافتراضي بنجاح ✨',
    defaultBio: cleanBio,
    defaultBioEn: cleanBioEn,
    updatedCount,
  });
});

// Endpoint: جلب حالة تفعيل/تعطيل قسم المتجر وقسم الألعاب (عام)
app.get('/api/settings/sections', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const settings = getAppSettings();
  return res.json({
    success: true,
    gamesEnabled: settings.gamesEnabled,
    storeEnabled: settings.storeEnabled,
    updatedAt: settings.updatedAt,
  });
});

// Endpoint: جلب حالة الأقسام للإدارة (محمية بـ verifyAdminAuth)
app.get('/api/admin/settings/sections', verifyAdminAuth, (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const settings = getAppSettings();
  return res.json({
    success: true,
    gamesEnabled: settings.gamesEnabled,
    storeEnabled: settings.storeEnabled,
    updatedAt: settings.updatedAt,
  });
});

// Endpoint: تفعيل أو تعطيل قسم المتجر وقسم الألعاب من لوحة التحكم (محمية بـ verifyAdminAuth)
app.post('/api/admin/settings/sections', verifyAdminAuth, (req: Request, res: Response) => {
  const { gamesEnabled, storeEnabled } = req.body || {};
  if (typeof gamesEnabled !== 'boolean' && typeof storeEnabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: 'يجب تحديد حالة التفعيل أو التعطيل لقسم المتجر أو قسم الألعاب',
    });
  }

  const updated = saveAppSettings({
    ...(typeof gamesEnabled === 'boolean' ? { gamesEnabled } : {}),
    ...(typeof storeEnabled === 'boolean' ? { storeEnabled } : {}),
  });

  return res.json({
    success: true,
    gamesEnabled: updated.gamesEnabled,
    storeEnabled: updated.storeEnabled,
    updatedAt: updated.updatedAt,
    message: 'تم تحديث حالة الأقسام بنجاح',
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

  // Update in Neon PostgreSQL profiles table
  await updateNeonProfileByIdentifier(cleanUserId, {
    passwordHash: hashPassword(cleanPassword),
  }).catch((err) => {
    console.warn('Neon admin change password error:', err?.message || err);
  });

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
  });
});

// ==========================================
// Administrative Freeze & Ban Endpoints (تجميد وحظر وفك تجميد وحظر المستخدمين)
// ==========================================

// Endpoint: التحقق المباشر من حالة الحساب (نشط، مجمد، أو محظور)
app.get('/api/users/account-status', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const queryUserId = ((req.query.userId as string) || (req.query.id as string) || '').trim();
    const queryEmail = ((req.query.email as string) || '').trim().toLowerCase();
    const authHeader = (req.headers['authorization'] as string) || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

    let user: StoredUser | undefined;
    const users = getStoredUsers();

    if (token) {
      const sessions = getStoredSessions();
      const session = sessions.find((s) => s.token === token || s.refreshToken === token);
      if (session) {
        user = users.find(
          (u) =>
            u.id === session.userId ||
            (u.displayId && u.displayId === session.displayId) ||
            u.email.toLowerCase() === session.email.toLowerCase()
        );
      }
    }

    if (!user && (queryUserId || queryEmail)) {
      user = users.find(
        (u) =>
          (queryUserId && (u.id === queryUserId || u.displayId === queryUserId)) ||
          (queryEmail && u.email.toLowerCase() === queryEmail)
      );
    }

    const serverNow = Date.now();

    if (!user) {
      return res.json({
        success: true,
        accountState: 'active',
        isFrozen: false,
        isBanned: false,
        isVerified: false,
        serverNow,
        status: {
          isBanned: false,
          bannedAt: null,
          banReason: null,
          isFrozen: false,
          frozenAt: null,
          freezeDurationMinutes: null,
          freezeExpiresAt: null,
          freezeReason: null,
          remainingMs: 0,
          serverNow,
        },
      });
    }

    // Check if freeze has expired
    const changed = checkAndExpireUserFreeze(user);
    if (changed) {
      saveStoredUsers(users);
    }

    if (user.isBanned) {
      const banInfo = {
        isBanned: true,
        bannedAt: user.bannedAt || null,
        banReason: user.banReason || 'حظر إداري نهائي',
        isFrozen: false,
        frozenAt: null,
        freezeDurationMinutes: null,
        freezeExpiresAt: null,
        freezeReason: null,
        remainingMs: 0,
        serverNow,
      };
      return res.json({
        success: true,
        accountState: 'banned',
        isBanned: true,
        isFrozen: false,
        isVerified: Boolean(user.isVerified),
        bannedAt: banInfo.bannedAt,
        banReason: banInfo.banReason,
        serverNow,
        status: banInfo,
        user: {
          id: user.id,
          displayId: user.displayId,
          name: user.name,
          email: user.email,
          isVerified: Boolean(user.isVerified),
        },
      });
    }

    if (user.isFrozen && user.freezeExpiresAt) {
      const remainingMs = Math.max(0, new Date(user.freezeExpiresAt).getTime() - serverNow);
      if (remainingMs > 0) {
        const freezeInfo = {
          isBanned: false,
          bannedAt: null,
          banReason: null,
          isFrozen: true,
          frozenAt: user.frozenAt || null,
          freezeDurationMinutes: user.freezeDurationMinutes || 0,
          freezeExpiresAt: user.freezeExpiresAt,
          remainingMs,
          serverNow,
          freezeReason: user.freezeReason || 'تجميد إداري مؤقت',
        };
        return res.json({
          success: true,
          accountState: 'frozen',
          isFrozen: true,
          isBanned: false,
          isVerified: Boolean(user.isVerified),
          frozenAt: freezeInfo.frozenAt,
          freezeDurationMinutes: freezeInfo.freezeDurationMinutes,
          freezeExpiresAt: freezeInfo.freezeExpiresAt,
          remainingMs,
          serverNow,
          freezeReason: freezeInfo.freezeReason,
          status: freezeInfo,
          user: {
            id: user.id,
            displayId: user.displayId,
            name: user.name,
            email: user.email,
            isVerified: Boolean(user.isVerified),
          },
        });
      }
    }

    return res.json({
      success: true,
      accountState: 'active',
      isFrozen: false,
      isBanned: false,
      isVerified: Boolean(user.isVerified),
      status: {
        isBanned: false,
        bannedAt: null,
        banReason: null,
        isFrozen: false,
        frozenAt: null,
        freezeDurationMinutes: null,
        freezeExpiresAt: null,
        freezeReason: null,
        remainingMs: 0,
      },
      user: {
        id: user.id,
        displayId: user.displayId,
        name: user.name,
        email: user.email,
        isVerified: Boolean(user.isVerified),
      },
    });
  } catch (err: any) {
    return res.json({
      success: true,
      accountState: 'active',
      isFrozen: false,
      isBanned: false,
      status: {
        isBanned: false,
        isFrozen: false,
        remainingMs: 0,
      },
    });
  }
});

// Endpoint: تجميد حساب المستخدم لمدة محددة بالدقيقة (محمية بـ ADMIN_PIN)
app.post('/api/admin/users/freeze', verifyAdminAuth, async (req: Request, res: Response) => {
  const { userId, durationMinutes, reason } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const minutes = parseInt(durationMinutes, 10);
  if (isNaN(minutes) || minutes <= 0) {
    return res.status(400).json({ success: false, message: 'مدة التجميد بالدقيقة غير صالحة، يجب أن تكون رقماً أكبر من صفر' });
  }

  const cleanUserId = String(userId).trim();
  const users = getStoredUsers();
  const user = users.find(
    (u) => u.id === cleanUserId || u.displayId === cleanUserId || u.email.toLowerCase() === cleanUserId.toLowerCase()
  );

  if (!user) {
    return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
  }

  // Prevent freezing administrator accounts
  const adminEmails = getAdminEmails();
  if (adminEmails.includes(user.email.toLowerCase())) {
    return res.status(403).json({ success: false, message: 'لا يمكن تجميد حسابات مدراء النظام' });
  }

  const nowMs = Date.now();
  const durationMs = minutes * 60 * 1000;
  const now = new Date(nowMs);
  const expires = new Date(nowMs + durationMs);

  user.isFrozen = true;
  user.frozenAt = now.toISOString();
  user.freezeDurationMinutes = minutes;
  user.freezeExpiresAt = expires.toISOString();
  user.freezeReason = (reason && String(reason).trim()) || 'تجميد إداري مؤقت لمخالفة القواعد';
  user.isBanned = false;
  user.bannedAt = null;
  user.banReason = null;

  saveStoredUsers(users);

  return res.json({
    success: true,
    message: `تم تجميد حساب المستخدم (${user.name}) لمدة ${minutes} دقيقة بنجاح.`,
    serverNow: nowMs,
    remainingMs: durationMs,
    user: {
      id: user.id,
      displayId: user.displayId,
      name: user.name,
      email: user.email,
      isFrozen: true,
      frozenAt: user.frozenAt,
      freezeDurationMinutes: user.freezeDurationMinutes,
      freezeExpiresAt: user.freezeExpiresAt,
      freezeReason: user.freezeReason,
      remainingMs: durationMs,
    },
  });
});

// Endpoint: فك تجميد حساب المستخدم فورياً (محمية بـ ADMIN_PIN)
app.post('/api/admin/users/unfreeze', verifyAdminAuth, async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const cleanUserId = String(userId).trim();
  const users = getStoredUsers();
  const user = users.find(
    (u) => u.id === cleanUserId || u.displayId === cleanUserId || u.email.toLowerCase() === cleanUserId.toLowerCase()
  );

  if (!user) {
    return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
  }

  user.isFrozen = false;
  user.frozenAt = null;
  user.freezeDurationMinutes = null;
  user.freezeExpiresAt = null;
  user.freezeReason = null;

  saveStoredUsers(users);

  return res.json({
    success: true,
    message: `تم فك تجميد حساب المستخدم (${user.name}) بنجاح، ويمكنه استخدام المنصة بحرية الآن.`,
    user: {
      id: user.id,
      displayId: user.displayId,
      name: user.name,
      isFrozen: false,
    },
  });
});

// Endpoint: حظر حساب المستخدم بشكل نهائي (محمية بـ ADMIN_PIN)
app.post('/api/admin/users/ban', verifyAdminAuth, async (req: Request, res: Response) => {
  const { userId, reason } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const cleanUserId = String(userId).trim();
  const users = getStoredUsers();
  const user = users.find(
    (u) => u.id === cleanUserId || u.displayId === cleanUserId || u.email.toLowerCase() === cleanUserId.toLowerCase()
  );

  if (!user) {
    return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
  }

  const adminEmails = getAdminEmails();
  if (adminEmails.includes(user.email.toLowerCase())) {
    return res.status(403).json({ success: false, message: 'لا يمكن حظر حسابات مدراء النظام' });
  }

  user.isBanned = true;
  user.bannedAt = new Date().toISOString();
  user.banReason = (reason && String(reason).trim()) || 'حظر إداري نهائي لمخالفة شروط وسياسات الاستخدام';
  user.isFrozen = false;
  user.frozenAt = null;
  user.freezeDurationMinutes = null;
  user.freezeExpiresAt = null;
  user.freezeReason = null;

  saveStoredUsers(users);

  return res.json({
    success: true,
    message: `تم حظر حساب المستخدم (${user.name}) نهائياً بنجاح.`,
    user: {
      id: user.id,
      displayId: user.displayId,
      name: user.name,
      email: user.email,
      isBanned: true,
      bannedAt: user.bannedAt,
      banReason: user.banReason,
    },
  });
});

// Endpoint: فك حظر حساب المستخدم (محمية بـ ADMIN_PIN)
app.post('/api/admin/users/unban', verifyAdminAuth, async (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const cleanUserId = String(userId).trim();
  const users = getStoredUsers();
  const user = users.find(
    (u) => u.id === cleanUserId || u.displayId === cleanUserId || u.email.toLowerCase() === cleanUserId.toLowerCase()
  );

  if (!user) {
    return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
  }

  user.isBanned = false;
  user.bannedAt = null;
  user.banReason = null;

  saveStoredUsers(users);

  return res.json({
    success: true,
    message: `تم فك حظر حساب المستخدم (${user.name}) بنجاح، ويمكنه الآن تسجيل الدخول واستخدام حسابه.`,
    user: {
      id: user.id,
      displayId: user.displayId,
      name: user.name,
      isBanned: false,
    },
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
  const isAdmin =
    (cleanEmail && adminEmails.includes(cleanEmail)) ||
    cleanUserId === 'admin-1001' ||
    cleanUserId === 'admin-1002';

  const users = getStoredUsers();
  const user = users.find(
    (u) =>
      u.id === cleanUserId ||
      u.displayId === cleanUserId ||
      (cleanDisplayId && u.displayId === cleanDisplayId) ||
      (cleanEmail && u.email.toLowerCase() === cleanEmail) ||
      u.email.toLowerCase() === cleanUserId.toLowerCase()
  );

  let neonProfile: any = null;
  if (neonPool) {
    neonProfile = await getNeonProfileByIdentifier(cleanUserId || cleanDisplayId || cleanEmail);
  }

  if (selectedCurrency === 'coins') {
    // Handling Coins 🪙
    let currentCoins =
      neonProfile
        ? parseDbNumber(neonProfile.coins_balance, typeof user?.coinsBalance === 'number' ? user.coinsBalance : (isAdmin ? 100000 : 0))
        : (typeof user?.coinsBalance === 'number' ? user.coinsBalance : (isAdmin ? 100000 : 0));

    let newCoins = currentCoins;
    if (action === 'add') {
      newCoins = Math.round(currentCoins + Math.abs(amount));
    } else if (action === 'deduct') {
      newCoins = Math.max(0, Math.round(currentCoins - Math.abs(amount)));
    } else if (action === 'set') {
      newCoins = Math.max(0, Math.round(amount));
    }

    const nowIso = new Date().toISOString();
    let updatedInStored = false;
    users.forEach((u) => {
      if (
        u.id === cleanUserId ||
        u.displayId === cleanUserId ||
        (cleanDisplayId && u.displayId === cleanDisplayId) ||
        (cleanEmail && u.email.toLowerCase() === cleanEmail) ||
        u.email.toLowerCase() === cleanUserId.toLowerCase() ||
        (neonProfile && u.id === neonProfile.id)
      ) {
        u.coinsBalance = newCoins;
        if (neonProfile) {
          u.walletBalance = parseDbNumber(neonProfile.wallet_balance, u.walletBalance ?? 0);
        }
        u.updatedAt = nowIso;
        updatedInStored = true;
      }
    });

    if (!updatedInStored) {
      users.push({
        id: neonProfile?.id || cleanUserId,
        displayId: neonProfile?.displayId || cleanDisplayId || (cleanUserId.startsWith('S-') ? cleanUserId : generateSoulXId()),
        email: neonProfile?.email || cleanEmail || `${cleanUserId}@soul-x.com`,
        name: neonProfile?.name || user?.name || `مستخدم ${cleanUserId.slice(0, 8)}`,
        passwordHash: neonProfile?.passwordHash || hashPassword(DEFAULT_ADMIN_PASSWORD),
        createdAt: neonProfile?.createdAt || nowIso,
        updatedAt: nowIso,
        walletBalance: neonProfile ? parseDbNumber(neonProfile.wallet_balance, isAdmin ? 99999 : 0) : (isAdmin ? 99999 : 0),
        coinsBalance: newCoins,
      });
    }
    saveStoredUsers(users);

    // Sync coins balance to Neon PostgreSQL
    await updateNeonProfileByIdentifier(neonProfile?.id || user?.id || cleanUserId, {
      coinsBalance: newCoins,
    }).catch((err) => {
      console.warn('Neon update coins error:', err?.message || err);
    });

    broadcastChatMessage([cleanUserId, neonProfile?.id, user?.id, user?.displayId, cleanDisplayId], {
      type: 'balance_update',
      currency: 'coins',
      balance: newCoins,
      userId: neonProfile?.id || user?.id || cleanUserId,
      displayId: neonProfile?.displayId || user?.displayId || cleanDisplayId,
    });

    const actionText = action === 'add' ? `إضافة +${amount.toLocaleString()}` : action === 'deduct' ? `خصم -${amount.toLocaleString()}` : `تعيين الرصيد إلى ${newCoins.toLocaleString()}`;

    return res.json({
      success: true,
      currency: 'coins',
      coinsBalance: newCoins,
      walletBalance: neonProfile ? parseDbNumber(neonProfile.wallet_balance, 0) : (user?.walletBalance ?? (isAdmin ? 99999 : 0)),
      userId: neonProfile?.id || cleanUserId,
      displayId: neonProfile?.displayId || user?.displayId || cleanDisplayId || cleanUserId,
      message: `تمت عملية ${actionText} للكوينز 🪙 بنجاح. رصيد الكوينز الحالي: ${newCoins.toLocaleString()} 🪙`,
    });
  }

  // Handling Diamonds 💎 (Default / walletBalance)
  let currentBalance =
    neonProfile
      ? parseDbNumber(neonProfile.wallet_balance, typeof user?.walletBalance === 'number' ? user.walletBalance : (isAdmin ? 99999 : 0))
      : (typeof user?.walletBalance === 'number' ? user.walletBalance : (isAdmin ? 99999 : 0));

  let newBalance = currentBalance;
  if (action === 'add') {
    newBalance = Math.round(currentBalance + Math.abs(amount));
  } else if (action === 'deduct') {
    newBalance = Math.max(0, Math.round(currentBalance - Math.abs(amount)));
  } else if (action === 'set') {
    newBalance = Math.max(0, Math.round(amount));
  }

  const nowIso = new Date().toISOString();
  // Update Neon PostgreSQL
  await updateNeonProfileByIdentifier(neonProfile?.id || user?.id || cleanUserId, {
    walletBalance: newBalance,
  }).catch((err) => {
    console.warn('Neon update wallet_balance error:', err?.message || err);
  });
  if (cleanEmail && cleanEmail !== (neonProfile?.id || user?.id || cleanUserId)) {
    await updateNeonProfileByIdentifier(cleanEmail, {
      walletBalance: newBalance,
    }).catch(() => {});
  }

  // Update stored users
  let updatedInStored = false;
  users.forEach((u) => {
    if (
      u.id === cleanUserId ||
      u.displayId === cleanUserId ||
      (cleanDisplayId && u.displayId === cleanDisplayId) ||
      (cleanEmail && u.email.toLowerCase() === cleanEmail) ||
      u.email.toLowerCase() === cleanUserId.toLowerCase() ||
      (neonProfile && u.id === neonProfile.id)
    ) {
      u.walletBalance = newBalance;
      if (neonProfile) {
        u.coinsBalance = parseDbNumber(neonProfile.coins_balance, u.coinsBalance ?? 0);
      }
      u.updatedAt = nowIso;
      updatedInStored = true;
    }
  });

  if (!updatedInStored) {
    users.push({
      id: neonProfile?.id || cleanUserId,
      displayId: neonProfile?.displayId || cleanDisplayId || (cleanUserId.startsWith('S-') ? cleanUserId : generateSoulXId()),
      email: neonProfile?.email || cleanEmail || `${cleanUserId}@soul-x.com`,
      name: neonProfile?.name || user?.name || `مستخدم ${cleanUserId.slice(0, 8)}`,
      passwordHash: neonProfile?.passwordHash || hashPassword(DEFAULT_ADMIN_PASSWORD),
      createdAt: neonProfile?.createdAt || nowIso,
      updatedAt: nowIso,
      walletBalance: newBalance,
      coinsBalance: neonProfile ? parseDbNumber(neonProfile.coins_balance, isAdmin ? 100000 : 0) : (isAdmin ? 100000 : 0),
    });
  }
  saveStoredUsers(users);

  broadcastChatMessage([cleanUserId, neonProfile?.id, user?.id, user?.displayId, cleanDisplayId], {
    type: 'balance_update',
    currency: 'diamonds',
    balance: newBalance,
    userId: neonProfile?.id || user?.id || cleanUserId,
    displayId: neonProfile?.displayId || user?.displayId || cleanDisplayId,
  });

  const actionText = action === 'add' ? `إضافة +${amount.toLocaleString()}` : action === 'deduct' ? `خصم -${amount.toLocaleString()}` : `تعيين الرصيد إلى ${newBalance.toLocaleString()}`;

  return res.json({
    success: true,
    currency: 'diamonds',
    walletBalance: newBalance,
    coinsBalance: neonProfile ? parseDbNumber(neonProfile.coins_balance, 0) : (user?.coinsBalance ?? (isAdmin ? 100000 : 0)),
    userId: neonProfile?.id || cleanUserId,
    displayId: neonProfile?.displayId || user?.displayId || cleanDisplayId || cleanUserId,
    message: `تمت عملية ${actionText} للماسات 💎 بنجاح. الرصيد الفعلي الحالي: ${newBalance.toLocaleString()} 💎`,
  });
});

// ==========================================
// قسم إدارة الوكلاء (Agents Management)
// ==========================================

// 1. Endpoint عام لجلب الوكلاء المعتمدين النشطين (للمحفظة)
app.get('/api/agents', async (_req: Request, res: Response) => {
  try {
    const allAgents = await syncAgentsWithNeon();
    const activeAgents = allAgents.filter((a) => a.status !== 'suspended');
    return res.json({
      success: true,
      agents: activeAgents,
    });
  } catch (err) {
    const allAgents = getStoredAgents();
    const activeAgents = allAgents.filter((a) => a.status !== 'suspended');
    return res.json({
      success: true,
      agents: activeAgents,
    });
  }
});

// 2. Endpoint إداري لجلب كافة الوكلاء مع تفاصيلهم (محمية بـ ADMIN_PIN)
app.get('/api/admin/agents', verifyAdminAuth, async (_req: Request, res: Response) => {
  try {
    const agents = await syncAgentsWithNeon();
    return res.json({
      success: true,
      agents,
    });
  } catch (err) {
    const agents = getStoredAgents();
    return res.json({
      success: true,
      agents,
    });
  }
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

  const cleanGridCode = gridCode && String(gridCode).trim()
    ? String(gridCode).trim().toUpperCase()
    : generateGridCode();

  // Check if gridCode is already taken by another agent
  if (agents.some((a) => a.gridCode && a.gridCode.toUpperCase() === cleanGridCode)) {
    return res.status(400).json({
      success: false,
      message: `الرقم الفريد للوكيل [${cleanGridCode}] مسجل لوكيل آخر مسبقاً، يرجى اختيار رقم فريد آخر!`,
    });
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
    balance: typeof balance === 'number' ? Math.max(0, balance) : 50000,
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

  // Remove from deleted tombstones if was previously deleted
  unrecordDeletedAgent(newAgent.id, newAgent.email, newAgent.gridCode);

  agents.push(newAgent);
  saveStoredAgents(agents);

  // Persist to Neon PostgreSQL
  if (neonPool) {
    try {
      await saveAgentToNeon(newAgent);
      await neonPool.query(
        `DELETE FROM tombstones WHERE entity_type = 'agent' AND deleted_identifier IN ($1, $2, $3)`,
        [newAgent.id, newAgent.email, newAgent.gridCode]
      ).catch(() => {});
      console.log(`⚡ [Soul-X] New agent [${newAgent.name}] saved to Neon PostgreSQL [agents] table`);
    } catch (neonErr) {
      console.warn('Neon create agent error:', neonErr);
    }
  }

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

  if (neonPool && !matchedUser) {
    const profile = await getNeonProfileByIdentifier(cleanTarget);
    if (profile) {
      userEmail = profile.email || userEmail;
      userName = profile.name || userName;
    }
  }

  const agents = neonPool ? await syncAgentsWithNeon() : getStoredAgents();
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

  unrecordDeletedAgent(newAgent.id, newAgent.email, newAgent.gridCode);

  agents.push(newAgent);
  saveStoredAgents(agents);

  // Persist to Neon PostgreSQL
  if (neonPool) {
    try {
      await saveAgentToNeon(newAgent);
      await neonPool.query(
        `DELETE FROM tombstones WHERE entity_type = 'agent' AND deleted_identifier IN ($1, $2, $3)`,
        [newAgent.id, newAgent.email, newAgent.gridCode]
      ).catch(() => {});
      console.log(`⚡ [Soul-X] Appointed agent [${newAgent.name}] saved to Neon PostgreSQL [agents] table`);
    } catch (neonErr) {
      console.warn('Neon appoint agent error:', neonErr);
    }
  }

  return res.json({
    success: true,
    message: `تم تعيين المستخدم [${userName}] كوكيل شحن معتمد بنجاح برقم قريد [${cleanGrid}]!`,
    agent: newAgent,
  });
});

// 4. Endpoint إداري لتعديل بيانات الوكيل ودولته ورقم القريد (محمية بـ ADMIN_PIN)
app.post('/api/admin/update-agent', verifyAdminAuth, async (req: Request, res: Response) => {
  const { agentId, email, name, country, flag, category, whatsapp, telegram, methods, rateNote, status, gridCode } = req.body;
  if (!agentId) {
    return res.status(400).json({ success: false, message: 'معرف الوكيل مطلوب' });
  }

  const cleanTarget = String(agentId).trim();
  const agents = neonPool ? await syncAgentsWithNeon() : getStoredAgents();
  const agent = agents.find(
    (a) =>
      a.id === cleanTarget ||
      (a.gridCode && a.gridCode.toUpperCase() === cleanTarget.toUpperCase()) ||
      a.email.toLowerCase() === cleanTarget.toLowerCase()
  );
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

  if (neonPool) {
    await saveAgentToNeon(agent).catch((neonErr) => {
      console.warn('Neon update agent error:', neonErr);
    });
  }

  return res.json({
    success: true,
    message: 'تم تحديث بيانات الوكيل ورقم القريد بنجاح.',
    agent,
  });
});

// 5. Endpoint إداري لتعديل رصيد الوكيل (إضافة أو خصم أو تعيين) (محمية بـ ADMIN_PIN)
app.post('/api/admin/update-agent-balance', verifyAdminAuth, async (req: Request, res: Response) => {
  const { agentId, action, amount } = req.body; // action: 'add' | 'deduct' | 'set'
  if (!agentId || !action || typeof amount !== 'number') {
    return res.status(400).json({ success: false, message: 'معرف الوكيل ونوع الإجراء والقيمة مطلوبة' });
  }

  const cleanTarget = String(agentId).trim();
  const agents = neonPool ? await syncAgentsWithNeon() : getStoredAgents();
  const agent = agents.find(
    (a) =>
      a.id === cleanTarget ||
      (a.gridCode && a.gridCode.toUpperCase() === cleanTarget.toUpperCase()) ||
      a.email.toLowerCase() === cleanTarget.toLowerCase()
  );
  if (!agent) {
    return res.status(404).json({ success: false, message: 'الوكيل غير موجود' });
  }

  const currentBal = Math.round(((agent.balance || 0) + Number.EPSILON) * 100) / 100;
  let newBal = currentBal;

  if (action === 'add') {
    newBal = Math.round((currentBal + Math.abs(amount) + Number.EPSILON) * 100) / 100;
  } else if (action === 'deduct') {
    newBal = Math.max(0, Math.round((currentBal - Math.abs(amount) + Number.EPSILON) * 100) / 100);
  } else if (action === 'set') {
    newBal = Math.max(0, Math.round((amount + Number.EPSILON) * 100) / 100);
  }

  agent.balance = newBal;
  agent.updatedAt = new Date().toISOString();
  saveStoredAgents(agents);

  if (neonPool) {
    await updateAgentBalanceInNeon(agent, newBal).catch((neonErr) => {
      console.warn('Neon update agent balance error:', neonErr);
    });
  }

  const actionText = action === 'add' ? `إضافة +${amount}` : action === 'deduct' ? `خصم -${amount}` : `تعيين الرصيد إلى ${newBal}`;

  return res.json({
    success: true,
    balance: newBal,
    message: `تم ${actionText} لرصيد الوكيل (${agent.name}) بنجاح. الرصيد الحالي: ${newBal.toLocaleString()}`,
    agent,
  });
});

// 6. Endpoint إداري لحذف وكيل (محمية بـ ADMIN_PIN)
// يضمن الحذف الفعلي والدائم من قاعدة البيانات وملف التومبستون لعدم استرجاعه بعد إعادة النشر
app.post('/api/admin/delete-agent', verifyAdminAuth, async (req: Request, res: Response) => {
  const { agentId, email: reqEmail, gridCode: reqGridCode } = req.body;
  if (!agentId && !reqEmail && !reqGridCode) {
    return res.status(400).json({ success: false, message: 'معرف الوكيل مطلوب' });
  }

  const cleanTarget = String(agentId || reqEmail || reqGridCode).trim();
  const agents = getStoredAgents();
  const matchedAgent = agents.find(
    (a) =>
      (agentId && a.id === cleanTarget) ||
      (reqEmail && a.email.toLowerCase() === String(reqEmail).trim().toLowerCase()) ||
      (reqGridCode && a.gridCode && a.gridCode.toUpperCase() === String(reqGridCode).trim().toUpperCase()) ||
      a.id === cleanTarget ||
      a.email.toLowerCase() === cleanTarget.toLowerCase() ||
      (a.gridCode && a.gridCode.toUpperCase() === cleanTarget.toUpperCase())
  );

  const emailToDelete = (reqEmail || matchedAgent?.email || (cleanTarget.includes('@') ? cleanTarget : '')).toLowerCase().trim();
  const gridToDelete = (reqGridCode || matchedAgent?.gridCode || '').toUpperCase().trim();
  const idToDelete = matchedAgent?.id || cleanTarget;

  const filtered = agents.filter(
    (a) =>
      a.id !== cleanTarget &&
      a.id !== idToDelete &&
      (!emailToDelete || a.email.toLowerCase() !== emailToDelete) &&
      (!gridToDelete || !a.gridCode || a.gridCode.toUpperCase() !== gridToDelete)
  );

  // 1. Record in local tombstone file immediately (with ALL identifier variants)
  recordDeletedAgent(
    cleanTarget,
    emailToDelete,
    gridToDelete,
    idToDelete ? [idToDelete] : []
  );

  // 2. Save filtered agents to disk
  saveStoredAgents(filtered);

  // 3. Delete from Neon PostgreSQL Database and record in persistent tombstones table
  if (neonPool) {
    try {
      await withTimeout(
        neonPool.query(
          `DELETE FROM agents 
           WHERE id = $1 
              OR LOWER(email) = LOWER($2) 
              OR UPPER(grid_code) = UPPER($3)
              OR id = $4
              OR LOWER(email) = LOWER($5)`,
          [idToDelete, emailToDelete || 'N/A', gridToDelete || 'N/A', cleanTarget, cleanTarget]
        ),
        5000
      ).catch(() => {});

      // Record tombstone in Neon tombstones table
      const idents = Array.from(new Set([cleanTarget, idToDelete, emailToDelete, gridToDelete].filter(Boolean)));
      for (const ident of idents) {
        await withTimeout(
          neonPool.query(
            `INSERT INTO tombstones (id, entity_type, deleted_identifier, deleted_at)
             VALUES ($1, 'agent', $2, NOW())`,
            [crypto.randomUUID(), ident]
          ),
          3000
        ).catch(() => {});
      }

      console.log(`⚡ [Soul-X] Agent [${cleanTarget}] deleted permanently from Neon PostgreSQL & tombstones recorded.`);
    } catch (neonErr) {
      console.warn('Neon delete agent error:', neonErr);
    }
  }

  return res.json({
    success: true,
    message: 'تم حذف الوكيل نهائياً وتحديث قائمة الوكلاء المعتمدين في قاعدة البيانات بنجاح، ولن يعود عند إعادة النشر.',
    deletedAgentId: cleanTarget,
    remainingCount: filtered.length,
  });
});

// ==========================================
// بوابة وكالتي للشحن (My Recharge Agency Portal Endpoints)
// ==========================================

// 7.1 التحقق من كون المستخدم وكيلاً معتمداً وجلب بيانات وكالته مع بيانات حسابه الشخصي المنفصل
app.get('/api/agent/my-agency', async (req: Request, res: Response) => {
  try {
    const email = ((req.query.email as string) || '').trim().toLowerCase();
    const userId = ((req.query.userId as string) || '').trim();
    const displayId = ((req.query.displayId as string) || '').trim();

    if (!email && !userId && !displayId) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم أو بريده مطلوب' });
    }

    const agents = neonPool ? await syncAgentsWithNeon() : getStoredAgents();
    const agent = agents.find((a) => {
      if (email && a.email.toLowerCase() === email) return true;
      if (userId && (a.id === userId || a.id === `agent-${userId}`)) return true;
      if (displayId && a.id === displayId) return true;
      return false;
    });

    if (!agent || agent.status === 'suspended') {
      return res.json({
        success: true,
        isAgent: false,
      });
    }

    // جلب بيانات الحساب الشخصي للوكيل بشكل منفصل تماماً
    let personalUser: any = null;
    if (neonPool) {
      const profile = await getNeonProfileByIdentifier(userId || displayId || email);
      if (profile) {
        personalUser = {
          id: profile.id,
          displayId: profile.display_id || profile.id,
          name: profile.name,
          email: profile.email,
          walletBalance: parseDbNumber(profile.wallet_balance, 0),
          coinsBalance: parseDbNumber(profile.coins_balance, 0),
        };
      }
    }

    if (!personalUser) {
      const users = getStoredUsers();
      const u = users.find(
        (x) =>
          (userId && (x.id === userId || x.displayId === userId)) ||
          (displayId && (x.displayId === displayId || x.id === displayId)) ||
          (email && x.email.toLowerCase() === email)
      );
      if (u) {
        personalUser = {
          id: u.id,
          displayId: u.displayId || u.id,
          name: u.name,
          email: u.email,
          walletBalance: typeof u.walletBalance === 'number' ? u.walletBalance : 0,
          coinsBalance: typeof u.coinsBalance === 'number' ? u.coinsBalance : 0,
        };
      }
    }

    return res.json({
      success: true,
      isAgent: true,
      agent,
      personalAccount: personalUser,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'خطأ في جلب بيانات الوكالة' });
  }
});

// 7.2 التحقق من بيانات مستخدم من خلال ID الحساب قبل الشحن
app.post('/api/agent/lookup-user', async (req: Request, res: Response) => {
  const userIdentifier =
    req.body.userIdentifier || req.body.accountId || req.body.identifier || req.body.userId;
  if (!userIdentifier || !String(userIdentifier).trim()) {
    return res.status(400).json({ success: false, message: 'معرف الحساب مطلوب' });
  }

  const cleanId = String(userIdentifier).trim();

  if (neonPool) {
    const profile = await getNeonProfileByIdentifier(cleanId);
    if (profile) {
      return res.json({
        success: true,
        user: {
          id: profile.id,
          displayId: profile.display_id || profile.id,
          name: profile.name || 'مستخدم Soul-X',
          photoUrl: profile.avatar_url || null,
          walletBalance: parseDbNumber(profile.wallet_balance, 0),
          coinsBalance: parseDbNumber(profile.coins_balance, 0),
          gender: profile.gender || null,
          isVerified: Boolean(profile.isVerified),
        },
      });
    }
  }

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
        walletBalance: typeof user.walletBalance === 'number' ? user.walletBalance : 0,
        coinsBalance: typeof user.coinsBalance === 'number' ? user.coinsBalance : 0,
        gender: user.gender || null,
        isVerified: Boolean(user.isVerified),
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
  const agents = neonPool ? await syncAgentsWithNeon() : getStoredAgents();
  const agent = agents.find(
    (a) =>
      (agentId && (a.id === String(agentId) || (a.gridCode && a.gridCode.toUpperCase() === String(agentId).toUpperCase()))) ||
      (agentEmail && a.email.toLowerCase() === String(agentEmail).trim().toLowerCase())
  );

  if (!agent) {
    return res.status(404).json({ success: false, message: 'بيانات وكالة الشحن غير موجودة!' });
  }

  if (agent.status === 'suspended') {
    return res.status(403).json({ success: false, message: 'وكالة الشحن معطلة مؤقتاً. يرجى التواصل مع الإدارة.' });
  }

  const currentAgencyBalance = Math.round(((agent.balance || 0) + Number.EPSILON) * 100) / 100;
  if (currentAgencyBalance < rechargeAmount) {
    return res.status(400).json({
      success: false,
      message: `رصيد الوكالة غير كافٍ لإتمام العملية! الرصيد المتوفر: ${currentAgencyBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })} 🪙، المطلوب: ${rechargeAmount.toLocaleString()} 🪙`,
    });
  }

  const cleanTarget = String(targetUserIdentifier).trim();
  let targetUserObj: any = null;

  if (neonPool) {
    const profile = await getNeonProfileByIdentifier(cleanTarget);
    if (profile) {
      targetUserObj = {
        id: profile.id,
        displayId: profile.display_id || profile.id,
        email: profile.email,
        name: profile.name || 'مستخدم Soul-X',
        walletBalance: parseDbNumber(profile.wallet_balance, 0),
        coinsBalance: parseDbNumber(profile.coins_balance, 0),
      };
    }
  }

  const users = getStoredUsers();
  const localUser = users.find(
    (u) =>
      u.id === cleanTarget ||
      u.displayId === cleanTarget ||
      u.email.toLowerCase() === cleanTarget.toLowerCase() ||
      (targetUserObj && u.id === targetUserObj.id)
  );

  if (!targetUserObj && localUser) {
    targetUserObj = {
      id: localUser.id,
      displayId: localUser.displayId || localUser.id,
      email: localUser.email,
      name: localUser.name,
      walletBalance: typeof localUser.walletBalance === 'number' ? localUser.walletBalance : 0,
      coinsBalance: typeof localUser.coinsBalance === 'number' ? localUser.coinsBalance : 0,
    };
  }

  if (!targetUserObj) {
    return res.status(404).json({
      success: false,
      message: `لم يتم العثور على حساب المستخدم [${cleanTarget}]! يرجى التأكد من صحة الـ ID.`,
    });
  }

  // Deduct coins from agent balance (with 2 decimal places max)
  const nowIso = new Date().toISOString();
  const newAgencyBalance = Math.round((currentAgencyBalance - rechargeAmount + Number.EPSILON) * 100) / 100;
  agent.balance = newAgencyBalance;
  agent.completedOrders = (agent.completedOrders || 0) + 1;
  agent.updatedAt = nowIso;
  saveStoredAgents(agents);

  // Credit target user COINS balance only (رصيد كوينز فقط)
  const previousCoins = typeof targetUserObj.coinsBalance === 'number' ? targetUserObj.coinsBalance : 0;
  const newCoins = Math.max(0, Math.round(previousCoins + rechargeAmount));

  if (localUser) {
    localUser.coinsBalance = newCoins;
    localUser.walletBalance = targetUserObj.walletBalance;
    localUser.updatedAt = nowIso;
  } else {
    users.push({
      id: targetUserObj.id,
      displayId: targetUserObj.displayId,
      name: targetUserObj.name,
      email: targetUserObj.email || `${targetUserObj.id}@soul-x.com`,
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      createdAt: nowIso,
      updatedAt: nowIso,
      walletBalance: targetUserObj.walletBalance || 0,
      coinsBalance: newCoins,
    });
  }
  saveStoredUsers(users);

  if (neonPool) {
    await updateNeonProfileByIdentifier(targetUserObj.id, {
      coinsBalance: newCoins,
    });
    await updateAgentBalanceInNeon(agent, newAgencyBalance, agent.completedOrders);
  }

  broadcastChatMessage([targetUserObj.id, targetUserObj.displayId], {
    type: 'balance_update',
    currency: 'coins',
    balance: newCoins,
    userId: targetUserObj.id,
    displayId: targetUserObj.displayId,
  });

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
    amount: rechargeAmount, // coins
    timestamp: nowIso,
    previousBalance: previousCoins,
    newBalance: newCoins,
  };
  transactions.unshift(txRecord);
  saveStoredAgencyTransactions(transactions);

  if (neonPool) {
    await saveAgencyTransactionToNeon(txRecord).catch(() => {});
  }

  // إرسال إشعار رسمي لمركز إشعارات المستخدم بشحن رصيد حسابه بواسطة الوكيل
  try {
    createAndSaveUserNotification({
      userId: targetUserObj.id,
      userDisplayId: targetUserObj.displayId,
      type: 'agency_recharge',
      titleAr: 'نجاح إيداع 🪙',
      titleEn: 'Deposit Successful 🪙',
      messageAr: `تمت إعادة تعبئة حسابك بقيمة: ${rechargeAmount.toLocaleString()} Coins عبر الوكيل.`,
      messageEn: `Your account has been recharged with ${rechargeAmount.toLocaleString()} Coins via agent.`,
      metadata: {
        agentId: agent.id,
        agentGridCode: agent.gridCode || 'A8838',
        agentName: agent.nameAr || agent.name,
        amount: rechargeAmount,
        currency: 'coins',
        txId,
        previousBalance: previousCoins,
        newBalance: newCoins,
      },
    });
  } catch (notifErr) {
    console.warn('Error saving agency recharge user notification:', notifErr);
  }

  recordGeneralSiteLog({
    refId: `tx:${txId}`,
    category: 'agency',
    actorRole: 'AGENT',
    userId: agent.id,
    displayId: agent.gridCode,
    email: agent.email,
    userName: agent.nameAr || agent.name,
    targetUserId: targetUserObj.id,
    targetDisplayId: targetUserObj.displayId,
    targetEmail: targetUserObj.email,
    targetName: targetUserObj.name,
    action: 'agency_recharge_user',
    actionLabelAr: 'شحن كوينز عبر وكيل',
    details: `شحن ${rechargeAmount.toLocaleString()} كوينز للمستخدم ${targetUserObj.name} (${targetUserObj.displayId})`,
    amount: rechargeAmount,
    currency: 'coins',
    ip: getClientIp(req),
    status: 'completed',
  });

  return res.json({
    success: true,
    message: `تم شحن رصيد ${rechargeAmount.toLocaleString()} كوينز 🪙 بنجاح للمستخدم ${targetUserObj.name} (${targetUserObj.displayId})`,
    newAgentBalance: newAgencyBalance,
    transaction: txRecord,
    targetUser: {
      id: targetUserObj.id,
      displayId: targetUserObj.displayId,
      name: targetUserObj.name,
      previousCoinsBalance: previousCoins,
      coinsBalance: newCoins,
    },
  });
});

// 7.4 جلب قائمة طلبات السحب الخاصة بالوكالة
app.get('/api/agent/withdraw-requests', async (req: Request, res: Response) => {
  const agentId = ((req.query.agentId as string) || '').trim();
  const gridCode = ((req.query.gridCode as string) || '').trim();

  const allRequests = neonPool ? await syncAgencyWithdrawalsWithNeon() : getStoredAgencyWithdrawals();
  const requests = allRequests.filter(
    (r) =>
      (!agentId && !gridCode) ||
      (agentId && r.agentId === agentId) ||
      (gridCode && r.gridCode.toUpperCase() === gridCode.toUpperCase())
  );

  return res.json({
    success: true,
    requests,
  });
});

// 7.5 تقديم طلب سحب رصيد جديد للوكالة
app.post('/api/agent/withdraw-requests', async (req: Request, res: Response) => {
  const { agentId, amount, notes } = req.body;
  const method = req.body.method || req.body.payoutMethod || req.body.paymentMethod;
  const accountDetails = req.body.accountDetails || req.body.accountInfo || req.body.details;

  if (!agentId || !amount || typeof amount !== 'number' || amount <= 0 || !method || !accountDetails) {
    return res.status(400).json({
      success: false,
      message: 'بيانات طلب السحب غير مكتملة (المبلغ، طريقة السحب، وتفاصيل الحساب مطلوبة)',
    });
  }

  const withdrawAmount = Math.round((Math.abs(amount) + Number.EPSILON) * 100) / 100;
  const agents = neonPool ? await syncAgentsWithNeon() : getStoredAgents();
  const agent = agents.find(
    (a) =>
      a.id === String(agentId) ||
      (a.gridCode && a.gridCode.toUpperCase() === String(agentId).toUpperCase())
  );

  if (!agent) {
    return res.status(404).json({ success: false, message: 'وكالة الشحن غير موجودة' });
  }

  const currentBalance = Math.round(((agent.balance || 0) + Number.EPSILON) * 100) / 100;
  if (currentBalance < withdrawAmount) {
    return res.status(400).json({
      success: false,
      message: `رصيد الوكالة الحالي (${currentBalance.toLocaleString()} 💎) أقل من مبلغ السحب المطلوب (${withdrawAmount.toLocaleString()} 💎)`,
    });
  }

  // Deduct/reserve balance for withdrawal
  const nowIso = new Date().toISOString();
  agent.balance = Math.max(0, Math.round((currentBalance - withdrawAmount + Number.EPSILON) * 100) / 100);
  agent.updatedAt = nowIso;
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
    type: 'agency_cashout',
    createdAt: nowIso,
  };

  const withdrawals = getStoredAgencyWithdrawals();
  withdrawals.unshift(newRequest);
  saveStoredAgencyWithdrawals(withdrawals);

  if (neonPool) {
    await Promise.all([
      updateAgentBalanceInNeon(agent, agent.balance),
      saveAgencyWithdrawalToNeon(newRequest),
    ]).catch((err) => console.warn('Neon agency withdrawal error:', err));
  }

  recordGeneralSiteLog({
    refId: `wdr:${newRequest.id}`,
    category: 'agency',
    actorRole: 'AGENT',
    userId: agent.id,
    displayId: agent.gridCode,
    email: agent.email,
    userName: agent.nameAr || agent.name,
    action: 'agency_cashout_request',
    actionLabelAr: 'طلب سحب رصيد وكالة',
    details: `المبلغ: ${withdrawAmount.toLocaleString()} | الطريقة: ${method}`,
    amount: withdrawAmount,
    currency: 'diamonds',
    ip: getClientIp(req),
    status: 'pending',
  });

  return res.json({
    success: true,
    message: `تم تقديم طلب سحب بقيمة ${withdrawAmount.toLocaleString()} 💎 بنجاح، وهو قيد المراجعة لدى إدارة المنصة.`,
    request: newRequest,
    newAgentBalance: agent.balance,
  });
});

// 7.6 جلب سجل عمليات الشحن المنفذة للوكالة
app.get('/api/agent/transactions', async (req: Request, res: Response) => {
  const agentId = ((req.query.agentId as string) || '').trim();
  const gridCode = ((req.query.gridCode as string) || '').trim();

  const allTx = neonPool ? await syncAgencyTransactionsWithNeon() : getStoredAgencyTransactions();
  const transactions = allTx.filter(
    (t) =>
      (!agentId && !gridCode) ||
      (agentId && t.agentId === agentId) ||
      (gridCode && t.gridCode.toUpperCase() === gridCode.toUpperCase())
  );

  return res.json({
    success: true,
    transactions,
  });
});

// 7.7 جلب إشعارات الوكالة (سحوبات المستخدمين فقط مع إمكانية الفلترة والبحث)
app.get('/api/agent/notifications', async (req: Request, res: Response) => {
  const agentId = ((req.query.agentId as string) || '').trim();
  const gridCode = ((req.query.gridCode as string) || '').trim().toUpperCase();

  const all = getStoredAgencyNotifications();
  const matched = all.filter((n) => {
    // الوكيل يستلم إشعار فقط في سحوبات المستخدمين
    const isUserWithdrawal = n.type === 'incoming_user_withdrawal' || n.type === 'user_withdrawal';
    if (!isUserWithdrawal) return false;

    if (!agentId && !gridCode) return true;
    if (agentId && (n.agentId === agentId || n.agentId.toLowerCase() === agentId.toLowerCase())) return true;
    if (gridCode && (n.gridCode && n.gridCode.toUpperCase() === gridCode)) return true;
    return false;
  });

  const unreadCount = matched.filter((n) => !n.read).length;

  return res.json({
    success: true,
    notifications: matched,
    unreadCount,
  });
});

// 7.8 تعليم إشعارات الوكالة كمقروءة
app.post('/api/agent/notifications/mark-read', async (req: Request, res: Response) => {
  const { agentId, gridCode, notificationId } = req.body;
  const all = getStoredAgencyNotifications();
  let changed = false;

  all.forEach((n) => {
    const isTargetAgent =
      (!agentId && !gridCode) ||
      (agentId && (n.agentId === agentId || n.agentId.toLowerCase() === String(agentId).toLowerCase())) ||
      (gridCode && n.gridCode.toUpperCase() === String(gridCode).toUpperCase());

    if (isTargetAgent) {
      if (!notificationId || n.id === notificationId) {
        if (!n.read) {
          n.read = true;
          changed = true;
        }
      }
    }
  });

  if (changed) {
    saveStoredAgencyNotifications(all);
  }

  return res.json({ success: true, message: 'تم تحديث حالة الإشعارات بنجاح' });
});

// 7.9 جلب إشعارات مركز إشعارات المستخدم (فقط قبول طلب الصداقة وشحن الحساب بواسطة الوكيل)
app.get('/api/user/notifications', async (req: Request, res: Response) => {
  const userId = ((req.query.userId as string) || '').trim();
  const displayId = ((req.query.displayId as string) || '').trim();
  const email = ((req.query.email as string) || '').trim();

  if (!userId && !displayId && !email) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const identSet = await getUserIdentifierSet(userId, email, displayId);
  const all = getStoredUserNotifications();

  // تصفية إشعارات المستخدم المستهدف والتأكد الصارم من الأنواع المطلوبة فقط
  const matched = all.filter((n) => {
    // تصل إشعارات قبول طلب الصداقة، شحن الحساب، السحب، وإذاعات ورسائل الإدارة
    const isAllowedType =
      n.type === 'friend_request_accepted' ||
      n.type === 'agency_recharge' ||
      n.type === 'withdrawal_request' ||
      n.type === 'admin_broadcast' ||
      n.type === 'admin_message';
    if (!isAllowedType) return false;

    const isMatch =
      identSet.has(n.userId) ||
      (n.userDisplayId && identSet.has(n.userDisplayId)) ||
      (userId && n.userId.toLowerCase() === userId.toLowerCase()) ||
      (displayId && n.userDisplayId && n.userDisplayId.toLowerCase() === displayId.toLowerCase());

    return isMatch;
  });

  const unreadCount = matched.filter((n) => !n.read).length;

  return res.json({
    success: true,
    notifications: matched,
    unreadCount,
  });
});

// 7.10 تعليم إشعارات مركز الإشعارات كمقروءة للمستخدم
app.post('/api/user/notifications/mark-read', async (req: Request, res: Response) => {
  const { userId, displayId, email, notificationId } = req.body;
  if (!userId && !displayId && !email) {
    return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
  }

  const identSet = await getUserIdentifierSet(userId, email, displayId);
  const all = getStoredUserNotifications();
  let changed = false;

  all.forEach((n) => {
    const isAllowedType =
      n.type === 'friend_request_accepted' ||
      n.type === 'agency_recharge' ||
      n.type === 'withdrawal_request' ||
      n.type === 'admin_broadcast' ||
      n.type === 'admin_message';
    if (!isAllowedType) return;

    const isMatch =
      identSet.has(n.userId) ||
      (n.userDisplayId && identSet.has(n.userDisplayId)) ||
      (userId && n.userId.toLowerCase() === userId.toLowerCase()) ||
      (displayId && n.userDisplayId && n.userDisplayId.toLowerCase() === displayId.toLowerCase());

    if (isMatch) {
      if (!notificationId || n.id === notificationId) {
        if (!n.read) {
          n.read = true;
          changed = true;
        }
      }
    }
  });

  if (changed) {
    saveStoredUserNotifications(all);
  }

  return res.json({ success: true, message: 'تم تحديث حالة الإشعارات كمقروءة' });
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
    saveStoredFeedbackReports([]);
    saveStoredPasswordResetRequests([]);
    try {
      if (fs.existsSync(MEDIA_DIR)) {
        for (const f of fs.readdirSync(MEDIA_DIR)) {
          fs.unlinkSync(path.resolve(MEDIA_DIR, f));
        }
      }
    } catch {}
    result.localCleared = true;
    console.log('🧹 [Soul-X Purge] Local JSON caches purged completely.');
  } catch (err: any) {
    result.errors.push(`Local JSON error: ${err.message}`);
  }

  // 2. Wipe Neon PostgreSQL tables if connected
  if (neonPool) {
    try {
      console.log('🧹 [Soul-X Purge] Purging connected Neon PostgreSQL database tables...');
      await withTimeout(
        neonPool.query(
          'TRUNCATE TABLE messages, conversation_participants, conversations, friend_requests, friends, profiles, feedback_reports, password_reset_requests RESTART IDENTITY CASCADE'
        ),
        8000
      );
      result.supabaseTablesPurged.push('neon_all_tables');
      console.log('✅ [Soul-X Purge] Neon PostgreSQL tables successfully wiped clean.');
    } catch (dbErr: any) {
      console.warn('Neon purge warning:', dbErr);
      result.errors.push(`Neon purge error: ${dbErr?.message || dbErr}`);
    }
  }

  result.message = 'تم مسح وتصفير كافة البيانات وقاعدة بيانات Neon PostgreSQL بنجاح، وتهيئة الربط الفعلي النظيف.';
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

// ==========================================
// 8. Admin Broadcast & Notification Endpoints (إذاعة عامة ورسائل إدارية مخصصة)
// ==========================================
app.post('/api/admin/notifications/send', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const {
      targetType, // 'all' (إذاعة عامة) or 'single' (رسالة خاصة لمستخدم معين)
      userId,     // target user ID / displayId / email when targetType === 'single'
      titleAr,
      titleEn,
      messageAr,
      messageEn,
      category = 'announcement', // 'announcement' | 'warning' | 'alert' | 'system' | 'custom' | 'reward'
      priority = 'normal',      // 'normal' | 'important' | 'urgent'
    } = req.body;

    if (!titleAr || !String(titleAr).trim()) {
      return res.status(400).json({ success: false, message: 'عنوان الإشعار باللغة العربية مطلوب' });
    }
    if (!messageAr || !String(messageAr).trim()) {
      return res.status(400).json({ success: false, message: 'نص الإشعار باللغة العربية مطلوب' });
    }

    const cleanTitleAr = String(titleAr).trim();
    const cleanTitleEn = (titleEn && String(titleEn).trim()) || cleanTitleAr;
    const cleanMessageAr = String(messageAr).trim();
    const cleanMessageEn = (messageEn && String(messageEn).trim()) || cleanMessageAr;
    const cleanPriority = priority === 'urgent' || priority === 'important' ? priority : 'normal';
    const cleanCategory = ['announcement', 'warning', 'alert', 'system', 'reward', 'custom'].includes(category)
      ? category
      : 'announcement';

    const timestamp = new Date().toISOString();

    if (targetType === 'single') {
      // إرسال رسالة إدارية لمستخدم معين
      if (!userId || !String(userId).trim()) {
        return res.status(400).json({ success: false, message: 'يرجى تحديد المستخدم المستهدف' });
      }

      const targetQuery = String(userId).trim().toLowerCase();
      const allUsers = getStoredUsers();
      const targetUser = allUsers.find(
        (u) =>
          u.id.toLowerCase() === targetQuery ||
          (u.displayId && u.displayId.toLowerCase() === targetQuery) ||
          (u.email && u.email.toLowerCase() === targetQuery)
      );

      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'لم يتم العثور على المستخدم المستهدف' });
      }

      const notifId = `unotif-admin-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const newNotif: StoredUserNotification = {
        id: notifId,
        userId: targetUser.id,
        userDisplayId: targetUser.displayId,
        type: 'admin_message',
        titleAr: cleanTitleAr,
        titleEn: cleanTitleEn,
        messageAr: cleanMessageAr,
        messageEn: cleanMessageEn,
        timestamp,
        read: false,
        metadata: {
          isAdminMessage: true,
          isBroadcast: false,
          category: cleanCategory,
          priority: cleanPriority,
          senderName: 'إدارة Soul-X',
          recipientName: targetUser.name,
          recipientDisplayId: targetUser.displayId,
          recipientEmail: targetUser.email,
        },
      };

      const existingNotifs = getStoredUserNotifications();
      existingNotifs.unshift(newNotif);
      saveStoredUserNotifications(existingNotifs);

      // Real-time broadcast to this user's active SSE connections
      try {
        const targetKeys = [targetUser.id, targetUser.displayId, targetUser.email].filter(Boolean) as string[];
        broadcastChatMessage(targetKeys, {
          type: 'user_notification',
          notification: newNotif,
        });
      } catch (bcErr) {
        console.warn('Failed to broadcast targeted notification:', bcErr);
      }

      return res.json({
        success: true,
        message: `تم إرسال الرسالة الإدارية بنجاح إلى المستخدم ${targetUser.name} (${targetUser.displayId || targetUser.email})`,
        notification: newNotif,
      });
    } else {
      // إذاعة عامة تصل إلى كافة المستخدمين المسجلين
      const allUsers = getStoredUsers();
      if (allUsers.length === 0) {
        return res.status(400).json({ success: false, message: 'لا يوجد مستخدمون مسجلون في النظام حالياً' });
      }

      const broadcastBatchId = `bcast-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const newNotifs: StoredUserNotification[] = allUsers.map((u, idx) => ({
        id: `unotif-bcast-${Date.now()}-${idx}-${Math.floor(1000 + Math.random() * 9000)}`,
        userId: u.id,
        userDisplayId: u.displayId,
        type: 'admin_broadcast',
        titleAr: cleanTitleAr,
        titleEn: cleanTitleEn,
        messageAr: cleanMessageAr,
        messageEn: cleanMessageEn,
        timestamp,
        read: false,
        metadata: {
          isAdminMessage: true,
          isBroadcast: true,
          broadcastId: broadcastBatchId,
          category: cleanCategory,
          priority: cleanPriority,
          senderName: 'إدارة Soul-X',
          recipientName: u.name,
          recipientDisplayId: u.displayId,
        },
      }));

      const existingNotifs = getStoredUserNotifications();
      const updated = [...newNotifs, ...existingNotifs];
      saveStoredUserNotifications(updated);

      // Real-time broadcast to all connected clients
      try {
        broadcastToAllClients({
          type: 'user_notification',
          notification: newNotifs[0],
        });
      } catch (bcErr) {
        console.warn('Failed to broadcast to all clients:', bcErr);
      }

      return res.json({
        success: true,
        message: `تم إرسال الإذاعة العامة بنجاح إلى جميع المستخدمين (${allUsers.length} مستخدم)`,
        recipientCount: allUsers.length,
        broadcastId: broadcastBatchId,
      });
    }
  } catch (err: any) {
    console.error('Error sending admin notification:', err);
    return res.status(500).json({ success: false, message: err?.message || 'حدث خطأ أثناء إرسال الإشعار' });
  }
});

// Endpoint: جلب سجل الإذاعات والرسائل الإدارية المرسلة
app.get('/api/admin/notifications/history', verifyAdminAuth, async (_req: Request, res: Response) => {
  try {
    const all = getStoredUserNotifications();
    const adminNotifs = all.filter((n) => n.type === 'admin_broadcast' || n.type === 'admin_message');

    // Aggregate broadcasts by broadcastId or (timestamp + titleAr)
    const historyMap = new Map<string, any>();
    const singleMessages: any[] = [];

    for (const notif of adminNotifs) {
      if (notif.type === 'admin_broadcast') {
        const key = notif.metadata?.broadcastId || `${notif.timestamp}_${notif.titleAr}`;
        if (!historyMap.has(key)) {
          historyMap.set(key, {
            id: notif.id,
            broadcastId: notif.metadata?.broadcastId || key,
            type: 'admin_broadcast',
            titleAr: notif.titleAr,
            titleEn: notif.titleEn,
            messageAr: notif.messageAr,
            messageEn: notif.messageEn,
            timestamp: notif.timestamp,
            category: notif.metadata?.category || 'announcement',
            priority: notif.metadata?.priority || 'normal',
            totalRecipients: 0,
            readCount: 0,
          });
        }
        const item = historyMap.get(key);
        item.totalRecipients += 1;
        if (notif.read) item.readCount += 1;
      } else {
        singleMessages.push({
          id: notif.id,
          type: 'admin_message',
          titleAr: notif.titleAr,
          titleEn: notif.titleEn,
          messageAr: notif.messageAr,
          messageEn: notif.messageEn,
          timestamp: notif.timestamp,
          read: notif.read,
          category: notif.metadata?.category || 'custom',
          priority: notif.metadata?.priority || 'normal',
          recipientName: notif.metadata?.recipientName,
          recipientDisplayId: notif.metadata?.recipientDisplayId || notif.userDisplayId,
          recipientEmail: notif.metadata?.recipientEmail,
          userId: notif.userId,
        });
      }
    }

    const broadcasts = Array.from(historyMap.values());
    const combined = [...broadcasts, ...singleMessages].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return res.json({
      success: true,
      history: combined,
    });
  } catch (err: any) {
    console.error('Error fetching admin notifications history:', err);
    return res.status(500).json({ success: false, message: err?.message || 'حدث خطأ أثناء جلب السجل' });
  }
});

// Endpoint: حذف إشعار أو إذاعة عامة
app.post('/api/admin/notifications/delete', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id, broadcastId } = req.body;
    if (!id && !broadcastId) {
      return res.status(400).json({ success: false, message: 'معرف الإشعار أو الإذاعة مطلوب' });
    }

    const all = getStoredUserNotifications();
    let remaining: StoredUserNotification[];

    if (broadcastId) {
      remaining = all.filter((n) => n.metadata?.broadcastId !== broadcastId);
    } else {
      remaining = all.filter((n) => n.id !== id);
    }

    saveStoredUserNotifications(remaining);
    return res.json({
      success: true,
      message: 'تم حذف الإشعار من مركز الإشعارات بنجاح',
      deletedCount: all.length - remaining.length,
    });
  } catch (err: any) {
    console.error('Error deleting admin notification:', err);
    return res.status(500).json({ success: false, message: err?.message || 'حدث خطأ أثناء حذف الإشعار' });
  }
});

// ==========================================
// 9. Feedback & Bug Reporting Endpoints (الإبلاغ عن خطأ أو تقديم اقتراح)
// ==========================================
// 9.1 تقديم بلاغ عن خطأ أو اقتراح (User Submission)
app.post('/api/feedback/submit', async (req: Request, res: Response) => {
  try {
    const {
      type = 'bug',
      title,
      description,
      priority = 'medium',
      deviceInfo,
      userId,
      userDisplayId,
      userName,
      userEmail,
      userAvatar,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: 'يرجى كتابة عنوان البلاغ أو الاقتراح' });
    }
    if (!description || !String(description).trim()) {
      return res.status(400).json({ success: false, message: 'يرجى كتابة تفاصيل المشكلة أو الاقتراح' });
    }

    // Resolve sending user reliably from body or Authorization Bearer session
    let resolvedUserId = userId ? String(userId).trim() : undefined;
    let resolvedDisplayId = userDisplayId ? String(userDisplayId).trim() : undefined;
    let resolvedName = userName ? String(userName).trim() : undefined;
    let resolvedEmail = userEmail ? String(userEmail).trim() : undefined;
    let resolvedAvatar = userAvatar ? String(userAvatar).trim() : undefined;

    const authHeader = String(req.headers['authorization'] || '').trim();
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (bearer) {
      const session = getStoredSessions().find((s) => s.token === bearer || s.refreshToken === bearer);
      if (session) {
        resolvedUserId = resolvedUserId || session.userId;
        resolvedEmail = resolvedEmail || session.email;
      }
    }

    if (resolvedUserId || resolvedDisplayId || resolvedEmail) {
      const matchedUser = getStoredUsers().find(
        (u) =>
          (resolvedUserId && u.id === resolvedUserId) ||
          (resolvedDisplayId && u.displayId === resolvedDisplayId) ||
          (resolvedEmail && u.email && u.email.toLowerCase() === resolvedEmail.toLowerCase())
      );
      if (matchedUser) {
        resolvedUserId = resolvedUserId || matchedUser.id;
        resolvedDisplayId = resolvedDisplayId || matchedUser.displayId;
        resolvedName = resolvedName || matchedUser.name;
        resolvedEmail = resolvedEmail || matchedUser.email;
        resolvedAvatar = resolvedAvatar || matchedUser.photoUrl;
      }
    }

    const cleanType: 'bug' | 'suggestion' | 'feedback' = ['bug', 'suggestion', 'feedback'].includes(type)
      ? type
      : 'bug';

    const cleanPriority: 'low' | 'medium' | 'high' | 'urgent' = ['low', 'medium', 'high', 'urgent'].includes(priority)
      ? priority
      : 'medium';

    const reportId = `fbr-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newReport: StoredFeedbackReport = {
      id: reportId,
      userId: resolvedUserId,
      userDisplayId: resolvedDisplayId,
      userName: resolvedName || 'مستخدم Soul-X',
      userEmail: resolvedEmail,
      userAvatar: resolvedAvatar,
      type: cleanType,
      title: String(title).trim(),
      description: String(description).trim(),
      priority: cleanPriority,
      deviceInfo: deviceInfo ? String(deviceInfo).trim() : undefined,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const reports = await getMergedFeedbackReports();
    reports.unshift(newReport);
    saveStoredFeedbackReports(reports);
    await saveFeedbackReportToNeon(newReport);

    if (
      resolvedEmail &&
      resolvedEmail.toLowerCase() !== getAdmin1Email() &&
      resolvedEmail.toLowerCase() !== getAdmin2Email()
    ) {
      recordUserActivityLog({
        userId: resolvedUserId,
        displayId: resolvedDisplayId,
        email: resolvedEmail,
        name: resolvedName,
        action: 'submit_feedback',
        actionLabelAr: cleanType === 'bug' ? 'إرسال بلاغ خطأ' : 'إرسال اقتراح',
        details: newReport.title,
        ip: getClientIp(req),
      });
    }

    return res.json({
      success: true,
      message:
        cleanType === 'bug'
          ? 'تم إرسال بلاغك بنجاح! سيقوم فريق إدارة Soul-X بمراجعته فوراً.'
          : 'تم إرسال رسالتك بنجاح إلى لوحة التحكم!',
      reportId,
    });
  } catch (err: any) {
    console.error('Error submitting feedback report:', err);
    return res.status(500).json({ success: false, message: err?.message || 'حدث خطأ أثناء إرسال البلاغ' });
  }
});

// 9.1.A جلب سجل البلاغات والاقتراحات الخاصة بالمستخدم الحالي (My Reports & Suggestions)
app.get('/api/feedback/my', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    let userId = String(req.query.userId || '').trim();
    let displayId = String(req.query.displayId || '').trim();
    let email = String(req.query.email || '').trim();

    if (!userId && !displayId && !email) {
      const authHeader = String(req.headers['authorization'] || '').trim();
      const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (bearer) {
        const session = getStoredSessions().find((s) => s.token === bearer || s.refreshToken === bearer);
        if (session) {
          userId = session.userId || '';
          email = session.email || '';
          const matchedUser = getStoredUsers().find((u) => u.id === userId || u.email.toLowerCase() === email.toLowerCase());
          if (matchedUser?.displayId) displayId = matchedUser.displayId;
        }
      }
    }

    if (!userId && !displayId && !email) {
      return res.json({ success: true, reports: [] });
    }

    const identSet = await getUserIdentifierSet(userId || displayId || email, email, displayId);
    const allReports = await getMergedFeedbackReports();
    const myReports = allReports.filter((r) => {
      const rIds = [r.userId, r.userDisplayId, r.userEmail].filter(Boolean) as string[];
      return rIds.some((id) => identSet.has(id) || identSet.has(id.toLowerCase()));
    });

    return res.json({ success: true, reports: myReports });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'تعذر جلب سجل البلاغات' });
  }
});

// 9.1.B تقديم بلاغ عن مستخدم من الدردشة أو المطابقة (User Report Submission)
app.post('/api/reports/user', async (req: Request, res: Response) => {
  try {
    const {
      reporterId,
      reporterDisplayId,
      reporterName,
      reporterEmail,
      reporterAvatar,
      reportedUserId,
      reportedUserDisplayId,
      reportedUserName,
      reportedUserAvatar,
      reportedUserEmail,
      reason,
      details,
      source = 'chat',
    } = req.body;

    if (!reportedUserId && !reportedUserDisplayId && !reportedUserName) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد المستخدم المبلغ عنه' });
    }

    let resolvedReporterId = reporterId ? String(reporterId).trim() : undefined;
    let resolvedReporterDisplayId = reporterDisplayId ? String(reporterDisplayId).trim() : undefined;
    let resolvedReporterName = reporterName ? String(reporterName).trim() : undefined;
    let resolvedReporterEmail = reporterEmail ? String(reporterEmail).trim() : undefined;
    let resolvedReporterAvatar = reporterAvatar ? String(reporterAvatar).trim() : undefined;

    const authHeader = String(req.headers['authorization'] || '').trim();
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (bearer) {
      const session = getStoredSessions().find((s) => s.token === bearer || s.refreshToken === bearer);
      if (session) {
        resolvedReporterId = resolvedReporterId || session.userId;
        resolvedReporterEmail = resolvedReporterEmail || session.email;
      }
    }

    if (resolvedReporterId || resolvedReporterDisplayId || resolvedReporterEmail) {
      const matchedReporter = getStoredUsers().find(
        (u) =>
          (resolvedReporterId && u.id === resolvedReporterId) ||
          (resolvedReporterDisplayId && u.displayId === resolvedReporterDisplayId) ||
          (resolvedReporterEmail && u.email && u.email.toLowerCase() === resolvedReporterEmail.toLowerCase())
      );
      if (matchedReporter) {
        resolvedReporterId = resolvedReporterId || matchedReporter.id;
        resolvedReporterDisplayId = resolvedReporterDisplayId || matchedReporter.displayId;
        resolvedReporterName = resolvedReporterName || matchedReporter.name;
        resolvedReporterEmail = resolvedReporterEmail || matchedReporter.email;
        resolvedReporterAvatar = resolvedReporterAvatar || matchedReporter.photoUrl;
      }
    }

    const cleanReason = reason && String(reason).trim() ? String(reason).trim() : 'غير محدد';
    const cleanSource = source === 'matching' ? 'matching' : 'chat';
    const reportId = `usr-rpt-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const effectiveTargetName = reportedUserName ? String(reportedUserName).trim() : 'مستخدم Soul-X';
    const effectiveTargetDisplayId = reportedUserDisplayId
      ? String(reportedUserDisplayId).trim()
      : (reportedUserId ? String(reportedUserId).trim() : '—');
    const effectiveReporterName = resolvedReporterName || 'مستخدم Soul-X';
    const effectiveReporterDisplayId = resolvedReporterDisplayId || resolvedReporterId || '—';

    const descLines = [
      `🚨 بلاغ ضد المستخدم: ${effectiveTargetName} (ID: ${effectiveTargetDisplayId})`,
      `👤 مقدم البلاغ: ${effectiveReporterName} (ID: ${effectiveReporterDisplayId})`,
      `📋 سبب البلاغ: ${cleanReason}`,
      `📍 مصدر البلاغ: ${cleanSource === 'matching' ? 'شاشة المطابقة' : 'شاشة المراسلة في الدردشات'}`,
      details && String(details).trim() ? `📝 تفاصيل إضافية: ${String(details).trim()}` : null,
    ].filter(Boolean);

    const isUrgent =
      cleanReason === 'محتوى جنسي' ||
      cleanReason === 'تحرش' ||
      cleanReason === 'مستخدم ما دون 18 سنة' ||
      cleanReason === 'احتيالي';

    const newReport: StoredFeedbackReport = {
      id: reportId,
      userId: resolvedReporterId,
      userDisplayId: resolvedReporterDisplayId,
      userName: effectiveReporterName,
      userEmail: resolvedReporterEmail,
      userAvatar: resolvedReporterAvatar,
      type: 'user_report',
      title: `بلاغ ضد: ${effectiveTargetName} — ${cleanReason}`,
      description: descLines.join('\n'),
      priority: isUrgent ? 'urgent' : 'high',
      status: 'pending',
      createdAt: new Date().toISOString(),
      reportedUserId: reportedUserId ? String(reportedUserId).trim() : undefined,
      reportedUserDisplayId: reportedUserDisplayId ? String(reportedUserDisplayId).trim() : undefined,
      reportedUserName: effectiveTargetName,
      reportedUserAvatar: reportedUserAvatar ? String(reportedUserAvatar).trim() : undefined,
      reportedUserEmail: reportedUserEmail ? String(reportedUserEmail).trim() : undefined,
      reason: cleanReason,
      source: cleanSource,
    };

    const reports = await getMergedFeedbackReports();
    reports.unshift(newReport);
    saveStoredFeedbackReports(reports);
    await saveFeedbackReportToNeon(newReport);

    if (
      resolvedReporterEmail &&
      resolvedReporterEmail.toLowerCase() !== getAdmin1Email() &&
      resolvedReporterEmail.toLowerCase() !== getAdmin2Email()
    ) {
      recordUserActivityLog({
        userId: resolvedReporterId,
        displayId: resolvedReporterDisplayId,
        email: resolvedReporterEmail,
        name: resolvedReporterName,
        action: 'report_user',
        actionLabelAr: 'إبلاغ عن مستخدم',
        details: `المُبلغ عنه: ${reportedUserName || reportedUserId} — السبب: ${cleanReason}`,
        ip: getClientIp(req),
      });
    }

    return res.json({
      success: true,
      message: 'تم إرسال بلاغك لإدارة Soul-X بنجاح. سيقوم فريق الإشراف بالتحقق منه فوراً.',
      reportId,
    });
  } catch (err: any) {
    console.error('Error submitting user report:', err);
    return res.status(500).json({ success: false, message: err?.message || 'حدث خطأ أثناء إرسال البلاغ' });
  }
});

// 9.2 جلب كافة البلاغات والاقتراحات للوحة التحكم (Admin)
app.get('/api/admin/feedback', verifyAdminAuth, async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const reports = await getMergedFeedbackReports();

    const stats = {
      total: reports.length,
      bugs: reports.filter((r) => r.type === 'bug').length,
      suggestions: reports.filter((r) => r.type === 'suggestion').length,
      feedback: reports.filter((r) => r.type === 'feedback').length,
      userReports: reports.filter((r) => r.type === 'user_report').length,
      pending: reports.filter((r) => r.status === 'pending').length,
      inReview: reports.filter((r) => r.status === 'in_review').length,
      resolved: reports.filter((r) => r.status === 'resolved').length,
      dismissed: reports.filter((r) => r.status === 'dismissed').length,
    };

    return res.json({
      success: true,
      reports,
      stats,
    });
  } catch (err: any) {
    console.error('Error fetching admin feedback reports:', err);
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء جلب البلاغات' });
  }
});

// 9.2.B جلب بلاغات مستخدم محدد للوحة التحكم (Admin)
app.get('/api/admin/users/:userId/reports', verifyAdminAuth, async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  try {
    const { userId } = req.params;
    const targetSet = await getUserIdentifierSet(userId);
    const allReports = await getMergedFeedbackReports();
    const reports = allReports.filter((r) => {
      if (r.type !== 'user_report') return false;
      const rIds = [r.reportedUserId, r.reportedUserDisplayId, r.reportedUserEmail].filter(Boolean) as string[];
      return rIds.some((id) => targetSet.has(id) || targetSet.has(id.toLowerCase()));
    });
    return res.json({ success: true, reports });
  } catch (err: any) {
    console.error('Error fetching user specific reports:', err);
    return res.status(500).json({ success: false, message: err?.message || 'خطأ في جلب بلاغات المستخدم' });
  }
});

// 9.3 تحديث حالة بلاغ والرد عليه إدارياً مع إمكانية إشعار المستخدم
app.post('/api/admin/feedback/update', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id, status, adminNotes, adminReply, notifyUser } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: 'معرف البلاغ مطلوب' });
    }

    const reports = await getMergedFeedbackReports();
    const reportIndex = reports.findIndex((r) => r.id === id);
    if (reportIndex === -1) {
      return res.status(404).json({ success: false, message: 'لم يتم العثور على البلاغ' });
    }

    const report = reports[reportIndex];
    if (status && ['pending', 'in_review', 'resolved', 'dismissed'].includes(status)) {
      report.status = status;
    }
    if (typeof adminNotes === 'string') {
      report.adminNotes = adminNotes.trim();
    }
    if (typeof adminReply === 'string') {
      report.adminReply = adminReply.trim();
    }

    reports[reportIndex] = report;
    saveStoredFeedbackReports(reports);
    await saveFeedbackReportToNeon(report);

    // إذا طلب المدير إرسال إشعار للمستخدم بالرد في مركز الإشعارات
    if (notifyUser && report.adminReply && (report.userId || report.userDisplayId)) {
      const typeLabelAr =
        report.type === 'bug'
          ? 'بلاغك عن المشكلة'
          : report.type === 'user_report'
          ? 'بلاغك ضد المستخدم'
          : report.type === 'feedback'
          ? 'ملاحظتك'
          : 'اقتراحك';
      const typeLabelEn =
        report.type === 'bug'
          ? 'your bug report'
          : report.type === 'user_report'
          ? 'your user report'
          : report.type === 'feedback'
          ? 'your feedback'
          : 'your suggestion';
      createAndSaveUserNotification({
        userId: report.userId || report.userDisplayId || '',
        userDisplayId: report.userDisplayId,
        type: 'admin_message',
        titleAr: `💬 رد الإدارة على ${typeLabelAr}: "${report.title.substring(0, 35)}"`,
        titleEn: `💬 Admin reply to ${typeLabelEn}: "${report.title.substring(0, 35)}"`,
        messageAr: report.adminReply,
        messageEn: report.adminReply,
        metadata: {
          isAdminMessage: true,
          category: 'announcement',
          priority: 'normal',
          senderName: 'إدارة Soul-X',
          recipientName: report.userName,
          recipientDisplayId: report.userDisplayId,
          recipientEmail: report.userEmail,
        },
      });
    }

    return res.json({
      success: true,
      message: 'تم تحديث حالة البلاغ بنجاح',
      report,
    });
  } catch (err: any) {
    console.error('Error updating feedback report:', err);
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء تحديث البلاغ' });
  }
});

// 9.4 حذف بلاغ أو اقتراح
app.post('/api/admin/feedback/delete', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: 'معرف البلاغ مطلوب' });
    }

    const reports = await getMergedFeedbackReports();
    const remaining = reports.filter((r) => r.id !== id);
    saveStoredFeedbackReports(remaining);
    await deleteFeedbackReportFromNeon(String(id));

    return res.json({
      success: true,
      message: 'تم حذف البلاغ بنجاح',
      deletedCount: reports.length - remaining.length,
    });
  } catch (err: any) {
    console.error('Error deleting feedback report:', err);
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء حذف البلاغ' });
  }
});

// 9.5 إفراغ قسم البلاغات والاقتراحات بالكامل (أو المعالجة فقط)
app.post('/api/admin/feedback/clear', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const mode = req.body?.mode === 'resolved' ? 'resolved' : 'all';
    const reports = await getMergedFeedbackReports();
    const remaining = mode === 'resolved' ? reports.filter((r) => r.status !== 'resolved' && r.status !== 'dismissed') : [];
    const deletedCount = reports.length - remaining.length;

    saveStoredFeedbackReports(remaining);
    if (mode === 'all') {
      await deleteFeedbackReportFromNeon();
    } else if (neonPool) {
      await neonPool.query("DELETE FROM feedback_reports WHERE status IN ('resolved', 'dismissed')").catch(() => {});
    }

    return res.json({
      success: true,
      message: mode === 'all' ? 'تم إفراغ قسم البلاغات والاقتراحات بالكامل بنجاح' : 'تم حذف البلاغات المحلولة والمستبعدة بنجاح',
      deletedCount,
      remainingCount: remaining.length,
    });
  } catch (err: any) {
    console.error('Error clearing feedback reports:', err);
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء إفراغ البلاغات' });
  }
});

// =========================================================================
// 10. طلبات استعادة كلمة المرور (من الويب وبوت تيليجرام) (Password Reset Requests)
// =========================================================================

// 10.1 جلب كافة طلبات استعادة كلمة المرور للوحة التحكم مع ربط الحسابات الفعلية وروابط تيليجرام
app.get('/api/admin/password-resets', verifyAdminAuth, async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  try {
    const rawRequests = await getMergedPasswordResets();
    const users = getStoredUsers();
    const refStore = getBotReferralStore();

    const requests = rawRequests.map((r) => {
      let enriched: StoredPasswordResetRequest = { ...r };

      // Check referral transfers if Telegram user ID is present without Soul-X user info
      if (enriched.telegramUserId && !enriched.userId && !enriched.userEmail) {
        const matchedTx = refStore.transfers.find(
          (t) => String(t.telegramUserId) === String(enriched.telegramUserId)
        );
        if (matchedTx) {
          enriched.userId = matchedTx.targetUserId;
          enriched.userDisplayId = matchedTx.targetDisplayId;
          enriched.userName = enriched.userName || matchedTx.targetUserName;
        }
      }

      if (enriched.userEmail || enriched.userId || enriched.userDisplayId) {
        const matched = users.find(
          (u) =>
            (enriched.userId && u.id === enriched.userId) ||
            (enriched.userDisplayId && u.displayId === enriched.userDisplayId) ||
            (enriched.userEmail && u.email && u.email.toLowerCase() === enriched.userEmail.toLowerCase())
        );
        if (matched) {
          enriched.userId = enriched.userId || matched.id;
          enriched.userDisplayId = enriched.userDisplayId || matched.displayId;
          enriched.userEmail = enriched.userEmail || matched.email;
          enriched.userName = enriched.userName || matched.name;
        }
      }

      const tg = normalizeTelegramContact(
        enriched.telegramUsername || enriched.contactNote,
        enriched.telegramUserId
      );
      enriched.telegramUsername = enriched.telegramUsername || tg.username;
      enriched.telegramLink = enriched.telegramLink || tg.link;

      return enriched;
    });

    const stats = {
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      contacted: requests.filter((r) => r.status === 'contacted').length,
      resolved: requests.filter((r) => r.status === 'resolved').length,
      cancelled: requests.filter((r) => r.status === 'cancelled').length,
    };

    return res.json({
      success: true,
      requests,
      stats,
    });
  } catch (err: any) {
    console.error('Error fetching password reset requests:', err);
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء جلب طلبات استعادة كلمة المرور' });
  }
});

// 10.2 تحديث حالة طلب استعادة كلمة المرور وإضافة ملاحظات
app.post('/api/admin/password-resets/update', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id, status, adminNotes } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: 'معرف الطلب مطلوب' });
    }

    const requests = await getMergedPasswordResets();
    const index = requests.findIndex((r) => r.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'لم يتم العثور على الطلب' });
    }

    const item = requests[index];
    if (status && ['pending', 'contacted', 'resolved', 'cancelled'].includes(status)) {
      item.status = status;
      if (status === 'resolved') {
        item.resolvedAt = new Date().toISOString();
      }
    }
    if (typeof adminNotes === 'string') {
      item.adminNotes = adminNotes.trim();
    }

    requests[index] = item;
    saveStoredPasswordResetRequests(requests);
    await savePasswordResetToNeon(item);

    return res.json({
      success: true,
      message: 'تم تحديث حالة الطلب بنجاح',
      request: item,
    });
  } catch (err: any) {
    console.error('Error updating password reset request:', err);
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء تحديث حالة الطلب' });
  }
});

// 10.2.B حل الطلب فعلياً وتعيين كلمة مرور جديدة للحساب (تحديث في Neon والملف المحلي وإشعار المستخدم)
app.post('/api/admin/password-resets/resolve-password', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id, targetUserIdentifier, newPassword, adminNotes, notifyViaTelegram = true, notifyViaCenter = true } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: 'معرف الطلب مطلوب' });
    }
    const cleanPassword = String(newPassword || '');
    if (cleanPassword.length < 4) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الجديدة يجب أن لا تقل عن 4 خانات' });
    }

    const requests = await getMergedPasswordResets();
    const index = requests.findIndex((r) => r.id === id);
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'لم يتم العثور على طلب الاستعادة' });
    }

    const item = requests[index];
    const lookupKey = String(
      targetUserIdentifier || item.userEmail || item.userId || item.userDisplayId || ''
    ).trim().toLowerCase();

    if (!lookupKey) {
      return res.status(400).json({
        success: false,
        message: 'يرجى تحديد البريد الإلكتروني أو معرف الحساب (ID) المرتبط بهذا الطلب أولاً',
      });
    }

    const users = getStoredUsers();
    let targetUser = users.find(
      (u) =>
        (u.id && u.id.toLowerCase() === lookupKey) ||
        (u.displayId && u.displayId.toLowerCase() === lookupKey) ||
        (u.email && u.email.toLowerCase() === lookupKey)
    );

    if (!targetUser && neonPool) {
      try {
        const neonUserRes: any = await withTimeout(
          neonPool.query(
            'SELECT id, display_id, email, name FROM profiles WHERE LOWER(id) = $1 OR LOWER(display_id) = $1 OR LOWER(email) = $1 LIMIT 1',
            [lookupKey]
          ),
          3500
        );
        if (neonUserRes?.rows?.[0]) {
          const p = neonUserRes.rows[0];
          targetUser = {
            id: p.id,
            displayId: p.display_id,
            email: p.email,
            name: p.name,
            passwordHash: hashPassword(cleanPassword),
            createdAt: new Date().toISOString(),
          };
          users.push(targetUser);
        }
      } catch {}
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على حساب مستخدم مطابق في قاعدة البيانات',
      });
    }

    const newHash = hashPassword(cleanPassword);
    targetUser.passwordHash = newHash;
    targetUser.updatedAt = new Date().toISOString();
    saveStoredUsers(users);

    await updateNeonProfileByIdentifier(targetUser.id, {
      passwordHash: newHash,
    }).catch((err) => {
      console.warn('Neon resolve password sync error:', err?.message || err);
    });

    item.userId = targetUser.id;
    item.userDisplayId = targetUser.displayId;
    item.userEmail = targetUser.email;
    item.userName = targetUser.name;
    item.status = 'resolved';
    item.resolvedAt = new Date().toISOString();
    item.resolvedBy = (req as any).adminUser?.email || (req as any).adminUser?.name || 'Admin';
    if (typeof adminNotes === 'string' && adminNotes.trim()) {
      item.adminNotes = adminNotes.trim();
    } else if (!item.adminNotes) {
      item.adminNotes = `تم تعيين كلمة مرور جديدة للحساب (${targetUser.email}) وإغلاق الطلب.`;
    }

    requests[index] = item;
    saveStoredPasswordResetRequests(requests);
    await savePasswordResetToNeon(item);

    // Notify in User Notification Center
    if (notifyViaCenter && targetUser.id) {
      createAndSaveUserNotification({
        userId: targetUser.id,
        userDisplayId: targetUser.displayId,
        type: 'admin_message',
        titleAr: '🔑 تم إعادة تعيين كلمة مرور حسابك بنجاح',
        titleEn: '🔑 Your Account Password Has Been Reset',
        messageAr: 'قامت إدارة Soul-X بتحديث كلمة مرور حسابك بنجاح استجابة لطلب الاستعادة.',
        messageEn: 'Soul-X administration has updated your account password in response to your reset request.',
        metadata: {
          isAdminMessage: true,
          category: 'system',
          priority: 'important',
          senderName: 'إدارة Soul-X',
          recipientName: targetUser.name,
          recipientDisplayId: targetUser.displayId,
          recipientEmail: targetUser.email,
        },
      });
    }

    // Notify on Telegram Bot if request originated from Telegram & bot is active
    let telegramNotified = false;
    if (notifyViaTelegram && item.chatId && activeBotService) {
      const htmlMsg =
        `✅ <b>تم حل طلب استعادة كلمة المرور — Soul-X</b>\n\n` +
        `مرحباً <b>${targetUser.name}</b>،\n` +
        `تم تحديث كلمة المرور لحسابك (<code>${targetUser.email}</code>) بنجاح.\n\n` +
        `🔑 يمكنك الآن تسجيل الدخول فوراً بكلمة المرور الجديدة المستلمة من الدعم.\n` +
        `🔒 يُنصح بتغيير كلمة المرور بعد الدخول من إعدادات الحساب.`;
      const plainMsg =
        `✅ تم حل طلب استعادة كلمة المرور — Soul-X\n\n` +
        `مرحباً ${targetUser.name}، تم تحديث كلمة المرور لحسابك (${targetUser.email}) بنجاح. يمكنك الآن تسجيل الدخول فوراً.`;
      telegramNotified = await activeBotService.sendDirectMessage(item.chatId, htmlMsg, plainMsg).catch(() => false);
    }

    return res.json({
      success: true,
      message: telegramNotified
        ? 'تم تعيين كلمة المرور الجديدة بنجاح وإشعار المستخدم عبر تيليجرام!'
        : 'تم تعيين كلمة المرور الجديدة وحل الطلب بنجاح!',
      request: item,
      telegramNotified,
    });
  } catch (err: any) {
    console.error('Error resolving password reset:', err);
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء تعيين كلمة المرور الجديدة' });
  }
});

// 10.3 حذف طلب استعادة كلمة المرور
app.post('/api/admin/password-resets/delete', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ success: false, message: 'معرف الطلب مطلوب' });
    }

    const requests = await getMergedPasswordResets();
    const remaining = requests.filter((r) => r.id !== id);
    saveStoredPasswordResetRequests(remaining);
    await deletePasswordResetFromNeon(String(id));

    return res.json({
      success: true,
      message: 'تم حذف الطلب بنجاح',
      deletedCount: requests.length - remaining.length,
    });
  } catch (err: any) {
    console.error('Error deleting password reset request:', err);
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء حذف الطلب' });
  }
});

// 10.4 إفراغ قسم طلبات استعادة كلمة المرور
app.post('/api/admin/password-resets/clear', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const mode = req.body?.mode === 'resolved' ? 'resolved' : 'all';
    const requests = await getMergedPasswordResets();
    const remaining = mode === 'resolved' ? requests.filter((r) => r.status !== 'resolved' && r.status !== 'cancelled') : [];
    const deletedCount = requests.length - remaining.length;

    saveStoredPasswordResetRequests(remaining);
    if (mode === 'all') {
      await deletePasswordResetFromNeon();
    } else if (neonPool) {
      await neonPool.query("DELETE FROM password_reset_requests WHERE status IN ('resolved', 'cancelled')").catch(() => {});
    }

    return res.json({
      success: true,
      message: mode === 'all' ? 'تم إفراغ قسم استعادة كلمة المرور بالكامل بنجاح' : 'تم حذف الطلبات المحلولة والملغاة بنجاح',
      deletedCount,
      remainingCount: remaining.length,
    });
  } catch (err: any) {
    console.error('Error clearing password resets:', err);
    return res.status(500).json({ success: false, message: err?.message || 'خطأ أثناء إفراغ الطلبات' });
  }
});

// ==========================================
// Account Verification Endpoints (نظام توثيق الحسابات بالشارة الزرقاء)
// ==========================================

// 11.1 جلب حالة توثيق المستخدم وآخر طلب مقدم منه
app.get('/api/verification/my-status', async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  try {
    const authHeader = (req.headers['authorization'] as string) || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    const refreshToken = ((req.headers['x-refresh-token'] as string) || '').trim();
    const queryUserId = ((req.query.userId as string) || (req.query.id as string) || '').trim();
    const queryEmail = ((req.query.email as string) || '').trim().toLowerCase();

    let resolvedUser: StoredUser | undefined;
    const users = getStoredUsers();

    if (token || refreshToken) {
      const verifyRes = await verifyToken(token || '', refreshToken, queryUserId, queryEmail);
      if (verifyRes.valid && verifyRes.user) {
        resolvedUser = users.find(
          (u) =>
            u.id === verifyRes.user.id ||
            (verifyRes.user.displayId && u.displayId === verifyRes.user.displayId) ||
            (verifyRes.user.email && u.email.toLowerCase() === verifyRes.user.email.toLowerCase())
        );
      }
    }

    if (!resolvedUser && (queryUserId || queryEmail)) {
      resolvedUser = users.find(
        (u) =>
          (queryUserId && (u.id === queryUserId || u.displayId === queryUserId)) ||
          (queryEmail && u.email.toLowerCase() === queryEmail)
      );
    }

    if (!resolvedUser) {
      return res.status(401).json({ success: false, message: 'يرجى تسجيل الدخول للتحقق من حالة التوثيق' });
    }

    const allRequests = await getMergedVerificationRequests();
    const identKeys = new Set(
      [resolvedUser.id, resolvedUser.displayId, resolvedUser.email?.toLowerCase()]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase())
    );
    const userRequests = allRequests
      .filter((r) => {
        const keys = [r.userId, r.userDisplayId, r.userEmail?.toLowerCase()]
          .filter(Boolean)
          .map((x) => String(x).toLowerCase());
        return keys.some((k) => identKeys.has(k));
      })
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    const fallbackLatestRequest =
      userRequests[0] ||
      (!resolvedUser.isVerified && resolvedUser.lastVerificationOutcome?.status === 'rejected'
        ? {
            id: `archived_${resolvedUser.id}`,
            userId: resolvedUser.id,
            userDisplayId: resolvedUser.displayId || resolvedUser.id,
            userName: resolvedUser.name,
            userEmail: resolvedUser.email,
            idFrontImage: '',
            idBackImage: '',
            selfieWithIdImage: '',
            status: 'rejected' as const,
            submittedAt:
              resolvedUser.lastVerificationOutcome.submittedAt ||
              resolvedUser.updatedAt ||
              new Date().toISOString(),
            reviewedAt: resolvedUser.lastVerificationOutcome.reviewedAt || null,
            reviewedBy: null,
            rejectionReason: resolvedUser.lastVerificationOutcome.rejectionReason || null,
          }
        : null);

    return res.json({
      success: true,
      isVerified: Boolean(resolvedUser.isVerified),
      latestRequest: fallbackLatestRequest,
    });
  } catch (err: any) {
    console.error('Error fetching my verification status:', err);
    return res.status(500).json({ success: false, message: 'تعذر جلب حالة التوثيق' });
  }
});

// 11.2 إرسال طلب توثيق حساب جديد (يتطلب 3 صور إلزامية)
app.post('/api/verification/submit', async (req: Request, res: Response) => {
  try {
    const authHeader = (req.headers['authorization'] as string) || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
    const refreshToken = ((req.headers['x-refresh-token'] as string) || '').trim();
    const { userId, idFrontImage, idBackImage, selfieWithIdImage } = req.body || {};

    let resolvedUser: StoredUser | undefined;
    const users = getStoredUsers();

    if (token || refreshToken) {
      const verifyRes = await verifyToken(token || '', refreshToken, userId);
      if (verifyRes.valid && verifyRes.user) {
        resolvedUser = users.find(
          (u) =>
            u.id === verifyRes.user.id ||
            (verifyRes.user.displayId && u.displayId === verifyRes.user.displayId) ||
            (verifyRes.user.email && u.email.toLowerCase() === verifyRes.user.email.toLowerCase())
        );
      }
    }

    if (!resolvedUser && userId) {
      const cleanUid = String(userId).trim();
      resolvedUser = users.find(
        (u) =>
          u.id === cleanUid ||
          u.displayId === cleanUid ||
          u.email.toLowerCase() === cleanUid.toLowerCase()
      );
    }

    if (!resolvedUser) {
      return res.status(401).json({ success: false, message: 'يجب تسجيل الدخول لإرسال طلب التوثيق' });
    }

    if (resolvedUser.isVerified) {
      return res.status(400).json({ success: false, message: 'حسابك موثق بالفعل بالشارة الزرقاء' });
    }

    const isValidImage = (val: unknown) =>
      typeof val === 'string' &&
      val.trim().length > 20 &&
      (val.trim().startsWith('data:image/') || val.trim().startsWith('http://') || val.trim().startsWith('https://'));

    if (!isValidImage(idFrontImage) || !isValidImage(idBackImage) || !isValidImage(selfieWithIdImage)) {
      return res.status(400).json({
        success: false,
        message: 'يرجى إرفاق جميع الصور الثلاث المطلوبة: الوجه الأمامي للهوية، الوجه الخلفي للهوية، وصورة سيلفي مع الوجه الأمامي للهوية',
      });
    }

    const existingRequests = await getMergedVerificationRequests();
    const identKeys = new Set(
      [resolvedUser.id, resolvedUser.displayId, resolvedUser.email?.toLowerCase()]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase())
    );
    const hasPending = existingRequests.some((r) => {
      if (r.status !== 'pending') return false;
      const keys = [r.userId, r.userDisplayId, r.userEmail?.toLowerCase()]
        .filter(Boolean)
        .map((x) => String(x).toLowerCase());
      return keys.some((k) => identKeys.has(k));
    });

    if (hasPending) {
      return res.status(400).json({
        success: false,
        message: 'لديك طلب توثيق قيد المراجعة حالياً، يرجى انتظار رد الإدارة',
      });
    }

    const newReq: StoredVerificationRequest = {
      id: `ver_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId: resolvedUser.id,
      userDisplayId: resolvedUser.displayId || resolvedUser.id,
      userName: resolvedUser.name,
      userEmail: resolvedUser.email,
      userAvatar: resolvedUser.photoUrl || undefined,
      idFrontImage: String(idFrontImage).trim(),
      idBackImage: String(idBackImage).trim(),
      selfieWithIdImage: String(selfieWithIdImage).trim(),
      status: 'pending',
      submittedAt: new Date().toISOString(),
      reviewedAt: null,
      reviewedBy: null,
      rejectionReason: null,
    };

    existingRequests.unshift(newReq);
    saveStoredVerificationRequests(existingRequests);
    await saveVerificationRequestToNeon(newReq).catch(() => {});

    if (resolvedUser.email.toLowerCase() !== getAdmin1Email() && resolvedUser.email.toLowerCase() !== getAdmin2Email()) {
      recordUserActivityLog({
        userId: resolvedUser.id,
        displayId: resolvedUser.displayId,
        email: resolvedUser.email,
        name: resolvedUser.name,
        action: 'verification_submit',
        actionLabelAr: 'إرسال طلب توثيق حساب',
        ip: getClientIp(req),
      });
    }

    return res.json({
      success: true,
      message: 'تم إرسال طلب توثيق الحساب بنجاح! سيقوم فريق الإدارة بمراجعته قريباً.',
      request: newReq,
    });
  } catch (err: any) {
    console.error('Error submitting verification request:', err);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء إرسال طلب التوثيق' });
  }
});

// 11.3 جلب جميع طلبات توثيق الحسابات للإدارة (محمية بـ verifyAdminAuth)
app.get('/api/admin/verifications', verifyAdminAuth, async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  try {
    const requests = await getMergedVerificationRequests();
    const users = getStoredUsers();
    const verifiedSet = getVerifiedIdentifierSet(users);

    const enriched = requests
      .map((r) => {
        const matchedUser = users.find(
          (u) =>
            u.id === r.userId ||
            (r.userDisplayId && u.displayId === r.userDisplayId) ||
            (r.userEmail && u.email.toLowerCase() === r.userEmail.toLowerCase())
        );
        return {
          ...r,
          userName: matchedUser?.name || r.userName,
          userAvatar: matchedUser?.photoUrl || r.userAvatar,
          userDisplayId: matchedUser?.displayId || r.userDisplayId || r.userId,
          userIsVerified: Boolean(
            matchedUser?.isVerified ||
              isUserIdentifierVerified(r.userId, verifiedSet) ||
              isUserIdentifierVerified(r.userDisplayId, verifiedSet)
          ),
        };
      })
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    return res.json({
      success: true,
      requests: enriched,
      pendingCount: enriched.filter((r) => r.status === 'pending').length,
      totalCount: enriched.length,
    });
  } catch (err: any) {
    console.error('Error fetching admin verifications:', err);
    return res.status(500).json({ success: false, message: 'خطأ في جلب طلبات التوثيق' });
  }
});

// 11.4 الموافقة على طلب توثيق الحساب ومنح الشارة الزرقاء (محمية بـ verifyAdminAuth)
app.post('/api/admin/verifications/approve', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id, requestId } = req.body || {};
    const targetId = id || requestId;
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'معرف طلب التوثيق مطلوب' });
    }

    const requests = await getMergedVerificationRequests();
    const idx = requests.findIndex((r) => r.id === targetId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'طلب التوثيق غير موجود' });
    }

    const reqItem = requests[idx];
    const adminEmail = ((req.headers['x-admin-email'] as string) || 'ADMIN').trim();
    const nowIso = new Date().toISOString();

    reqItem.status = 'approved';
    reqItem.reviewedAt = nowIso;
    reqItem.reviewedBy = adminEmail;
    reqItem.rejectionReason = null;
    requests[idx] = reqItem;

    // Auto-approve any older pending duplicate requests by same user
    const targetIdentKeys = new Set(
      [reqItem.userId, reqItem.userDisplayId, reqItem.userEmail?.toLowerCase()]
        .filter(Boolean)
        .map((k) => String(k).toLowerCase())
    );
    for (let i = 0; i < requests.length; i++) {
      if (i !== idx && requests[i].status === 'pending') {
        const keys = [requests[i].userId, requests[i].userDisplayId, requests[i].userEmail?.toLowerCase()]
          .filter(Boolean)
          .map((k) => String(k).toLowerCase());
        if (keys.some((k) => targetIdentKeys.has(k))) {
          requests[i].status = 'approved';
          requests[i].reviewedAt = nowIso;
          requests[i].reviewedBy = adminEmail;
          await saveVerificationRequestToNeon(requests[i]).catch(() => {});
        }
      }
    }

    saveStoredVerificationRequests(requests);
    await saveVerificationRequestToNeon(reqItem).catch(() => {});

    // Mark user verified in users.json & Neon
    const users = getStoredUsers();
    const uIdx = users.findIndex(
      (u) =>
        u.id === reqItem.userId ||
        (reqItem.userDisplayId && u.displayId === reqItem.userDisplayId) ||
        (reqItem.userEmail && u.email.toLowerCase() === reqItem.userEmail.toLowerCase())
    );

    if (uIdx !== -1) {
      users[uIdx].isVerified = true;
      users[uIdx].lastVerificationOutcome = {
        status: 'approved',
        rejectionReason: null,
        submittedAt: reqItem.submittedAt,
        reviewedAt: nowIso,
      };
      users[uIdx].updatedAt = nowIso;
      saveStoredUsers(users);
      await updateNeonProfileByIdentifier(users[uIdx].id, { isVerified: true }).catch(() => {});
      createAndSaveUserNotification({
        userId: users[uIdx].id,
        userDisplayId: users[uIdx].displayId,
        type: 'admin_message',
        titleAr: 'تم توثيق حسابك بنجاح ✓',
        titleEn: 'Account Verified ✓',
        messageAr: 'مبارك! تمت الموافقة على طلب التوثيق الخاص بك وظهرت الشارة الزرقاء بجانب اسمك.',
        messageEn: 'Congratulations! Your verification request was approved and your blue badge is now active.',
        metadata: { isAdminMessage: true, category: 'reward', priority: 'important' },
      });
    } else if (reqItem.userId) {
      await updateNeonProfileByIdentifier(reqItem.userId, { isVerified: true }).catch(() => {});
    }

    return res.json({
      success: true,
      message: 'تمت الموافقة على طلب التوثيق وتفعيل الشارة الزرقاء للمستخدم بنجاح',
      request: reqItem,
    });
  } catch (err: any) {
    console.error('Error approving verification request:', err);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء الموافقة على الطلب' });
  }
});

// 11.5 رفض طلب توثيق الحساب (محمية بـ verifyAdminAuth)
app.post('/api/admin/verifications/reject', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const { id, requestId, reason } = req.body || {};
    const targetId = id || requestId;
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'معرف طلب التوثيق مطلوب' });
    }

    const requests = await getMergedVerificationRequests();
    const idx = requests.findIndex((r) => r.id === targetId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'طلب التوثيق غير موجود' });
    }

    const reqItem = requests[idx];
    const adminEmail = ((req.headers['x-admin-email'] as string) || 'ADMIN').trim();
    const cleanReason =
      typeof reason === 'string' && reason.trim()
        ? reason.trim()
        : 'الصور المرفقة غير واضحة أو لا تطابق شروط التوثيق';

    reqItem.status = 'rejected';
    reqItem.reviewedAt = new Date().toISOString();
    reqItem.reviewedBy = adminEmail;
    reqItem.rejectionReason = cleanReason;
    requests[idx] = reqItem;

    saveStoredVerificationRequests(requests);
    await saveVerificationRequestToNeon(reqItem).catch(() => {});

    const users = getStoredUsers();
    const targetIdx = users.findIndex(
      (u) =>
        u.id === reqItem.userId ||
        (reqItem.userDisplayId && u.displayId === reqItem.userDisplayId) ||
        (reqItem.userEmail && u.email.toLowerCase() === reqItem.userEmail.toLowerCase())
    );
    if (targetIdx !== -1) {
      const targetUser = users[targetIdx];
      targetUser.lastVerificationOutcome = {
        status: 'rejected',
        rejectionReason: cleanReason,
        submittedAt: reqItem.submittedAt,
        reviewedAt: reqItem.reviewedAt,
      };
      users[targetIdx] = targetUser;
      saveStoredUsers(users);
      createAndSaveUserNotification({
        userId: targetUser.id,
        userDisplayId: targetUser.displayId,
        type: 'admin_message',
        titleAr: 'تم رفض طلب توثيق الحساب',
        titleEn: 'Verification Request Rejected',
        messageAr: `نأسف، لم تتم الموافقة على طلب التوثيق. السبب: ${cleanReason}. يمكنك إرسال طلب جديد بصور أوضح.`,
        messageEn: `Your verification request was rejected. Reason: ${cleanReason}. You may submit a new request.`,
        metadata: { isAdminMessage: true, category: 'warning', priority: 'important' },
      });
    }

    return res.json({
      success: true,
      message: 'تم رفض طلب التوثيق وإشعار المستخدم',
      request: reqItem,
    });
  } catch (err: any) {
    console.error('Error rejecting verification request:', err);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء رفض الطلب' });
  }
});

// 11.5b حذف طلب توثيق بعد القبول أو الرفض دون التأثير على حالة الطلب أو التوثيق (محمية بـ verifyAdminAuth)
app.delete('/api/admin/verifications/:id', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const targetId = String(req.params.id || '').trim();
    if (!targetId) {
      return res.status(400).json({ success: false, message: 'معرف طلب التوثيق مطلوب' });
    }

    const requests = await getMergedVerificationRequests();
    const idx = requests.findIndex((r) => r.id === targetId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'طلب التوثيق غير موجود' });
    }

    const reqItem = requests[idx];
    if (reqItem.status !== 'approved' && reqItem.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        message: 'يمكن حذف الطلبات المقبولة أو المرفوضة فقط بعد المراجعة',
      });
    }

    // Preserve outcome metadata on user record without altering isVerified or status
    const users = getStoredUsers();
    const uIdx = users.findIndex(
      (u) =>
        u.id === reqItem.userId ||
        (reqItem.userDisplayId && u.displayId === reqItem.userDisplayId) ||
        (reqItem.userEmail && u.email.toLowerCase() === reqItem.userEmail.toLowerCase())
    );
    if (uIdx !== -1 && !users[uIdx].lastVerificationOutcome) {
      users[uIdx].lastVerificationOutcome = {
        status: reqItem.status,
        rejectionReason: reqItem.status === 'rejected' ? reqItem.rejectionReason || null : null,
        submittedAt: reqItem.submittedAt,
        reviewedAt: reqItem.reviewedAt || null,
      };
      saveStoredUsers(users);
    }

    const remaining = requests.filter((r) => r.id !== targetId);
    saveStoredVerificationRequests(remaining);

    if (neonPool) {
      await withTimeout(
        neonPool.query('DELETE FROM verification_requests WHERE id = $1', [targetId]),
        4000
      ).catch((e: any) => {
        console.warn('Neon DELETE verification_requests warning:', e?.message || e);
      });
    }

    return res.json({
      success: true,
      deletedId: targetId,
      message: 'تم حذف طلب التوثيق بنجاح دون التأثير على التوثيق أو حالة الطلب',
    });
  } catch (err: any) {
    console.error('Error deleting verification request:', err);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء حذف طلب التوثيق' });
  }
});

// 11.6 توثيق حساب أو إلغاء توثيقه مباشرة من لوحة التحكم (محمية بـ verifyAdminAuth)
app.post('/api/admin/users/verify-toggle', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const { userId, isVerified } = req.body || {};
    if (!userId) {
      return res.status(400).json({ success: false, message: 'معرف المستخدم مطلوب' });
    }

    const cleanId = String(userId).trim();
    const users = getStoredUsers();
    const uIdx = users.findIndex(
      (u) =>
        u.id === cleanId ||
        u.displayId === cleanId ||
        u.email.toLowerCase() === cleanId.toLowerCase()
    );

    if (uIdx === -1) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    const nextVerified =
      typeof isVerified === 'boolean' ? isVerified : !Boolean(users[uIdx].isVerified);
    const nowIso = new Date().toISOString();

    users[uIdx].isVerified = nextVerified;
    users[uIdx].lastVerificationOutcome = nextVerified
      ? {
          status: 'approved',
          rejectionReason: null,
          reviewedAt: nowIso,
        }
      : null;
    users[uIdx].updatedAt = nowIso;
    saveStoredUsers(users);
    await updateNeonProfileByIdentifier(users[uIdx].id, { isVerified: nextVerified }).catch(() => {});

    // Sync any pending verification requests for this user if verified
    if (nextVerified) {
      const adminEmail = ((req.headers['x-admin-email'] as string) || 'ADMIN').trim();
      const requests = await getMergedVerificationRequests();
      const identKeys = new Set(
        [users[uIdx].id, users[uIdx].displayId, users[uIdx].email?.toLowerCase()]
          .filter(Boolean)
          .map((k) => String(k).toLowerCase())
      );
      let reqChanged = false;
      for (const r of requests) {
        if (r.status === 'pending') {
          const keys = [r.userId, r.userDisplayId, r.userEmail?.toLowerCase()]
            .filter(Boolean)
            .map((k) => String(k).toLowerCase());
          if (keys.some((k) => identKeys.has(k))) {
            r.status = 'approved';
            r.reviewedAt = nowIso;
            r.reviewedBy = adminEmail;
            r.rejectionReason = null;
            reqChanged = true;
            await saveVerificationRequestToNeon(r).catch(() => {});
          }
        }
      }
      if (reqChanged) {
        saveStoredVerificationRequests(requests);
      }
    }

    createAndSaveUserNotification({
      userId: users[uIdx].id,
      userDisplayId: users[uIdx].displayId,
      type: 'admin_message',
      titleAr: nextVerified ? 'تم توثيق حسابك بالشارة الزرقاء ✓' : 'تم إلغاء توثيق الحساب',
      titleEn: nextVerified ? 'Account Verified ✓' : 'Account Verification Revoked',
      messageAr: nextVerified
        ? 'تم توثيق حسابك من قبل الإدارة وظهرت الشارة الزرقاء بجانب اسمك.'
        : 'تمت إزالة شارة التوثيق الزرقاء عن حسابك من قبل الإدارة.',
      messageEn: nextVerified
        ? 'Your account has been verified by administration and your blue badge is now visible.'
        : 'Your verified blue badge has been removed by administration.',
      metadata: { isAdminMessage: true, category: nextVerified ? 'reward' : 'warning', priority: 'important' },
    });

    return res.json({
      success: true,
      isVerified: nextVerified,
      message: nextVerified ? 'تم توثيق الحساب وتفعيل الشارة الزرقاء بنجاح' : 'تم إلغاء توثيق الحساب وإزالة الشارة الزرقاء بنجاح',
      user: {
        id: users[uIdx].id,
        displayId: users[uIdx].displayId,
        name: users[uIdx].name,
        email: users[uIdx].email,
        isVerified: nextVerified,
      },
    });
  } catch (err: any) {
    console.error('Error toggling user verification:', err);
    return res.status(500).json({ success: false, message: 'حدث خطأ أثناء تحديث حالة التوثيق' });
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

// 6. Endpoint: جلب إعدادات وإحصائيات وسجلات نظام الإحالات في البوت (للوحة التحكم)
app.get('/api/admin/bot/referrals', verifyAdminAuth, async (_req: Request, res: Response) => {
  try {
    const store = getBotReferralStore();
    const totalBotUsers = store.users.length;
    const totalReferrals = store.users.reduce((sum, u) => sum + (u.referralsCount || 0), 0);
    const totalBalanceUsd = roundUsd(store.users.reduce((sum, u) => sum + (u.balanceUsd || 0), 0));
    const totalEarnedUsd = roundUsd(store.users.reduce((sum, u) => sum + (u.totalEarnedUsd || 0), 0));
    const totalTransferredUsd = roundUsd(store.users.reduce((sum, u) => sum + (u.totalTransferredUsd || 0), 0));
    const totalTransferredCoins = store.users.reduce((sum, u) => sum + (u.totalTransferredCoins || 0), 0);

    const sortedUsers = [...store.users].sort(
      (a, b) =>
        (b.referralsCount || 0) - (a.referralsCount || 0) ||
        (b.balanceUsd || 0) - (a.balanceUsd || 0) ||
        new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime()
    );

    return res.json({
      success: true,
      settings: store.settings,
      stats: {
        totalBotUsers,
        totalReferrals,
        totalBalanceUsd,
        totalEarnedUsd,
        totalTransferredUsd,
        totalTransferredCoins,
        transfersCount: store.transfers.length,
        eventsCount: store.events.length,
      },
      users: sortedUsers.slice(0, 100),
      transfers: store.transfers.slice(0, 100),
      events: store.events.slice(0, 100),
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'خطأ في جلب بيانات نظام الإحالات',
    });
  }
});

// 7. Endpoint: تعديل إعدادات وتفعيل/إيقاف نظام الإحالات في البوت (محمية بـ verifyAdminAuth)
app.post('/api/admin/bot/referrals/settings', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const { enabled, newUserBonusUsd, referrerBonusUsd, coinsPerDollar } = req.body || {};

    if (newUserBonusUsd !== undefined && (!Number.isFinite(Number(newUserBonusUsd)) || Number(newUserBonusUsd) < 0)) {
      return res.status(400).json({ success: false, message: 'قيمة مكافأة المستخدم الجديد غير صالحة' });
    }
    if (referrerBonusUsd !== undefined && (!Number.isFinite(Number(referrerBonusUsd)) || Number(referrerBonusUsd) < 0)) {
      return res.status(400).json({ success: false, message: 'قيمة مكافأة المحيل غير صالحة' });
    }
    if (coinsPerDollar !== undefined && (!Number.isFinite(Number(coinsPerDollar)) || Number(coinsPerDollar) < 1)) {
      return res.status(400).json({ success: false, message: 'سعر الصرف (Coins لكل 1$) يجب أن يكون 1 على الأقل' });
    }

    const updated = saveBotReferralSettings({
      enabled: typeof enabled === 'boolean' ? enabled : undefined,
      newUserBonusUsd: newUserBonusUsd !== undefined ? Number(newUserBonusUsd) : undefined,
      referrerBonusUsd: referrerBonusUsd !== undefined ? Number(referrerBonusUsd) : undefined,
      coinsPerDollar: coinsPerDollar !== undefined ? Number(coinsPerDollar) : undefined,
    });

    return res.json({
      success: true,
      settings: updated,
      message: updated.enabled
        ? 'تم حفظ إعدادات الإحالات وتفعيل الميزة في البوت بنجاح ✨'
        : 'تم حفظ الإعدادات وإيقاف ميزة الإحالات في البوت مؤقتاً',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'فشل حفظ إعدادات الإحالات',
    });
  }
});

// ==========================================
// Games Hub & Plinko Endpoints
// ==========================================

const GAME_BET_AMOUNTS = [
  500,
  1000,
  2500,
  5000,
  10000,
  25000,
  50000,
  100000,
  250000,
  500000,
  750000,
  1000000,
] as const;

// 0. Global Games Hub Configuration (Shared across all games)
app.get('/api/games/config', (_req: Request, res: Response) => {
  const appSettings = getAppSettings();
  const gameSettings = getGamesSettings();
  return res.json({
    success: true,
    gamesEnabled: appSettings.gamesEnabled,
    storeEnabled: appSettings.storeEnabled,
    maintenanceGames: gameSettings.maintenanceGames || {},
    betAmounts: [...GAME_BET_AMOUNTS],
    minBet: GAME_BET_AMOUNTS[0],
    maxBet: GAME_BET_AMOUNTS[GAME_BET_AMOUNTS.length - 1],
  });
});

// 1. Get Plinko Board Configuration
app.get('/api/games/plinko/config', (_req: Request, res: Response) => {
  const appSettings = getAppSettings();
  const gameSettings = getGamesSettings();
  const maintenance = getGameMaintenanceStatus('plinko');
  return res.json({
    success: true,
    gamesEnabled: appSettings.gamesEnabled,
    maintenance,
    rows: PLINKO_ROWS,
    multipliers: buildPlinkoMultipliersForLevel(gameSettings.plinkoProfitLevel),
    betAmounts: [...GAME_BET_AMOUNTS],
    minBet: GAME_BET_AMOUNTS[0],
    maxBet: GAME_BET_AMOUNTS[GAME_BET_AMOUNTS.length - 1],
  });
});

// 2. Play Plinko (Server-authoritative coin deduction, weighted slot outcome, and payout)
app.post('/api/games/plinko/play', async (req: Request, res: Response) => {
  try {
    const maintenance = getGameMaintenanceStatus('plinko');
    if (maintenance.enabled) {
      return res.status(503).json({
        success: false,
        code: 'GAME_MAINTENANCE',
        maintenance,
        message: maintenance.reasonAr || 'لعبة Plinko قيد الصيانة والتطوير حالياً',
      });
    }
    if (!getAppSettings().gamesEnabled) {
      return res.status(403).json({
        success: false,
        code: 'SECTION_DISABLED',
        message: 'قسم الألعاب معطّل حالياً من قبل الإدارة',
      });
    }
    const authHeader = (req.headers['authorization'] as string) || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

    const rawBet = Number(req.body?.betAmount);
    const betAmount = Math.floor(rawBet);
    if (!Number.isFinite(rawBet) || !(GAME_BET_AMOUNTS as readonly number[]).includes(betAmount)) {
      return res.status(400).json({
        success: false,
        message: 'قيمة الرهان غير صالحة (المتاح من 500 إلى 1,000,000 Coin)',
      });
    }

    // Identify player securely via session token first, fallback to userId/displayId/email
    let lookupUserId = req.body?.userId ? String(req.body.userId).trim() : '';
    let lookupDisplayId = req.body?.displayId ? String(req.body.displayId).trim() : '';
    let lookupEmail = req.body?.email ? String(req.body.email).trim().toLowerCase() : '';

    if (bearerToken) {
      const session = getStoredSessions().find(
        (s) => s.token === bearerToken || s.refreshToken === bearerToken
      );
      if (session) {
        lookupUserId = session.userId || lookupUserId;
        lookupEmail = session.email?.toLowerCase() || lookupEmail;
      }
    }

    if (!lookupUserId && !lookupDisplayId && !lookupEmail) {
      return res.status(401).json({
        success: false,
        message: 'يجب تسجيل الدخول للعب باستخدام رصيد الكوينز',
      });
    }

    const users = getStoredUsers();
    let userIndex = users.findIndex(
      (u) =>
        (lookupUserId && (u.id === lookupUserId || u.displayId === lookupUserId)) ||
        (lookupDisplayId && (u.displayId === lookupDisplayId || u.id === lookupDisplayId)) ||
        (lookupEmail && u.email?.toLowerCase() === lookupEmail)
    );

    // Fallback: check Neon or Admin accounts if not yet present in local users.json
    const adminEmails = getAdminEmails();
    const isAdminUser =
      (lookupEmail && adminEmails.includes(lookupEmail)) ||
      lookupUserId === 'admin-1001' ||
      lookupUserId === 'admin-1002';

    if (userIndex === -1 && neonPool) {
      const neonProf = await getNeonProfileByIdentifier(lookupUserId || lookupDisplayId || lookupEmail).catch(() => null);
      if (neonProf) {
        const hydrated: StoredUser = {
          id: neonProf.id,
          displayId: neonProf.displayId || neonProf.display_id || generateSoulXId(),
          email: (neonProf.email || lookupEmail || '').toLowerCase(),
          name: neonProf.name || 'Soul-X User',
          passwordHash: neonProf.password_hash || '',
          createdAt: neonProf.created_at || new Date().toISOString(),
          birthDate: neonProf.birth_date || null,
          gender: neonProf.gender || null,
          walletBalance: parseDbNumber(neonProf.wallet_balance, isAdminUser ? 99999 : 0),
          coinsBalance: parseDbNumber(neonProf.coins_balance, isAdminUser ? 100000 : 0),
        };
        users.push(hydrated);
        userIndex = users.length - 1;
        saveStoredUsers(users);
      }
    }

    if (userIndex === -1 && isAdminUser) {
      const admin1Email = (process.env.ADMIN1 || '').trim().toLowerCase();
      const isAdmin1 = Boolean(admin1Email && lookupEmail === admin1Email) || lookupUserId === 'admin-1001';
      const createdAdmin: StoredUser = {
        id: lookupUserId || (isAdmin1 ? 'admin-1001' : 'admin-1002'),
        displayId: isAdmin1 ? '1' : '2',
        email: lookupEmail || (isAdmin1 ? 'abojafar@soul-x.com' : 'abohaidar@soul-x.com'),
        name: isAdmin1 ? 'مدير النظام (ADMIN1)' : 'مدير النظام (ADMIN2)',
        passwordHash: '',
        createdAt: new Date().toISOString(),
        birthDate: '1995-01-01',
        gender: 'male',
        walletBalance: 99999,
        coinsBalance: 100000,
      };
      users.push(createdAdmin);
      userIndex = users.length - 1;
      saveStoredUsers(users);
    }

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'لم يتم العثور على حساب المستخدم',
      });
    }

    const user = users[userIndex];

    // Check ban / active freeze
    const nowMs = Date.now();
    const freezeExpiresMs = user.freezeExpiresAt ? new Date(user.freezeExpiresAt).getTime() : 0;
    if (user.isBanned || (user.isFrozen && freezeExpiresMs > nowMs)) {
      return res.status(403).json({
        success: false,
        message: 'حسابك مقيد حالياً ولا يمكنه اللعب',
      });
    }

    const userIsAdmin =
      isAdminUser || (user.email ? adminEmails.includes(user.email.toLowerCase()) : false);
    let currentCoins =
      typeof user.coinsBalance === 'number'
        ? user.coinsBalance
        : userIsAdmin
        ? 100000
        : 0;

    if (neonPool) {
      const neonProf = await getNeonProfileByIdentifier(user.id || user.email).catch(() => null);
      if (neonProf) {
        const dbCoins = parseOptionalDbNumber(neonProf.coins_balance);
        if (dbCoins !== null) {
          currentCoins = dbCoins;
          if (user.coinsBalance !== dbCoins) {
            user.coinsBalance = dbCoins;
            saveStoredUsers(users);
          }
        }
      }
    }

    if (currentCoins < betAmount) {
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_COINS',
        currentCoins,
        message: 'رصيد الكوينز غير كافٍ لإجراء هذا الرهان',
      });
    }

    const gameSettings = getGamesSettings();
    const plinkoLevel = gameSettings.absoluteStopProfit ? 0 : clampProfitLevel(gameSettings.plinkoProfitLevel);
    const decision = evaluateSmartGameDecision(user.id, 'plinko', betAmount, plinkoLevel, gameSettings.algorithm, currentCoins);
    const outcome = pickPlinkoOutcome(plinkoLevel, decision);
    const payout = decision.forceZeroPayout ? 0 : Math.max(0, Math.round(betAmount * outcome.multiplier));
    const netProfit = payout - betAmount;
    const newCoinsBalance = Math.max(0, currentCoins - betAmount + payout);

    user.coinsBalance = newCoinsBalance;
    user.updatedAt = new Date().toISOString();
    users[userIndex] = user;
    saveStoredUsers(users);

    recordPlayerGameOutcome(user.id, 'Plinko', betAmount, payout, outcome.multiplier, decision.reason);

    await updateNeonProfileByIdentifier(user.id || user.displayId || user.email, {
      coins_balance: newCoinsBalance,
      updated_at: user.updatedAt,
    }).catch(() => {});

    return res.json({
      success: true,
      betAmount,
      multiplier: outcome.multiplier,
      targetSlot: outcome.targetSlot,
      path: outcome.path,
      multipliers: buildPlinkoMultipliersForLevel(plinkoLevel),
      payout,
      netProfit,
      previousCoinsBalance: currentCoins,
      newCoinsBalance,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء تشغيل لعبة Plinko',
    });
  }
});

// ==========================================
// Mines Game Engine & Active Rounds Store
// ==========================================
interface MinesRound {
  roundId: string;
  userId: string;
  betAmount: number;
  minesCount: number;
  revealedIndices: number[];
  currentMultiplier: number;
  status: 'active' | 'busted' | 'cashed_out';
  mineIndices?: number[];
  smartDecision?: SmartGameDecision;
  maxSafeClicksAllowed?: number;
  createdAtMs: number;
}

const activeMinesRounds = new Map<string, MinesRound>();
const activeMinesRoundByUser = new Map<string, string>();

function cleanupExpiredMinesRounds() {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, round] of activeMinesRounds.entries()) {
    if (round.createdAtMs < cutoff && round.status !== 'active') {
      activeMinesRounds.delete(id);
    }
  }
}

function calculateMinesMultiplier(minesCount: number, safeRevealedCount: number): number {
  if (safeRevealedCount <= 0) return 1;
  const safeTotal = MINES_GRID_SIZE - minesCount;
  if (safeRevealedCount > safeTotal) return 1;
  let mult = 0.97; // 3% house edge
  for (let i = 0; i < safeRevealedCount; i++) {
    mult *= (MINES_GRID_SIZE - i) / (safeTotal - i);
  }
  return Math.max(1.01, Math.round(mult * 100) / 100);
}

function generateRemainingMines(
  revealedIndices: number[],
  minesCount: number,
  forcedMineTile?: number
): number[] {
  const revealedSet = new Set(revealedIndices);
  const candidates: number[] = [];
  for (let i = 0; i < MINES_GRID_SIZE; i++) {
    if (!revealedSet.has(i) && i !== forcedMineTile) {
      candidates.push(i);
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = candidates[i];
    candidates[i] = candidates[j];
    candidates[j] = tmp;
  }
  const result: number[] = [];
  if (typeof forcedMineTile === 'number') {
    result.push(forcedMineTile);
  }
  for (const idx of candidates) {
    if (result.length >= minesCount) break;
    result.push(idx);
  }
  return result.sort((a, b) => a - b);
}

function pickMinesTileIsBomb(
  remainingUnopened: number,
  minesCount: number,
  profitLevel: number
): boolean {
  if (remainingUnopened <= minesCount) return true;
  const level = clampProfitLevel(profitLevel);
  if (level <= 0) return true; // Level 0 = zero profit for players
  const baseProb = minesCount / remainingUnopened;
  let adjustedProb = baseProb;
  if (level < 5) {
    const riskFactor = 1 + ((5 - level) / 5) * 0.9;
    adjustedProb = Math.min(0.95, baseProb * riskFactor);
  } else if (level > 5) {
    const safeBoost = 1 - ((level - 5) / 5) * 0.82;
    adjustedProb = Math.max(0.01, baseProb * Math.max(0.18, safeBoost));
  }
  return Math.random() < adjustedProb;
}

async function resolvePlayerAccountForGames(req: Request): Promise<
  | { ok: true; users: StoredUser[]; userIndex: number; user: StoredUser; currentCoins: number }
  | { ok: false; status: number; code?: string; message: string }
> {
  const authHeader = (req.headers['authorization'] as string) || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

  let lookupUserId = req.body?.userId ? String(req.body.userId).trim() : '';
  let lookupDisplayId = req.body?.displayId ? String(req.body.displayId).trim() : '';
  let lookupEmail = req.body?.email ? String(req.body.email).trim().toLowerCase() : '';

  if (!lookupUserId && typeof req.query?.userId === 'string') lookupUserId = req.query.userId.trim();
  if (!lookupDisplayId && typeof req.query?.displayId === 'string') lookupDisplayId = req.query.displayId.trim();
  if (!lookupEmail && typeof req.query?.email === 'string') lookupEmail = req.query.email.trim().toLowerCase();

  if (bearerToken) {
    const session = getStoredSessions().find(
      (s) => s.token === bearerToken || s.refreshToken === bearerToken
    );
    if (session) {
      lookupUserId = session.userId || lookupUserId;
      lookupEmail = session.email?.toLowerCase() || lookupEmail;
    }
  }

  if (!lookupUserId && !lookupDisplayId && !lookupEmail) {
    return {
      ok: false,
      status: 401,
      message: 'يجب تسجيل الدخول للعب باستخدام رصيد الكوينز',
    };
  }

  const users = getStoredUsers();
  let userIndex = users.findIndex(
    (u) =>
      (lookupUserId && (u.id === lookupUserId || u.displayId === lookupUserId)) ||
      (lookupDisplayId && (u.displayId === lookupDisplayId || u.id === lookupDisplayId)) ||
      (lookupEmail && u.email?.toLowerCase() === lookupEmail)
  );

  const adminEmails = getAdminEmails();
  const isAdminUser =
    (lookupEmail && adminEmails.includes(lookupEmail)) ||
    lookupUserId === 'admin-1001' ||
    lookupUserId === 'admin-1002';

  if (userIndex === -1 && neonPool) {
    const neonProf = await getNeonProfileByIdentifier(
      lookupUserId || lookupDisplayId || lookupEmail
    ).catch(() => null);
    if (neonProf) {
      const hydrated: StoredUser = {
        id: neonProf.id,
        displayId: neonProf.displayId || neonProf.display_id || generateSoulXId(),
        email: (neonProf.email || lookupEmail || '').toLowerCase(),
        name: neonProf.name || 'Soul-X User',
        passwordHash: neonProf.password_hash || '',
        createdAt: neonProf.created_at || new Date().toISOString(),
        birthDate: neonProf.birth_date || null,
        gender: neonProf.gender || null,
        walletBalance: parseDbNumber(neonProf.wallet_balance, isAdminUser ? 99999 : 0),
        coinsBalance: parseDbNumber(neonProf.coins_balance, isAdminUser ? 100000 : 0),
      };
      users.push(hydrated);
      userIndex = users.length - 1;
      saveStoredUsers(users);
    }
  }

  if (userIndex === -1 && isAdminUser) {
    const admin1Email = (process.env.ADMIN1 || '').trim().toLowerCase();
    const isAdmin1 =
      Boolean(admin1Email && lookupEmail === admin1Email) || lookupUserId === 'admin-1001';
    const createdAdmin: StoredUser = {
      id: lookupUserId || (isAdmin1 ? 'admin-1001' : 'admin-1002'),
      displayId: isAdmin1 ? '1' : '2',
      email: lookupEmail || (isAdmin1 ? 'abojafar@soul-x.com' : 'abohaidar@soul-x.com'),
      name: isAdmin1 ? 'مدير النظام (ADMIN1)' : 'مدير النظام (ADMIN2)',
      passwordHash: '',
      createdAt: new Date().toISOString(),
      birthDate: '1995-01-01',
      gender: 'male',
      walletBalance: 99999,
      coinsBalance: 100000,
    };
    users.push(createdAdmin);
    userIndex = users.length - 1;
    saveStoredUsers(users);
  }

  if (userIndex === -1) {
    return {
      ok: false,
      status: 404,
      message: 'لم يتم العثور على حساب المستخدم',
    };
  }

  const user = users[userIndex];
  const nowMs = Date.now();
  const freezeExpiresMs = user.freezeExpiresAt ? new Date(user.freezeExpiresAt).getTime() : 0;
  if (user.isBanned || (user.isFrozen && freezeExpiresMs > nowMs)) {
    return {
      ok: false,
      status: 403,
      message: 'حسابك مقيد حالياً ولا يمكنه اللعب',
    };
  }

  const userIsAdmin =
    isAdminUser || (user.email ? adminEmails.includes(user.email.toLowerCase()) : false);
  let currentCoins =
    typeof user.coinsBalance === 'number'
      ? user.coinsBalance
      : userIsAdmin
      ? 100000
      : 0;

  if (neonPool) {
    const neonProf = await getNeonProfileByIdentifier(user.id || user.email).catch(() => null);
    if (neonProf) {
      const dbCoins = parseOptionalDbNumber(neonProf.coins_balance);
      if (dbCoins !== null) {
        currentCoins = dbCoins;
        if (user.coinsBalance !== dbCoins) {
          user.coinsBalance = dbCoins;
          saveStoredUsers(users);
        }
      }
    }
  }

  return { ok: true, users, userIndex, user, currentCoins };
}

// 2b. Mines Config
app.get('/api/games/mines/config', (_req: Request, res: Response) => {
  const appSettings = getAppSettings();
  const maintenance = getGameMaintenanceStatus('mines');
  return res.json({
    success: true,
    gamesEnabled: appSettings.gamesEnabled,
    maintenance,
    gridSize: MINES_GRID_SIZE,
    minesOptions: [...MINES_COUNT_OPTIONS],
    betAmounts: [...GAME_BET_AMOUNTS],
    minBet: GAME_BET_AMOUNTS[0],
    maxBet: GAME_BET_AMOUNTS[GAME_BET_AMOUNTS.length - 1],
  });
});

// 2c. Mines Active Round Resume
app.get('/api/games/mines/active', async (req: Request, res: Response) => {
  try {
    if (!getAppSettings().gamesEnabled || getGameMaintenanceStatus('mines').enabled) {
      return res.json({ success: true, activeRound: null });
    }
    const resolved = await resolvePlayerAccountForGames(req);
    if (!resolved.ok) {
      return res.json({ success: true, activeRound: null });
    }
    const existingId = activeMinesRoundByUser.get(resolved.user.id);
    const round = existingId ? activeMinesRounds.get(existingId) : undefined;
    if (!round || round.status !== 'active') {
      return res.json({ success: true, activeRound: null });
    }
    const nextMultiplier = calculateMinesMultiplier(
      round.minesCount,
      round.revealedIndices.length + 1
    );
    const currentPayout =
      round.revealedIndices.length > 0
        ? Math.round(round.betAmount * round.currentMultiplier)
        : 0;
    return res.json({
      success: true,
      activeRound: {
        roundId: round.roundId,
        betAmount: round.betAmount,
        minesCount: round.minesCount,
        revealedIndices: round.revealedIndices,
        currentMultiplier: round.currentMultiplier,
        nextMultiplier,
        currentPayout,
        nextPayout: Math.round(round.betAmount * nextMultiplier),
        remainingSafe: MINES_GRID_SIZE - round.minesCount - round.revealedIndices.length,
      },
      coinsBalance: resolved.currentCoins,
    });
  } catch {
    return res.json({ success: true, activeRound: null });
  }
});

// 2d. Start a Mines Round
app.post('/api/games/mines/start', async (req: Request, res: Response) => {
  try {
    const maintenance = getGameMaintenanceStatus('mines');
    if (maintenance.enabled) {
      return res.status(503).json({
        success: false,
        code: 'GAME_MAINTENANCE',
        maintenance,
        message: maintenance.reasonAr || 'لعبة Mines قيد الصيانة والتطوير حالياً',
      });
    }
    if (!getAppSettings().gamesEnabled) {
      return res.status(403).json({
        success: false,
        code: 'SECTION_DISABLED',
        message: 'قسم الألعاب معطّل حالياً من قبل الإدارة',
      });
    }

    const rawBet = Number(req.body?.betAmount);
    const betAmount = Math.floor(rawBet);
    if (!Number.isFinite(rawBet) || !(GAME_BET_AMOUNTS as readonly number[]).includes(betAmount)) {
      return res.status(400).json({
        success: false,
        message: 'قيمة الرهان غير صالحة (المتاح من 500 إلى 1,000,000 Coin)',
      });
    }

    const rawMines = Number(req.body?.minesCount);
    const minesCount = Math.floor(rawMines);
    if (!Number.isFinite(rawMines) || !(MINES_COUNT_OPTIONS as readonly number[]).includes(minesCount)) {
      return res.status(400).json({
        success: false,
        message: 'عدد الألغام المختار غير صالح',
      });
    }

    const resolved = await resolvePlayerAccountForGames(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({
        success: false,
        code: resolved.code,
        message: resolved.message,
      });
    }

    const { users, userIndex, user, currentCoins } = resolved;

    // Prevent starting a new round if one is already active for this player
    const existingRoundId = activeMinesRoundByUser.get(user.id);
    const existingRound = existingRoundId ? activeMinesRounds.get(existingRoundId) : undefined;
    if (existingRound && existingRound.status === 'active') {
      const nextMult = calculateMinesMultiplier(
        existingRound.minesCount,
        existingRound.revealedIndices.length + 1
      );
      return res.status(409).json({
        success: false,
        code: 'ACTIVE_ROUND_EXISTS',
        message: 'لديك جولة قائمة بالفعل، أكملها أو اسحب أرباحك أولاً',
        activeRound: {
          roundId: existingRound.roundId,
          betAmount: existingRound.betAmount,
          minesCount: existingRound.minesCount,
          revealedIndices: existingRound.revealedIndices,
          currentMultiplier: existingRound.currentMultiplier,
          nextMultiplier: nextMult,
          currentPayout:
            existingRound.revealedIndices.length > 0
              ? Math.round(existingRound.betAmount * existingRound.currentMultiplier)
              : 0,
          nextPayout: Math.round(existingRound.betAmount * nextMult),
          remainingSafe:
            MINES_GRID_SIZE - existingRound.minesCount - existingRound.revealedIndices.length,
        },
        coinsBalance: currentCoins,
      });
    }

    if (currentCoins < betAmount) {
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_COINS',
        currentCoins,
        message: 'رصيد الكوينز غير كافٍ لإجراء هذا الرهان',
      });
    }

    cleanupExpiredMinesRounds();

    const newCoinsBalance = Math.max(0, currentCoins - betAmount);
    user.coinsBalance = newCoinsBalance;
    user.updatedAt = new Date().toISOString();
    users[userIndex] = user;
    saveStoredUsers(users);

    await updateNeonProfileByIdentifier(user.id || user.displayId || user.email, {
      coins_balance: newCoinsBalance,
      updated_at: user.updatedAt,
    }).catch(() => {});

    const gameSettings = getGamesSettings();
    const minesLevel = gameSettings.absoluteStopProfit ? 0 : clampProfitLevel(gameSettings.minesProfitLevel);
    const decision = evaluateSmartGameDecision(user.id, 'mines', betAmount, minesLevel, gameSettings.algorithm, currentCoins);
    let maxSafeClicksAllowed = MINES_GRID_SIZE - minesCount;
    if (!decision.useClassicLevel) {
      if (!decision.allowWin || decision.forceZeroPayout) {
        maxSafeClicksAllowed = 0;
      } else {
        const capToUse = decision.targetMultiplierHint
          ? Math.max(decision.maxMultiplierCap, decision.targetMultiplierHint)
          : decision.maxMultiplierCap;
        let allowedClicks = 0;
        const maxPossible = MINES_GRID_SIZE - minesCount;
        for (let k = 1; k <= maxPossible; k++) {
          if (calculateMinesMultiplier(minesCount, k) <= capToUse) {
            allowedClicks = k;
          } else {
            break;
          }
        }
        maxSafeClicksAllowed = Math.max(1, allowedClicks);
      }
    }

    const roundId = `mines_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const round: MinesRound = {
      roundId,
      userId: user.id,
      betAmount,
      minesCount,
      revealedIndices: [],
      currentMultiplier: 1,
      status: 'active',
      smartDecision: decision,
      maxSafeClicksAllowed,
      createdAtMs: Date.now(),
    };

    activeMinesRounds.set(roundId, round);
    activeMinesRoundByUser.set(user.id, roundId);

    const nextMultiplier = calculateMinesMultiplier(minesCount, 1);

    return res.json({
      success: true,
      roundId,
      betAmount,
      minesCount,
      revealedIndices: [],
      currentMultiplier: 1,
      nextMultiplier,
      currentPayout: 0,
      nextPayout: Math.round(betAmount * nextMultiplier),
      remainingSafe: MINES_GRID_SIZE - minesCount,
      newCoinsBalance,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء بدء لعبة Mines',
    });
  }
});

// 2e. Reveal a Tile in Mines
app.post('/api/games/mines/reveal', async (req: Request, res: Response) => {
  try {
    const maintenance = getGameMaintenanceStatus('mines');
    if (maintenance.enabled) {
      return res.status(503).json({
        success: false,
        code: 'GAME_MAINTENANCE',
        maintenance,
        message: maintenance.reasonAr || 'لعبة Mines قيد الصيانة والتطوير حالياً',
      });
    }
    if (!getAppSettings().gamesEnabled) {
      return res.status(403).json({
        success: false,
        code: 'SECTION_DISABLED',
        message: 'قسم الألعاب معطّل حالياً من قبل الإدارة',
      });
    }

    const roundId = req.body?.roundId ? String(req.body.roundId).trim() : '';
    const tileIndex = Math.floor(Number(req.body?.tileIndex));
    if (!roundId || !Number.isInteger(tileIndex) || tileIndex < 0 || tileIndex >= MINES_GRID_SIZE) {
      return res.status(400).json({
        success: false,
        message: 'بيانات المربع غير صالحة',
      });
    }

    const resolved = await resolvePlayerAccountForGames(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({
        success: false,
        message: resolved.message,
      });
    }

    const { users, userIndex, user, currentCoins } = resolved;
    const round = activeMinesRounds.get(roundId);
    if (!round || round.userId !== user.id || round.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'انتهت هذه الجولة أو لم يتم العثور عليها',
      });
    }

    if (round.revealedIndices.includes(tileIndex)) {
      return res.status(400).json({
        success: false,
        message: 'تم كشف هذا المربع مسبقاً',
      });
    }

    const gameSettings = getGamesSettings();
    const minesLevel = gameSettings.absoluteStopProfit ? 0 : clampProfitLevel(gameSettings.minesProfitLevel);
    const remainingUnopened = MINES_GRID_SIZE - round.revealedIndices.length;
    const nextRevealMult = calculateMinesMultiplier(round.minesCount, round.revealedIndices.length + 1);
    const hitBomb =
      gameSettings.absoluteStopProfit ||
      minesLevel <= 0 ||
      (round.smartDecision && !round.smartDecision.useClassicLevel
        ? !round.smartDecision.allowWin ||
          round.revealedIndices.length >= (round.maxSafeClicksAllowed ?? 0) ||
          nextRevealMult > round.smartDecision.maxMultiplierCap
        : pickMinesTileIsBomb(
            remainingUnopened,
            round.minesCount,
            minesLevel
          ));

    if (hitBomb) {
      const mineIndices = generateRemainingMines(round.revealedIndices, round.minesCount, tileIndex);
      round.status = 'busted';
      round.mineIndices = mineIndices;
      activeMinesRoundByUser.delete(user.id);

      recordPlayerGameOutcome(
        user.id,
        'Mines',
        round.betAmount,
        0,
        0,
        round.smartDecision?.reason || 'mines_bomb'
      );

      return res.json({
        success: true,
        outcome: 'mine',
        roundId,
        tileIndex,
        revealedIndices: round.revealedIndices,
        mineIndices,
        betAmount: round.betAmount,
        minesCount: round.minesCount,
        multiplier: 0,
        payout: 0,
        netProfit: -round.betAmount,
        newCoinsBalance: currentCoins,
      });
    }

    // Safe gem tile
    round.revealedIndices.push(tileIndex);
    round.currentMultiplier = calculateMinesMultiplier(round.minesCount, round.revealedIndices.length);
    const totalSafe = MINES_GRID_SIZE - round.minesCount;
    const remainingSafe = totalSafe - round.revealedIndices.length;

    // Auto cash out if player cleared every safe tile on the board!
    if (remainingSafe <= 0) {
      const mineIndices = generateRemainingMines(round.revealedIndices, round.minesCount);
      const payout = Math.max(0, Math.round(round.betAmount * round.currentMultiplier));
      const newCoinsBalance = currentCoins + payout;

      user.coinsBalance = newCoinsBalance;
      user.updatedAt = new Date().toISOString();
      users[userIndex] = user;
      saveStoredUsers(users);

      await updateNeonProfileByIdentifier(user.id || user.displayId || user.email, {
        coins_balance: newCoinsBalance,
        updated_at: user.updatedAt,
      }).catch(() => {});

      round.status = 'cashed_out';
      round.mineIndices = mineIndices;
      activeMinesRoundByUser.delete(user.id);

      recordPlayerGameOutcome(
        user.id,
        'Mines',
        round.betAmount,
        payout,
        round.currentMultiplier,
        round.smartDecision?.reason || 'mines_cleared'
      );

      return res.json({
        success: true,
        outcome: 'cleared',
        roundId,
        tileIndex,
        revealedIndices: round.revealedIndices,
        mineIndices,
        betAmount: round.betAmount,
        minesCount: round.minesCount,
        multiplier: round.currentMultiplier,
        payout,
        netProfit: payout - round.betAmount,
        newCoinsBalance,
      });
    }

    const nextMultiplier = calculateMinesMultiplier(round.minesCount, round.revealedIndices.length + 1);
    const currentPayout = Math.round(round.betAmount * round.currentMultiplier);

    return res.json({
      success: true,
      outcome: 'gem',
      roundId,
      tileIndex,
      revealedIndices: round.revealedIndices,
      currentMultiplier: round.currentMultiplier,
      nextMultiplier,
      currentPayout,
      nextPayout: Math.round(round.betAmount * nextMultiplier),
      remainingSafe,
      newCoinsBalance: currentCoins,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء كشف المربع',
    });
  }
});

// 2f. Cash Out an Active Mines Round
app.post('/api/games/mines/cashout', async (req: Request, res: Response) => {
  try {
    const maintenance = getGameMaintenanceStatus('mines');
    if (maintenance.enabled) {
      return res.status(503).json({
        success: false,
        code: 'GAME_MAINTENANCE',
        maintenance,
        message: maintenance.reasonAr || 'لعبة Mines قيد الصيانة والتطوير حالياً',
      });
    }
    if (!getAppSettings().gamesEnabled) {
      return res.status(403).json({
        success: false,
        code: 'SECTION_DISABLED',
        message: 'قسم الألعاب معطّل حالياً من قبل الإدارة',
      });
    }

    const roundId = req.body?.roundId ? String(req.body.roundId).trim() : '';
    const resolved = await resolvePlayerAccountForGames(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({
        success: false,
        message: resolved.message,
      });
    }

    const { users, userIndex, user, currentCoins } = resolved;
    const round = activeMinesRounds.get(roundId);
    if (!round || round.userId !== user.id || round.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'لا توجد جولة نشطة لسحب أرباحها',
      });
    }

    if (round.revealedIndices.length < 1) {
      return res.status(400).json({
        success: false,
        message: 'اختر مربعاً آمناً واحداً على الأقل قبل سحب الأرباح',
      });
    }

    const gameSettings = getGamesSettings();
    const minesLevel = gameSettings.absoluteStopProfit ? 0 : clampProfitLevel(gameSettings.minesProfitLevel);

    if (gameSettings.absoluteStopProfit || minesLevel <= 0) {
      const mineIndices = generateRemainingMines(round.revealedIndices, round.minesCount);
      round.status = 'busted';
      round.mineIndices = mineIndices;
      activeMinesRoundByUser.delete(user.id);

      return res.json({
        success: true,
        outcome: 'mine',
        roundId,
        revealedIndices: round.revealedIndices,
        mineIndices,
        betAmount: round.betAmount,
        minesCount: round.minesCount,
        multiplier: 0,
        payout: 0,
        netProfit: -round.betAmount,
        newCoinsBalance: currentCoins,
      });
    }

    const mineIndices = generateRemainingMines(round.revealedIndices, round.minesCount);
    const payout = Math.max(0, Math.round(round.betAmount * round.currentMultiplier));
    const newCoinsBalance = currentCoins + payout;

    user.coinsBalance = newCoinsBalance;
    user.updatedAt = new Date().toISOString();
    users[userIndex] = user;
    saveStoredUsers(users);

    await updateNeonProfileByIdentifier(user.id || user.displayId || user.email, {
      coins_balance: newCoinsBalance,
      updated_at: user.updatedAt,
    }).catch(() => {});

    round.status = 'cashed_out';
    round.mineIndices = mineIndices;
    activeMinesRoundByUser.delete(user.id);

    recordPlayerGameOutcome(
      user.id,
      'Mines',
      round.betAmount,
      payout,
      round.currentMultiplier,
      round.smartDecision?.reason || 'mines_cashout'
    );

    return res.json({
      success: true,
      outcome: 'cashed_out',
      roundId,
      revealedIndices: round.revealedIndices,
      mineIndices,
      betAmount: round.betAmount,
      minesCount: round.minesCount,
      multiplier: round.currentMultiplier,
      payout,
      netProfit: payout - round.betAmount,
      newCoinsBalance,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء سحب أرباح Mines',
    });
  }
});

// ==========================================
// Dice Game Engine (Roll Over / Roll Under)
// ==========================================
function pickDiceOutcome(
  mode: 'over' | 'under',
  target: number,
  profitLevel: number,
  decision?: SmartGameDecision
): { roll: number; won: boolean; winChance: number; multiplier: number; effectiveReason: string } {
  const winChance = mode === 'over' ? 100 - target : target;
  const multiplier = Math.max(1.01, Math.round((97 / winChance) * 100) / 100);
  const level = clampProfitLevel(profitLevel);
  const baseWinProb = winChance / 100;

  let won = false;
  let effectiveReason = decision?.reason || 'classic_level';

  if (level <= 0) {
    won = false;
    effectiveReason = 'profit_level_zero';
  } else if (decision && !decision.useClassicLevel) {
    if (!decision.allowWin) {
      won = false;
    } else if (multiplier > decision.maxMultiplierCap) {
      won = false;
      effectiveReason = 'multiplier_cap_guard';
    } else {
      won = true;
    }
  } else {
    let effectiveWinProb = baseWinProb;
    if (level < 5) {
      const factor = 0.25 + (level / 5) * 0.75;
      effectiveWinProb = Math.max(0.01, baseWinProb * factor);
    } else if (level > 5) {
      const boost = ((level - 5) / 5) * 0.75;
      effectiveWinProb = Math.min(0.96, baseWinProb + (1 - baseWinProb) * boost);
    }
    won = Math.random() < effectiveWinProb;
  }

  let roll: number;
  if (won) {
    if (mode === 'over') {
      const minRoll = target + 0.01;
      roll = minRoll + Math.random() * Math.max(0.01, 99.99 - minRoll);
    } else {
      const maxRoll = Math.max(0, target - 0.01);
      roll = Math.random() * maxRoll;
    }
  } else {
    if (mode === 'over') {
      roll = Math.random() * target;
    } else {
      roll = target + Math.random() * Math.max(0.01, 99.99 - target);
    }
  }

  const roundedRoll = Math.max(0, Math.min(99.99, Math.round(roll * 100) / 100));
  return {
    roll: roundedRoll,
    won,
    winChance,
    multiplier,
    effectiveReason,
  };
}

// 2g. Dice Config
app.get('/api/games/dice/config', (_req: Request, res: Response) => {
  const appSettings = getAppSettings();
  const maintenance = getGameMaintenanceStatus('dice');
  return res.json({
    success: true,
    gamesEnabled: appSettings.gamesEnabled,
    maintenance,
    minTarget: DICE_MIN_TARGET,
    maxTarget: DICE_MAX_TARGET,
    houseEdgePercent: 3,
    betAmounts: [...GAME_BET_AMOUNTS],
    minBet: GAME_BET_AMOUNTS[0],
    maxBet: GAME_BET_AMOUNTS[GAME_BET_AMOUNTS.length - 1],
  });
});

// 2h. Play Dice (Server-authoritative roll, multiplier, and balance update)
app.post('/api/games/dice/play', async (req: Request, res: Response) => {
  try {
    const maintenance = getGameMaintenanceStatus('dice');
    if (maintenance.enabled) {
      return res.status(503).json({
        success: false,
        code: 'GAME_MAINTENANCE',
        maintenance,
        message: maintenance.reasonAr || 'لعبة Dice قيد الصيانة والتطوير حالياً',
      });
    }
    if (!getAppSettings().gamesEnabled) {
      return res.status(403).json({
        success: false,
        code: 'SECTION_DISABLED',
        message: 'قسم الألعاب معطّل حالياً من قبل الإدارة',
      });
    }

    const rawBet = Number(req.body?.betAmount);
    const betAmount = Math.floor(rawBet);
    if (!Number.isFinite(rawBet) || !(GAME_BET_AMOUNTS as readonly number[]).includes(betAmount)) {
      return res.status(400).json({
        success: false,
        message: 'قيمة الرهان غير صالحة (المتاح من 500 إلى 1,000,000 Coin)',
      });
    }

    const mode: 'over' | 'under' = req.body?.mode === 'under' ? 'under' : 'over';
    const rawTarget = Number(req.body?.target);
    const target = Math.round(rawTarget);
    if (!Number.isFinite(rawTarget) || target < DICE_MIN_TARGET || target > DICE_MAX_TARGET) {
      return res.status(400).json({
        success: false,
        message: `الرقم المستهدف يجب أن يكون بين ${DICE_MIN_TARGET} و ${DICE_MAX_TARGET}`,
      });
    }

    const resolved = await resolvePlayerAccountForGames(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({
        success: false,
        code: resolved.code,
        message: resolved.message,
      });
    }

    const { users, userIndex, user, currentCoins } = resolved;
    if (currentCoins < betAmount) {
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_COINS',
        currentCoins,
        message: 'رصيد الكوينز غير كافٍ لإجراء هذا الرهان',
      });
    }

    const gameSettings = getGamesSettings();
    const diceLevel = gameSettings.absoluteStopProfit ? 0 : clampProfitLevel(gameSettings.diceProfitLevel);
    const decision = evaluateSmartGameDecision(user.id, 'dice', betAmount, diceLevel, gameSettings.algorithm, currentCoins);
    const outcome = pickDiceOutcome(mode, target, diceLevel, decision);
    const payout =
      !gameSettings.absoluteStopProfit && diceLevel > 0 && outcome.won
        ? Math.max(0, Math.round(betAmount * outcome.multiplier))
        : 0;
    const netProfit = payout - betAmount;
    const newCoinsBalance = Math.max(0, currentCoins - betAmount + payout);

    user.coinsBalance = newCoinsBalance;
    user.updatedAt = new Date().toISOString();
    users[userIndex] = user;
    saveStoredUsers(users);

    recordPlayerGameOutcome(
      user.id,
      'Dice',
      betAmount,
      payout,
      outcome.won ? outcome.multiplier : 0,
      outcome.effectiveReason
    );

    await updateNeonProfileByIdentifier(user.id || user.displayId || user.email, {
      coins_balance: newCoinsBalance,
      updated_at: user.updatedAt,
    }).catch(() => {});

    return res.json({
      success: true,
      betAmount,
      mode,
      target,
      roll: outcome.roll,
      won: outcome.won,
      winChance: outcome.winChance,
      multiplier: outcome.multiplier,
      payout,
      netProfit,
      previousCoinsBalance: currentCoins,
      newCoinsBalance,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء تشغيل لعبة Dice',
    });
  }
});

// ==========================================
// Olympus Gates (Gates of Olympus Style) Engine & Endpoints
// ==========================================
export type OlympusSymbolId =
  | 'sapphire'
  | 'emerald'
  | 'topaz'
  | 'amethyst'
  | 'ruby'
  | 'chalice'
  | 'ring'
  | 'hourglass'
  | 'crown'
  | 'zeus';

const OLYMPUS_COLS = 6;
const OLYMPUS_ROWS = 5;
const OLYMPUS_CELLS = OLYMPUS_COLS * OLYMPUS_ROWS; // 30

const OLYMPUS_PAYTABLE: Record<
  Exclude<OlympusSymbolId, 'zeus'>,
  { m8: number; m10: number; m12: number }
> = {
  sapphire: { m8: 0.25, m10: 0.55, m12: 1.2 },
  emerald: { m8: 0.3, m10: 0.65, m12: 1.5 },
  topaz: { m8: 0.35, m10: 0.8, m12: 1.8 },
  amethyst: { m8: 0.4, m10: 0.9, m12: 2.2 },
  ruby: { m8: 0.5, m10: 1.1, m12: 2.6 },
  chalice: { m8: 0.7, m10: 1.6, m12: 3.8 },
  ring: { m8: 0.9, m10: 2.2, m12: 5.0 },
  hourglass: { m8: 1.2, m10: 3.0, m12: 7.5 },
  crown: { m8: 1.8, m10: 4.5, m12: 12.0 },
};

const OLYMPUS_REGULAR_SYMBOLS: readonly Exclude<OlympusSymbolId, 'zeus'>[] = [
  'sapphire',
  'emerald',
  'topaz',
  'amethyst',
  'ruby',
  'chalice',
  'ring',
  'hourglass',
  'crown',
];

const OLYMPUS_BASE_WEIGHTS: { id: OlympusSymbolId; weight: number }[] = [
  { id: 'sapphire', weight: 18 },
  { id: 'emerald', weight: 16 },
  { id: 'topaz', weight: 15 },
  { id: 'amethyst', weight: 14 },
  { id: 'ruby', weight: 12 },
  { id: 'chalice', weight: 8 },
  { id: 'ring', weight: 6 },
  { id: 'hourglass', weight: 5 },
  { id: 'crown', weight: 4 },
  { id: 'zeus', weight: 2.2 },
];

const OLYMPUS_MULTIPLIER_VALUES = [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 50, 100] as const;

interface OlympusOrb {
  index: number;
  multiplier: number;
}

interface OlympusCascadeStep {
  grid: OlympusSymbolId[];
  winningIndices: number[];
  matchedGroups: { symbol: OlympusSymbolId; count: number; win: number }[];
  orbs: OlympusOrb[];
  stepWin: number;
}

interface OlympusFreeSpinsState {
  remainingSpins: number;
  betAmount: number;
  accumulatedMultiplier: number;
  totalBonusWin: number;
  updatedAtMs: number;
}

const activeOlympusFreeSpins = new Map<string, OlympusFreeSpinsState>();

function pickWeightedOlympusSymbol(
  counts: Record<string, number>,
  allowScatter: boolean,
  maxRegularCount = 14,
  maxScatterCount = 6
): OlympusSymbolId {
  const pool = OLYMPUS_BASE_WEIGHTS.filter((item) => {
    const c = counts[item.id] || 0;
    if (item.id === 'zeus') {
      return allowScatter && c < maxScatterCount;
    }
    return c < maxRegularCount;
  });
  const total = pool.reduce((acc, item) => acc + item.weight, 0);
  if (total <= 0) return 'sapphire';
  let r = Math.random() * total;
  for (const item of pool) {
    r -= item.weight;
    if (r <= 0) return item.id;
  }
  return pool[0].id;
}

function generateNonWinningOlympusGrid(): OlympusSymbolId[] {
  // Strictly < 8 of each regular symbol and < 4 zeus scatters across 30 cells
  const grid: OlympusSymbolId[] = [];
  const counts: Record<string, number> = {};
  for (let i = 0; i < OLYMPUS_CELLS; i++) {
    const allowed = OLYMPUS_REGULAR_SYMBOLS.filter((sym) => (counts[sym] || 0) < 7);
    const sym = allowed[Math.floor(Math.random() * allowed.length)] || 'sapphire';
    grid.push(sym);
    counts[sym] = (counts[sym] || 0) + 1;
  }
  // Sprinkle up to 2 zeus scatters harmlessly
  const scatterSlots = Math.random() < 0.35 ? 2 : Math.random() < 0.65 ? 1 : 0;
  for (let s = 0; s < scatterSlots; s++) {
    const idx = Math.floor(Math.random() * OLYMPUS_CELLS);
    grid[idx] = 'zeus';
  }
  // Final safety check
  const verify: Record<string, number> = {};
  for (const s of grid) verify[s] = (verify[s] || 0) + 1;
  for (const sym of OLYMPUS_REGULAR_SYMBOLS) {
    if ((verify[sym] || 0) >= 8) {
      return generateNonWinningOlympusGrid();
    }
  }
  if ((verify.zeus || 0) >= 4) {
    for (let i = 0; i < grid.length && (verify.zeus || 0) >= 4; i++) {
      if (grid[i] === 'zeus') {
        const replacement = OLYMPUS_REGULAR_SYMBOLS.find((r) => (verify[r] || 0) < 6) || 'sapphire';
        grid[i] = replacement;
        verify.zeus -= 1;
        verify[replacement] = (verify[replacement] || 0) + 1;
      }
    }
  }
  return grid;
}

function buildClusteredOlympusGrid(
  profitLevel: number,
  anteBet: boolean,
  isFreeSpin: boolean
): OlympusSymbolId[] {
  const grid: OlympusSymbolId[] = new Array(OLYMPUS_CELLS);
  const counts: Record<string, number> = {};

  // Higher profit levels increase cluster probability & high-tier relic probability
  const levelNorm = Math.max(0, Math.min(10, profitLevel)) / 10;
  const wantWinProb = isFreeSpin
    ? 0.38 + levelNorm * 0.36
    : 0.16 + levelNorm * 0.44 + (anteBet ? 0.04 : 0);

  if (Math.random() > wantWinProb) {
    return generateNonWinningOlympusGrid();
  }

  // Pick a winning symbol biased by profit level
  const highTierBias = levelNorm * 0.55;
  const candidatePool =
    Math.random() < highTierBias
      ? (['chalice', 'ring', 'hourglass', 'crown'] as const)
      : (['sapphire', 'emerald', 'topaz', 'amethyst', 'ruby'] as const);
  const targetSym = candidatePool[Math.floor(Math.random() * candidatePool.length)];
  const clusterSize =
    Math.random() < 0.14 + levelNorm * 0.18
      ? 12 + Math.floor(Math.random() * 2)
      : Math.random() < 0.38
      ? 10 + Math.floor(Math.random() * 2)
      : 8 + Math.floor(Math.random() * 2);

  // Place cluster randomly on the 30-cell grid
  const positions = Array.from({ length: OLYMPUS_CELLS }, (_, idx) => idx);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  for (let k = 0; k < clusterSize; k++) {
    grid[positions[k]] = targetSym;
    counts[targetSym] = (counts[targetSym] || 0) + 1;
  }

  // Optionally inject Zeus Scatters (if profitLevel >= 2)
  const scatterTriggerChance =
    profitLevel < 2
      ? 0
      : (isFreeSpin ? 0.035 : anteBet ? 0.055 : 0.03) * (0.5 + levelNorm);
  if (Math.random() < scatterTriggerChance) {
    const desiredScatters = Math.random() < 0.15 ? 5 : 4;
    let placed = 0;
    for (let k = clusterSize; k < positions.length && placed < desiredScatters; k++) {
      grid[positions[k]] = 'zeus';
      counts.zeus = (counts.zeus || 0) + 1;
      placed++;
    }
  }

  // Fill remaining cells
  for (let i = 0; i < OLYMPUS_CELLS; i++) {
    if (!grid[i]) {
      const sym = pickWeightedOlympusSymbol(counts, !isFreeSpin && profitLevel >= 2, 11, 3);
      grid[i] = sym;
      counts[sym] = (counts[sym] || 0) + 1;
    }
  }

  return grid;
}

function pickOlympusMultiplierOrbValue(profitLevel: number, isFreeSpin: boolean): number {
  const norm = Math.max(0, Math.min(10, profitLevel)) / 10;
  const r = Math.random();
  if (norm >= 0.7 || isFreeSpin) {
    if (r < 0.02 * norm) return 100;
    if (r < 0.06 * norm) return 50;
    if (r < 0.14) return 25;
    if (r < 0.24) return 15;
    if (r < 0.38) return 10;
    if (r < 0.56) return 8;
    if (r < 0.72) return 5;
    if (r < 0.86) return 3;
    return 2;
  }
  if (r < 0.02 * norm) return 25;
  if (r < 0.08) return 15;
  if (r < 0.18) return 10;
  if (r < 0.34) return 6;
  if (r < 0.52) return 5;
  if (r < 0.7) return 4;
  if (r < 0.85) return 3;
  return 2;
}

function generateOlympusSpin(
  betAmount: number,
  profitLevel: number,
  anteBet: boolean,
  isFreeSpin: boolean,
  existingAccumulatedMult: number,
  decision?: SmartGameDecision
) {
  const normalizedLevel = clampProfitLevel(profitLevel);
  // Strict Level 0 / Absolute Stop Profit / Loss decision: zero payout, zero free spins
  if (normalizedLevel <= 0 || decision?.forceZeroPayout || (decision && !decision.useClassicLevel && !decision.allowWin)) {
    const losingGrid = generateNonWinningOlympusGrid();
    // Subtle near-miss visual (7 of 1 symbol = 1 shy of 8-of-a-kind payout) when AI wants near-win feeling
    if (!decision?.forceZeroPayout && normalizedLevel > 0 && decision?.nearMissVisual && Math.random() < 0.55) {
      const teaseSym: OlympusSymbolId = 'crown';
      let replaced = 0;
      const countTease = losingGrid.filter((s) => s === teaseSym).length;
      for (let i = 0; i < losingGrid.length && countTease + replaced < 7; i++) {
        if (losingGrid[i] !== teaseSym && losingGrid[i] !== 'zeus') {
          losingGrid[i] = teaseSym;
          replaced++;
        }
      }
    }
    return {
      steps: [
        {
          grid: losingGrid,
          winningIndices: [],
          matchedGroups: [],
          orbs: [],
          stepWin: 0,
        },
      ] as OlympusCascadeStep[],
      baseWin: 0,
      roundOrbMultiplier: 0,
      appliedMultiplier: 1,
      scatterCount: losingGrid.filter((s) => s === 'zeus').length,
      scatterBonus: 0,
      freeSpinsAwarded: 0,
      totalPayout: 0,
    };
  }

  // If Smart Algorithm requested a controlled win, build a clean bounded winning spin <= maxMultiplierCap
  if (decision && !decision.useClassicLevel && decision.allowWin) {
    const maxCap = Math.max(1, decision.maxMultiplierCap);
    const grid = generateNonWinningOlympusGrid();
    const lowRelics: Exclude<OlympusSymbolId, 'zeus'>[] = ['sapphire', 'emerald', 'topaz', 'amethyst', 'ruby'];
    const allRelics: Exclude<OlympusSymbolId, 'zeus'>[] =
      decision.tier === 'small_win' ? lowRelics : [...lowRelics, 'chalice', 'ring', 'hourglass', 'crown'];
    const eligible = allRelics.filter((sym) => OLYMPUS_PAYTABLE[sym].m8 <= maxCap);
    let targetSym =
      eligible.length > 0
        ? eligible[Math.floor(Math.random() * eligible.length)]
        : 'sapphire';
    if (decision.targetMultiplierHint && eligible.length > 0) {
      const hint = decision.targetMultiplierHint;
      const sorted = [...eligible].sort(
        (a, b) => Math.abs(OLYMPUS_PAYTABLE[a].m8 - hint) - Math.abs(OLYMPUS_PAYTABLE[b].m8 - hint)
      );
      targetSym = sorted[0];
    }
    const pay = OLYMPUS_PAYTABLE[targetSym];
    const clusterSize =
      decision.targetMultiplierHint && decision.targetMultiplierHint >= pay.m10 && pay.m10 <= maxCap
        ? 10
        : decision.tier === 'medium_win' && pay.m10 <= maxCap && Math.random() < 0.35
        ? 10
        : 8;
    const baseMult = clusterSize >= 10 ? pay.m10 : pay.m8;

    const indices = Array.from({ length: OLYMPUS_CELLS }, (_, idx) => idx);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const winIndices = indices.slice(0, clusterSize);
    for (const idx of winIndices) {
      grid[idx] = targetSym;
    }
    // Ensure no unintended secondary 8-of-a-kind occurs
    const nonWinPool = OLYMPUS_REGULAR_SYMBOLS.filter((s) => s !== targetSym);
    const counts: Record<string, number> = {};
    for (let i = 0; i < OLYMPUS_CELLS; i++) {
      if (winIndices.includes(i)) continue;
      let sym = grid[i];
      if (sym === targetSym || sym === 'zeus' || (counts[sym] || 0) >= 6) {
        const available = nonWinPool.filter((s) => (counts[s] || 0) < 6);
        sym =
          available.length > 0
            ? available[Math.floor(Math.random() * available.length)]
            : nonWinPool[0] || 'emerald';
        grid[i] = sym;
      }
      counts[sym] = (counts[sym] || 0) + 1;
    }

    const baseWinVal = Math.round(betAmount * baseMult);
    const maxAllowedTotalPayout = Math.round(betAmount * maxCap);
    // Attach an orb when needed to hit targetMultiplierHint or add excitement under maxCap
    let orbMult = 0;
    const orbs: OlympusOrb[] = [];
    if (decision.targetMultiplierHint && decision.targetMultiplierHint >= baseMult * 2 && baseMult * 2 <= maxCap) {
      const desiredOrb = Math.max(2, Math.min(10, Math.round(decision.targetMultiplierHint / Math.max(0.25, baseMult))));
      if (baseMult * desiredOrb <= maxCap) {
        orbMult = desiredOrb;
        orbs.push({ index: indices[clusterSize] ?? 0, multiplier: desiredOrb });
      }
    } else if (baseMult * 2 <= maxCap && Math.random() < 0.35) {
      orbMult = 2;
      const orbCell = indices[clusterSize] ?? 0;
      orbs.push({ index: orbCell, multiplier: 2 });
    }
    const appliedMult = Math.max(1, isFreeSpin ? existingAccumulatedMult + orbMult : orbMult || 1);
    const boundedPayout = Math.min(maxAllowedTotalPayout, Math.max(1, Math.round(baseWinVal * appliedMult)));

    // Collapse grid once to finish cleanly with strictly < 8 of any symbol across the entire 30-cell board
    const winSet = new Set(winIndices);
    const collapsedGrid = [...grid];
    const columnSurvivors: OlympusSymbolId[][] = Array.from({ length: OLYMPUS_COLS }, () => []);
    const globalFillCounts: Record<string, number> = {};

    for (let col = 0; col < OLYMPUS_COLS; col++) {
      for (let row = OLYMPUS_ROWS - 1; row >= 0; row--) {
        const idx = row * OLYMPUS_COLS + col;
        if (!winSet.has(idx)) {
          const s = grid[idx];
          columnSurvivors[col].push(s);
          globalFillCounts[s] = (globalFillCounts[s] || 0) + 1;
        }
      }
    }

    for (let col = 0; col < OLYMPUS_COLS; col++) {
      const survivors = columnSurvivors[col];
      while (survivors.length < OLYMPUS_ROWS) {
        const allowed = OLYMPUS_REGULAR_SYMBOLS.filter((s) => (globalFillCounts[s] || 0) < 7);
        const safeSym =
          allowed.length > 0
            ? allowed[Math.floor(Math.random() * allowed.length)]
            : OLYMPUS_REGULAR_SYMBOLS[Math.floor(Math.random() * OLYMPUS_REGULAR_SYMBOLS.length)];
        globalFillCounts[safeSym] = (globalFillCounts[safeSym] || 0) + 1;
        survivors.push(safeSym);
      }
      for (let row = OLYMPUS_ROWS - 1; row >= 0; row--) {
        collapsedGrid[row * OLYMPUS_COLS + col] = survivors[OLYMPUS_ROWS - 1 - row];
      }
    }

    return {
      steps: [
        {
          grid: [...grid],
          winningIndices: winIndices,
          matchedGroups: [{ symbol: targetSym, count: clusterSize, win: baseWinVal }],
          orbs,
          stepWin: baseWinVal,
        },
        {
          grid: collapsedGrid,
          winningIndices: [],
          matchedGroups: [],
          orbs: [],
          stepWin: 0,
        },
      ] as OlympusCascadeStep[],
      baseWin: baseWinVal,
      roundOrbMultiplier: orbMult,
      appliedMultiplier: appliedMult,
      scatterCount: 0,
      scatterBonus: 0,
      freeSpinsAwarded: 0,
      totalPayout: boundedPayout,
    };
  }

  const levelNorm = Math.max(0, Math.min(10, profitLevel)) / 10;
  let currentGrid = buildClusteredOlympusGrid(profitLevel, anteBet, isFreeSpin);
  const steps: OlympusCascadeStep[] = [];
  let baseWin = 0;
  const allOrbsSeen: number[] = [];
  let scatterCount = currentGrid.filter((s) => s === 'zeus').length;

  const maxCascades = 6;
  for (let stepIdx = 0; stepIdx < maxCascades; stepIdx++) {
    const symbolPositions: Record<string, number[]> = {};
    for (let i = 0; i < OLYMPUS_CELLS; i++) {
      const sym = currentGrid[i];
      if (!symbolPositions[sym]) symbolPositions[sym] = [];
      symbolPositions[sym].push(i);
    }

    const winningIndices: number[] = [];
    const matchedGroups: { symbol: OlympusSymbolId; count: number; win: number }[] = [];
    let stepWin = 0;

    for (const sym of OLYMPUS_REGULAR_SYMBOLS) {
      const idxs = symbolPositions[sym];
      if (idxs && idxs.length >= 8) {
        const pay = OLYMPUS_PAYTABLE[sym];
        const mult = idxs.length >= 12 ? pay.m12 : idxs.length >= 10 ? pay.m10 : pay.m8;
        const win = Math.round(betAmount * mult);
        stepWin += win;
        winningIndices.push(...idxs);
        matchedGroups.push({ symbol: sym, count: idxs.length, win });
      }
    }

    // Spawn Lightning Multiplier Orbs mostly on winning steps or dramatic near-misses
    const orbs: OlympusOrb[] = [];
    const orbChance =
      stepWin > 0
        ? (isFreeSpin ? 0.55 : 0.25) + levelNorm * 0.28
        : stepIdx === 0 && Math.random() < 0.14
        ? 1
        : 0;
    if (Math.random() < orbChance) {
      const orbCount = Math.random() < 0.22 + levelNorm * 0.15 ? 2 : 1;
      const winSet = new Set(winningIndices);
      const nonWinCells = Array.from({ length: OLYMPUS_CELLS }, (_, i) => i).filter(
        (i) => !winSet.has(i) && currentGrid[i] !== 'zeus'
      );
      for (let o = 0; o < orbCount && nonWinCells.length > 0; o++) {
        const pickIdx = Math.floor(Math.random() * nonWinCells.length);
        const cellIdx = nonWinCells.splice(pickIdx, 1)[0];
        const multVal = pickOlympusMultiplierOrbValue(profitLevel, isFreeSpin);
        orbs.push({ index: cellIdx, multiplier: multVal });
        if (stepWin > 0) {
          allOrbsSeen.push(multVal);
        }
      }
    }

    steps.push({
      grid: [...currentGrid],
      winningIndices,
      matchedGroups,
      orbs,
      stepWin,
    });

    baseWin += stepWin;

    if (winningIndices.length === 0) {
      break;
    }

    // Cascade: collapse columns downwards and drop new symbols from top
    const winSet = new Set(winningIndices);
    const nextGrid: OlympusSymbolId[] = new Array(OLYMPUS_CELLS);
    const dropCounts: Record<string, number> = {};
    for (let i = 0; i < OLYMPUS_CELLS; i++) {
      if (!winSet.has(i)) {
        dropCounts[currentGrid[i]] = (dropCounts[currentGrid[i]] || 0) + 1;
      }
    }

    // Probability of chaining another cascade scales with profit level
    const allowChainBoost = stepIdx < 3 && Math.random() < 0.18 + levelNorm * 0.28;
    const chainFocusSym =
      OLYMPUS_REGULAR_SYMBOLS[Math.floor(Math.random() * OLYMPUS_REGULAR_SYMBOLS.length)];

    // On the final allowed cascade step, ensure new drops stay strictly < 8 globally so no uncounted win appears
    const isFinalCascadeDrop = stepIdx === maxCascades - 1;

    for (let col = 0; col < OLYMPUS_COLS; col++) {
      const survivors: OlympusSymbolId[] = [];
      for (let row = OLYMPUS_ROWS - 1; row >= 0; row--) {
        const cellIdx = row * OLYMPUS_COLS + col;
        if (!winSet.has(cellIdx)) {
          survivors.push(currentGrid[cellIdx]);
        }
      }
      while (survivors.length < OLYMPUS_ROWS) {
        let newSym: OlympusSymbolId;
        if (isFinalCascadeDrop) {
          const allowed = OLYMPUS_REGULAR_SYMBOLS.filter((s) => (dropCounts[s] || 0) < 7);
          newSym =
            allowed.length > 0
              ? allowed[Math.floor(Math.random() * allowed.length)]
              : OLYMPUS_REGULAR_SYMBOLS[Math.floor(Math.random() * OLYMPUS_REGULAR_SYMBOLS.length)];
        } else if (allowChainBoost && Math.random() < 0.42 && (dropCounts[chainFocusSym] || 0) < 10) {
          newSym = chainFocusSym;
        } else {
          newSym = pickWeightedOlympusSymbol(
            dropCounts,
            (dropCounts.zeus || 0) < 3 && profitLevel >= 2,
            10,
            3
          );
        }
        dropCounts[newSym] = (dropCounts[newSym] || 0) + 1;
        survivors.push(newSym);
      }
      for (let row = OLYMPUS_ROWS - 1; row >= 0; row--) {
        const cellIdx = row * OLYMPUS_COLS + col;
        nextGrid[cellIdx] = survivors[OLYMPUS_ROWS - 1 - row];
      }
    }

    currentGrid = nextGrid;
    scatterCount = Math.max(scatterCount, currentGrid.filter((s) => s === 'zeus').length);
  }

  // Ensure the final step is always a settled non-winning grid if maxCascades ended on a winning step
  if (steps.length > 0 && steps[steps.length - 1].winningIndices.length > 0) {
    const finalCounts: Record<string, number> = {};
    for (let i = 0; i < OLYMPUS_CELLS; i++) {
      const sym = currentGrid[i];
      if (sym !== 'zeus' && (finalCounts[sym] || 0) >= 7) {
        const allowed = OLYMPUS_REGULAR_SYMBOLS.filter((s) => (finalCounts[s] || 0) < 7);
        const replacement =
          allowed.length > 0 ? allowed[Math.floor(Math.random() * allowed.length)] : 'emerald';
        currentGrid[i] = replacement;
        finalCounts[replacement] = (finalCounts[replacement] || 0) + 1;
      } else {
        finalCounts[sym] = (finalCounts[sym] || 0) + 1;
      }
    }
    steps.push({
      grid: [...currentGrid],
      winningIndices: [],
      matchedGroups: [],
      orbs: [],
      stepWin: 0,
    });
  }

  let scatterBonus = 0;
  let freeSpinsAwarded = 0;
  if (scatterCount >= 4) {
    const scatterMult = scatterCount >= 6 ? 10 : scatterCount === 5 ? 4 : 1.5;
    scatterBonus = Math.round(betAmount * scatterMult);
    freeSpinsAwarded = scatterCount >= 6 ? 8 : scatterCount === 5 ? 6 : 5;
  }

  const roundOrbMultiplier = allOrbsSeen.reduce((a, b) => a + b, 0);
  const appliedMultiplier =
    baseWin > 0
      ? Math.max(1, isFreeSpin ? existingAccumulatedMult + roundOrbMultiplier : roundOrbMultiplier || 1)
      : 1;

  const totalPayout = Math.max(0, Math.round(baseWin * appliedMultiplier + scatterBonus));

  return {
    steps,
    baseWin,
    roundOrbMultiplier,
    appliedMultiplier,
    scatterCount,
    scatterBonus,
    freeSpinsAwarded,
    totalPayout,
  };
}

// 2i. Olympus Gates Config & Active Free Spins State
app.get('/api/games/olympus/config', async (req: Request, res: Response) => {
  const appSettings = getAppSettings();
  const maintenance = getGameMaintenanceStatus('olympus');
  let freeSpins: OlympusFreeSpinsState | null = null;
  try {
    const hasHint =
      req.headers['authorization'] || req.query?.userId || req.query?.displayId || req.query?.email;
    if (hasHint) {
      const resolved = await resolvePlayerAccountForGames(req);
      if (resolved.ok) {
        const key = resolved.user.id || resolved.user.displayId || resolved.user.email;
        freeSpins = activeOlympusFreeSpins.get(key) || null;
      }
    }
  } catch {}

  return res.json({
    success: true,
    gamesEnabled: appSettings.gamesEnabled,
    maintenance,
    cols: OLYMPUS_COLS,
    rows: OLYMPUS_ROWS,
    betAmounts: [...GAME_BET_AMOUNTS],
    minBet: GAME_BET_AMOUNTS[0],
    maxBet: GAME_BET_AMOUNTS[GAME_BET_AMOUNTS.length - 1],
    paytable: OLYMPUS_PAYTABLE,
    multiplierValues: [...OLYMPUS_MULTIPLIER_VALUES],
    freeSpins: freeSpins
      ? {
          remainingSpins: freeSpins.remainingSpins,
          betAmount: freeSpins.betAmount,
          accumulatedMultiplier: freeSpins.accumulatedMultiplier,
          totalBonusWin: freeSpins.totalBonusWin,
        }
      : null,
  });
});

// 2j. Play Olympus Gates (Server-authoritative 6x5 cascade, multiplier orbs, free spins & balance persistence)
app.post('/api/games/olympus/play', async (req: Request, res: Response) => {
  try {
    const maintenance = getGameMaintenanceStatus('olympus');
    if (maintenance.enabled) {
      return res.status(503).json({
        success: false,
        code: 'GAME_MAINTENANCE',
        maintenance,
        message: maintenance.reasonAr || 'لعبة Olympus Gates قيد الصيانة والتطوير حالياً',
      });
    }
    if (!getAppSettings().gamesEnabled) {
      return res.status(403).json({
        success: false,
        code: 'SECTION_DISABLED',
        message: 'قسم الألعاب معطّل حالياً من قبل الإدارة',
      });
    }

    const resolved = await resolvePlayerAccountForGames(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({
        success: false,
        code: resolved.code,
        message: resolved.message,
      });
    }

    const { users, userIndex, user, currentCoins } = resolved;
    const playerKey = user.id || user.displayId || user.email;
    const existingFreeState = activeOlympusFreeSpins.get(playerKey);
    const isFreeSpin = Boolean(existingFreeState && existingFreeState.remainingSpins > 0);

    const rawBet = Number(req.body?.betAmount);
    let betAmount = Math.floor(rawBet);
    if (isFreeSpin && existingFreeState) {
      betAmount = existingFreeState.betAmount;
    } else if (!Number.isFinite(rawBet) || !(GAME_BET_AMOUNTS as readonly number[]).includes(betAmount)) {
      return res.status(400).json({
        success: false,
        message: 'قيمة الرهان غير صالحة (المتاح من 500 إلى 1,000,000 Coin)',
      });
    }

    const anteBet = !isFreeSpin && Boolean(req.body?.anteBet);
    const spinCost = isFreeSpin ? 0 : anteBet ? Math.round(betAmount * 1.25) : betAmount;

    if (currentCoins < spinCost) {
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_COINS',
        currentCoins,
        message: 'رصيد الكوينز غير كافٍ لإجراء هذه اللفة',
      });
    }

    const gameSettings = getGamesSettings();
    const olympusLevel = gameSettings.absoluteStopProfit ? 0 : clampProfitLevel(gameSettings.olympusProfitLevel);
    const decision = evaluateSmartGameDecision(user.id, 'olympus', spinCost > 0 ? spinCost : betAmount, olympusLevel, gameSettings.algorithm, currentCoins);
    const spinResult = generateOlympusSpin(
      betAmount,
      olympusLevel,
      anteBet,
      isFreeSpin,
      existingFreeState?.accumulatedMultiplier || 0,
      decision
    );

    const payout = gameSettings.absoluteStopProfit || olympusLevel <= 0 ? 0 : Math.max(0, spinResult.totalPayout);
    const netProfit = payout - spinCost;
    const newCoinsBalance = Math.max(0, currentCoins - spinCost + payout);

    recordPlayerGameOutcome(
      user.id,
      'Olympus Gates',
      spinCost > 0 ? spinCost : betAmount,
      payout,
      betAmount > 0 ? Math.round((payout / betAmount) * 100) / 100 : 0,
      decision.reason
    );

    // Update Free Spins state safely on server
    let freeSpinsRemaining = 0;
    let bonusAccumulatedMultiplier = 0;
    let totalBonusWin = 0;

    if (isFreeSpin && existingFreeState) {
      const nextRemaining =
        existingFreeState.remainingSpins - 1 + (spinResult.freeSpinsAwarded > 0 ? 3 : 0);
      const nextAccum = existingFreeState.accumulatedMultiplier + spinResult.roundOrbMultiplier;
      const nextBonusTotal = existingFreeState.totalBonusWin + payout;
      if (nextRemaining > 0) {
        activeOlympusFreeSpins.set(playerKey, {
          remainingSpins: nextRemaining,
          betAmount: existingFreeState.betAmount,
          accumulatedMultiplier: nextAccum,
          totalBonusWin: nextBonusTotal,
          updatedAtMs: Date.now(),
        });
        freeSpinsRemaining = nextRemaining;
        bonusAccumulatedMultiplier = nextAccum;
        totalBonusWin = nextBonusTotal;
      } else {
        activeOlympusFreeSpins.delete(playerKey);
        freeSpinsRemaining = 0;
        bonusAccumulatedMultiplier = nextAccum;
        totalBonusWin = nextBonusTotal;
      }
    } else if (spinResult.freeSpinsAwarded > 0) {
      activeOlympusFreeSpins.set(playerKey, {
        remainingSpins: spinResult.freeSpinsAwarded,
        betAmount,
        accumulatedMultiplier: spinResult.roundOrbMultiplier,
        totalBonusWin: payout,
        updatedAtMs: Date.now(),
      });
      freeSpinsRemaining = spinResult.freeSpinsAwarded;
      bonusAccumulatedMultiplier = spinResult.roundOrbMultiplier;
      totalBonusWin = payout;
    }

    user.coinsBalance = newCoinsBalance;
    user.updatedAt = new Date().toISOString();
    users[userIndex] = user;
    saveStoredUsers(users);

    await updateNeonProfileByIdentifier(user.id || user.displayId || user.email, {
      coins_balance: newCoinsBalance,
      updated_at: user.updatedAt,
    }).catch(() => {});

    return res.json({
      success: true,
      betAmount,
      anteBet,
      cost: spinCost,
      isFreeSpin,
      steps: spinResult.steps,
      baseWin: spinResult.baseWin,
      roundOrbMultiplier: spinResult.roundOrbMultiplier,
      appliedMultiplier: spinResult.appliedMultiplier,
      scatterCount: spinResult.scatterCount,
      scatterBonus: spinResult.scatterBonus,
      freeSpinsAwarded: spinResult.freeSpinsAwarded,
      freeSpinsRemaining,
      bonusAccumulatedMultiplier,
      totalBonusWin,
      payout,
      netProfit,
      previousCoinsBalance: currentCoins,
      newCoinsBalance,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء تشغيل لعبة Olympus Gates',
    });
  }
});

// ==========================================
// Mystery Boxes Game Engine (8 Boxes: Empty or 1x..50x Multiplier)
// ==========================================
interface BoxesRound {
  roundId: string;
  userId: string;
  betAmount: number;
  status: 'active' | 'finished';
  createdAtMs: number;
}

const activeBoxesRounds = new Map<string, BoxesRound>();
const activeBoxesRoundByUser = new Map<string, string>();

function cleanupExpiredBoxesRounds() {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [roundId, round] of activeBoxesRounds.entries()) {
    if (round.createdAtMs < cutoff) {
      activeBoxesRounds.delete(roundId);
      if (activeBoxesRoundByUser.get(round.userId) === roundId) {
        activeBoxesRoundByUser.delete(round.userId);
      }
    }
  }
}

function pickBoxesMultiplierForWin(profitLevel: number): number {
  const levelNorm = clampProfitLevel(profitLevel) / 10; // 0..1
  // Weight all integers from 1 to 50 so every multiplier 1..50 can appear,
  // with higher profit levels giving better odds for mid/high multipliers.
  const exponent = 2.6 - levelNorm * 1.15; // 2.6 (level 0) down to 1.45 (level 10)
  const weights: number[] = [];
  let total = 0;
  for (let m = BOXES_MIN_MULTIPLIER; m <= BOXES_MAX_MULTIPLIER; m++) {
    const w = 1 / Math.pow(m, exponent);
    weights.push(w);
    total += w;
  }
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    if (r < weights[i]) {
      return BOXES_MIN_MULTIPLIER + i;
    }
    r -= weights[i];
  }
  return BOXES_MIN_MULTIPLIER;
}

function resolveBoxesOutcome(
  profitLevel: number,
  chosenIndex: number,
  decision?: SmartGameDecision
): {
  won: boolean;
  multiplier: number;
  chosenBox: { index: number; empty: boolean; multiplier: number };
} {
  const level = clampProfitLevel(profitLevel);
  let won = false;
  let chosenMultiplier = 0;

  if (level <= 0 || decision?.forceZeroPayout) {
    won = false;
  } else if (decision && !decision.useClassicLevel) {
    won = decision.allowWin;
    if (won) {
      const cap = Math.max(1, Math.min(BOXES_MAX_MULTIPLIER, Math.floor(decision.maxMultiplierCap)));
      if (decision.targetMultiplierHint) {
        const targetInt = Math.max(1, Math.min(cap, Math.round(decision.targetMultiplierHint)));
        const minInt = Math.max(1, Math.min(targetInt, Math.floor(decision.minMultiplierHint ?? targetInt)));
        const span = Math.max(0, targetInt - minInt);
        chosenMultiplier = minInt + (span > 0 ? Math.floor(Math.random() * (span + 1)) : 0);
      } else if (decision.tier === 'small_win') {
        if (cap <= 1) {
          chosenMultiplier = 1;
        } else if (cap === 2) {
          chosenMultiplier = Math.random() < 0.78 ? 2 : 1;
        } else {
          const r = Math.random();
          chosenMultiplier = r < 0.2 ? 1 : r < 0.75 ? 2 : Math.min(cap, 3);
        }
      } else {
        const exponent = 2.0;
        const weights: number[] = [];
        let total = 0;
        for (let m = 1; m <= cap; m++) {
          const w = 1 / Math.pow(m, exponent);
          weights.push(w);
          total += w;
        }
        let r = Math.random() * total;
        chosenMultiplier = 1;
        for (let i = 0; i < weights.length; i++) {
          if (r < weights[i]) {
            chosenMultiplier = 1 + i;
            break;
          }
          r -= weights[i];
        }
      }
    }
  } else {
    const winChance = level <= 0 ? 0 : Math.min(0.62, 0.06 + (level / 10) * 0.56);
    won = Math.random() < winChance;
    chosenMultiplier = won ? pickBoxesMultiplierForWin(level) : 0;
  }

  return {
    won,
    multiplier: chosenMultiplier,
    chosenBox: {
      index: chosenIndex,
      empty: !won,
      multiplier: chosenMultiplier,
    },
  };
}

// 2k. Get Mystery Boxes Config & Resume Active Round if present
app.get('/api/games/boxes/config', async (req: Request, res: Response) => {
  const appSettings = getAppSettings();
  const maintenance = getGameMaintenanceStatus('boxes');
  cleanupExpiredBoxesRounds();

  let activeRound: {
    roundId: string;
    betAmount: number;
    boxesCount: number;
  } | null = null;

  try {
    const hasHint =
      req.headers['authorization'] || req.query?.userId || req.query?.displayId || req.query?.email;
    if (hasHint) {
      const resolved = await resolvePlayerAccountForGames(req);
      if (resolved.ok) {
        const existingId = activeBoxesRoundByUser.get(resolved.user.id);
        const existing = existingId ? activeBoxesRounds.get(existingId) : null;
        if (existing && existing.status === 'active') {
          activeRound = {
            roundId: existing.roundId,
            betAmount: existing.betAmount,
            boxesCount: BOXES_COUNT,
          };
        }
      }
    }
  } catch {}

  return res.json({
    success: true,
    gamesEnabled: appSettings.gamesEnabled,
    maintenance,
    boxesCount: BOXES_COUNT,
    minMultiplier: BOXES_MIN_MULTIPLIER,
    maxMultiplier: BOXES_MAX_MULTIPLIER,
    betAmounts: [...GAME_BET_AMOUNTS],
    minBet: GAME_BET_AMOUNTS[0],
    maxBet: GAME_BET_AMOUNTS[GAME_BET_AMOUNTS.length - 1],
    activeRound,
  });
});

// 2l. Start a Mystery Boxes Round (Deduct bet, spawn 8 boxes)
app.post('/api/games/boxes/start', async (req: Request, res: Response) => {
  try {
    const maintenance = getGameMaintenanceStatus('boxes');
    if (maintenance.enabled) {
      return res.status(503).json({
        success: false,
        code: 'GAME_MAINTENANCE',
        maintenance,
        message: maintenance.reasonAr || 'لعبة صناديق الحظ قيد الصيانة والتطوير حالياً',
      });
    }
    if (!getAppSettings().gamesEnabled) {
      return res.status(403).json({
        success: false,
        code: 'SECTION_DISABLED',
        message: 'قسم الألعاب معطّل حالياً من قبل الإدارة',
      });
    }

    const rawBet = Number(req.body?.betAmount);
    const betAmount = Math.floor(rawBet);
    if (!Number.isFinite(rawBet) || !(GAME_BET_AMOUNTS as readonly number[]).includes(betAmount)) {
      return res.status(400).json({
        success: false,
        message: 'قيمة الرهان غير صالحة (المتاح من 500 إلى 1,000,000 Coin)',
      });
    }

    const resolved = await resolvePlayerAccountForGames(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({
        success: false,
        message: resolved.message,
      });
    }

    const { users, userIndex, user, currentCoins } = resolved;

    const existingRoundId = activeBoxesRoundByUser.get(user.id);
    const existingRound = existingRoundId ? activeBoxesRounds.get(existingRoundId) : null;
    if (existingRound && existingRound.status === 'active') {
      return res.json({
        success: true,
        alreadyActive: true,
        roundId: existingRound.roundId,
        betAmount: existingRound.betAmount,
        boxesCount: BOXES_COUNT,
        newCoinsBalance: currentCoins,
      });
    }

    if (currentCoins < betAmount) {
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_COINS',
        currentCoins,
        message: 'رصيد الكوينز غير كافٍ لإجراء هذا الرهان',
      });
    }

    cleanupExpiredBoxesRounds();

    const newCoinsBalance = Math.max(0, currentCoins - betAmount);
    user.coinsBalance = newCoinsBalance;
    user.updatedAt = new Date().toISOString();
    users[userIndex] = user;
    saveStoredUsers(users);

    await updateNeonProfileByIdentifier(user.id || user.displayId || user.email, {
      coins_balance: newCoinsBalance,
      updated_at: user.updatedAt,
    }).catch(() => {});

    const roundId = `boxes_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const round: BoxesRound = {
      roundId,
      userId: user.id,
      betAmount,
      status: 'active',
      createdAtMs: Date.now(),
    };

    activeBoxesRounds.set(roundId, round);
    activeBoxesRoundByUser.set(user.id, roundId);

    return res.json({
      success: true,
      roundId,
      betAmount,
      boxesCount: BOXES_COUNT,
      newCoinsBalance,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء بدء لعبة الصناديق',
    });
  }
});

// 2m. Pick 1 of the 8 Mystery Boxes (Empty or 1x..50x Multiplier)
app.post('/api/games/boxes/pick', async (req: Request, res: Response) => {
  try {
    const maintenance = getGameMaintenanceStatus('boxes');
    if (maintenance.enabled) {
      return res.status(503).json({
        success: false,
        code: 'GAME_MAINTENANCE',
        maintenance,
        message: maintenance.reasonAr || 'لعبة صناديق الحظ قيد الصيانة والتطوير حالياً',
      });
    }
    if (!getAppSettings().gamesEnabled) {
      return res.status(403).json({
        success: false,
        code: 'SECTION_DISABLED',
        message: 'قسم الألعاب معطّل حالياً من قبل الإدارة',
      });
    }

    const roundId = req.body?.roundId ? String(req.body.roundId).trim() : '';
    const boxIndex = Math.floor(Number(req.body?.boxIndex));
    if (!roundId || !Number.isInteger(boxIndex) || boxIndex < 0 || boxIndex >= BOXES_COUNT) {
      return res.status(400).json({
        success: false,
        message: 'يرجى اختيار صندوق صالح من 1 إلى 8',
      });
    }

    const resolved = await resolvePlayerAccountForGames(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({
        success: false,
        message: resolved.message,
      });
    }

    const { users, userIndex, user, currentCoins } = resolved;
    const round = activeBoxesRounds.get(roundId);
    if (!round || round.userId !== user.id || round.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'انتهت هذه الجولة أو لم يتم العثور عليها',
      });
    }

    round.status = 'finished';
    activeBoxesRounds.delete(roundId);
    if (activeBoxesRoundByUser.get(user.id) === roundId) {
      activeBoxesRoundByUser.delete(user.id);
    }

    const gameSettings = getGamesSettings();
    const boxesLevel = gameSettings.absoluteStopProfit ? 0 : clampProfitLevel(gameSettings.boxesProfitLevel);
    const decision = evaluateSmartGameDecision(user.id, 'boxes', round.betAmount, boxesLevel, gameSettings.algorithm, currentCoins + round.betAmount);
    const outcome = resolveBoxesOutcome(boxesLevel, boxIndex, decision);

    const payout = decision.forceZeroPayout || !outcome.won ? 0 : Math.max(0, Math.round(round.betAmount * outcome.multiplier));
    const netProfit = payout - round.betAmount;
    const newCoinsBalance = Math.max(0, currentCoins + payout);

    user.coinsBalance = newCoinsBalance;
    user.updatedAt = new Date().toISOString();
    users[userIndex] = user;
    saveStoredUsers(users);

    recordPlayerGameOutcome(
      user.id,
      'Mystery Boxes',
      round.betAmount,
      payout,
      outcome.multiplier,
      decision.reason
    );

    await updateNeonProfileByIdentifier(user.id || user.displayId || user.email, {
      coins_balance: newCoinsBalance,
      updated_at: user.updatedAt,
    }).catch(() => {});

    return res.json({
      success: true,
      roundId,
      chosenIndex: boxIndex,
      won: outcome.won,
      multiplier: outcome.multiplier,
      betAmount: round.betAmount,
      payout,
      netProfit,
      chosenBox: outcome.chosenBox,
      newCoinsBalance,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء فتح الصندوق',
    });
  }
});

// ==========================================
// Winter Slots (3-Reel Slots Game Engine & API)
// ==========================================
type WinterSlotsSymbolId = 'rain' | 'cloud' | 'lightning' | 'snow' | 'seven' | 'wild';

const WINTER_SLOTS_SYMBOLS: readonly WinterSlotsSymbolId[] = [
  'rain',
  'cloud',
  'lightning',
  'snow',
  'seven',
  'wild',
] as const;

const WINTER_SLOTS_PAYTABLE: Record<WinterSlotsSymbolId, number> = {
  rain: 2,
  cloud: 3,
  lightning: 5,
  snow: 8,
  seven: 20,
  wild: 50,
};

const WINTER_SLOTS_PAYLINES: readonly [number, number, number][] = [
  [3, 4, 5], // Line 1: Middle horizontal
  [0, 1, 2], // Line 2: Top horizontal
  [6, 7, 8], // Line 3: Bottom horizontal
  [0, 4, 8], // Line 4: Top-left to bottom-right diagonal
  [6, 4, 2], // Line 5: Bottom-left to top-right diagonal
] as const;

interface WinterSlotsWinningLine {
  lineIndex: number;
  indices: [number, number, number];
  symbol: WinterSlotsSymbolId;
  multiplier: number;
}

function pickRandomWinterSymbol(excludeWild = false): WinterSlotsSymbolId {
  const pool: { id: WinterSlotsSymbolId; w: number }[] = [
    { id: 'rain', w: 30 },
    { id: 'cloud', w: 26 },
    { id: 'lightning', w: 19 },
    { id: 'snow', w: 14 },
    { id: 'seven', w: 7 },
    ...(excludeWild ? [] : [{ id: 'wild' as const, w: 4 }]),
  ];
  const total = pool.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * total;
  for (const item of pool) {
    if (r < item.w) return item.id;
    r -= item.w;
  }
  return 'rain';
}

function evaluateWinterSlotsGrid(grid: WinterSlotsSymbolId[]): {
  winningLines: WinterSlotsWinningLine[];
  totalMultiplier: number;
} {
  const winningLines: WinterSlotsWinningLine[] = [];
  let totalMultiplier = 0;

  WINTER_SLOTS_PAYLINES.forEach((indices, lineIndex) => {
    const syms = [grid[indices[0]], grid[indices[1]], grid[indices[2]]];
    if (syms.every((s) => s === 'wild')) {
      const mult = WINTER_SLOTS_PAYTABLE.wild;
      totalMultiplier += mult;
      winningLines.push({
        lineIndex,
        indices: [indices[0], indices[1], indices[2]],
        symbol: 'wild',
        multiplier: mult,
      });
      return;
    }

    const nonWild = syms.filter((s) => s !== 'wild');
    if (nonWild.length > 0 && nonWild.every((s) => s === nonWild[0])) {
      const matchedSym = nonWild[0];
      const mult = WINTER_SLOTS_PAYTABLE[matchedSym];
      totalMultiplier += mult;
      winningLines.push({
        lineIndex,
        indices: [indices[0], indices[1], indices[2]],
        symbol: matchedSym,
        multiplier: mult,
      });
    }
  });

  return {
    winningLines,
    totalMultiplier: Math.round(totalMultiplier * 100) / 100,
  };
}

function generateWinterSlotsOutcome(
  betAmount: number,
  profitLevel: number,
  decision?: SmartGameDecision
): {
  grid: WinterSlotsSymbolId[];
  winningLines: WinterSlotsWinningLine[];
  totalMultiplier: number;
  payout: number;
} {
  const level = clampProfitLevel(profitLevel);

  const buildZeroWinGrid = (teaseNearMiss = false) => {
    for (let attempt = 0; attempt < 80; attempt++) {
      const grid: WinterSlotsSymbolId[] = Array.from({ length: 9 }, () =>
        pickRandomWinterSymbol(Math.random() < 0.7)
      );
      if (teaseNearMiss && attempt < 25) {
        const teaseSym: WinterSlotsSymbolId = Math.random() < 0.5 ? 'seven' : 'snow';
        grid[3] = teaseSym;
        grid[4] = teaseSym;
        if (grid[5] === teaseSym || grid[5] === 'wild') grid[5] = 'rain';
      }
      if (evaluateWinterSlotsGrid(grid).totalMultiplier === 0) {
        return { grid, winningLines: [], totalMultiplier: 0, payout: 0 };
      }
    }
    const safeGrid: WinterSlotsSymbolId[] = [
      'rain', 'cloud', 'lightning',
      'snow', 'rain', 'seven',
      'lightning', 'snow', 'cloud',
    ];
    return { grid: safeGrid, winningLines: [], totalMultiplier: 0, payout: 0 };
  };

  if (level <= 0 || decision?.forceZeroPayout) {
    return buildZeroWinGrid(false);
  }

  let wantWin = false;
  if (decision && !decision.useClassicLevel) {
    wantWin = decision.allowWin && decision.maxMultiplierCap >= 2;
  } else {
    const winChance = Math.min(0.56, 0.08 + (level / 10) * 0.48);
    wantWin = Math.random() < winChance;
  }

  if (!wantWin) {
    return buildZeroWinGrid(Boolean(decision?.nearMissVisual));
  }

  // Weighted winning symbol selection tuned by algorithm decision, AI target hint & profit level
  const maxCap = decision && !decision.useClassicLevel ? decision.maxMultiplierCap : 50;
  const rawPool: { id: WinterSlotsSymbolId; w: number }[] = [
    { id: 'rain', w: decision?.tier === 'small_win' ? 62 : Math.max(12, 42 - level * 2.2) },
    { id: 'cloud', w: decision?.tier === 'small_win' ? 38 : Math.max(12, 32 - level * 1.2) },
    { id: 'lightning', w: decision?.tier === 'small_win' ? 12 : 14 + level * 0.8 },
    { id: 'snow', w: decision?.tier === 'small_win' ? 4 : 8 + level * 1.3 },
    { id: 'seven', w: decision?.tier === 'small_win' ? 0 : 2.5 + level * 0.85 },
    { id: 'wild', w: decision?.tier === 'small_win' ? 0 : 0.7 + level * 0.35 },
  ];
  const symbolPool = rawPool.filter((item) => WINTER_SLOTS_PAYTABLE[item.id] <= maxCap && item.w > 0);
  const activePool = symbolPool.length > 0 ? symbolPool : [{ id: 'rain' as WinterSlotsSymbolId, w: 1 }];
  let targetSym: WinterSlotsSymbolId = 'rain';
  if (decision?.targetMultiplierHint && activePool.length > 0) {
    const hint = decision.targetMultiplierHint;
    const sorted = [...activePool].sort(
      (a, b) => Math.abs(WINTER_SLOTS_PAYTABLE[a.id] - hint) - Math.abs(WINTER_SLOTS_PAYTABLE[b.id] - hint)
    );
    targetSym = sorted[0].id;
  } else {
    const totalW = activePool.reduce((s, p) => s + p.w, 0);
    let pickRoll = Math.random() * totalW;
    for (const item of activePool) {
      if (pickRoll < item.w) {
        targetSym = item.id;
        break;
      }
      pickRoll -= item.w;
    }
  }

  // Ensure strictly 1 winning payline under maxCap
  for (let gridAttempt = 0; gridAttempt < 30; gridAttempt++) {
    let grid: WinterSlotsSymbolId[] = [
      'rain', 'snow', 'cloud',
      'lightning', 'seven', 'rain',
      'cloud', 'rain', 'lightning',
    ];
    for (let attempt = 0; attempt < 40; attempt++) {
      const candidate = Array.from({ length: 9 }, () => pickRandomWinterSymbol(true));
      if (evaluateWinterSlotsGrid(candidate).totalMultiplier === 0) {
        grid = candidate;
        break;
      }
    }

    const chosenLineIdx = Math.floor(Math.random() * WINTER_SLOTS_PAYLINES.length);
    const chosenLine = WINTER_SLOTS_PAYLINES[chosenLineIdx];
    const includeWildSub = targetSym !== 'wild' && Math.random() < 0.28;
    const wildSlotPos = includeWildSub ? Math.floor(Math.random() * 3) : -1;

    chosenLine.forEach((cellIdx, pos) => {
      grid[cellIdx] = pos === wildSlotPos ? 'wild' : targetSym;
    });

    const finalEval = evaluateWinterSlotsGrid(grid);
    if (finalEval.totalMultiplier > 0 && (decision?.useClassicLevel || finalEval.totalMultiplier <= maxCap)) {
      const payout = Math.max(0, Math.round(betAmount * finalEval.totalMultiplier));
      return {
        grid,
        winningLines: finalEval.winningLines,
        totalMultiplier: finalEval.totalMultiplier,
        payout,
      };
    }
  }

  // Guaranteed deterministic 1-line win fallback
  const fallbackWinGrid: WinterSlotsSymbolId[] = [
    'snow', 'lightning', 'cloud',
    targetSym, targetSym, targetSym,
    'cloud', 'snow', 'lightning',
  ];
  const fallbackEval = evaluateWinterSlotsGrid(fallbackWinGrid);
  return {
    grid: fallbackWinGrid,
    winningLines: fallbackEval.winningLines,
    totalMultiplier: fallbackEval.totalMultiplier,
    payout: Math.max(0, Math.round(betAmount * fallbackEval.totalMultiplier)),
  };
}

// 2n. Winter Slots Config
app.get('/api/games/winter-slots/config', (_req: Request, res: Response) => {
  const appSettings = getAppSettings();
  const maintenance = getGameMaintenanceStatus('winter-slots');
  return res.json({
    success: true,
    gamesEnabled: appSettings.gamesEnabled,
    maintenance,
    reelsCount: 3,
    rowsCount: 3,
    paylinesCount: WINTER_SLOTS_PAYLINES.length,
    symbols: [...WINTER_SLOTS_SYMBOLS],
    paytable: WINTER_SLOTS_PAYTABLE,
    betAmounts: [...GAME_BET_AMOUNTS],
    minBet: GAME_BET_AMOUNTS[0],
    maxBet: GAME_BET_AMOUNTS[GAME_BET_AMOUNTS.length - 1],
  });
});

// 2o. Play Winter Slots (Server-authoritative 3-reel spin & Coin balance persistence)
app.post('/api/games/winter-slots/spin', async (req: Request, res: Response) => {
  try {
    const maintenance = getGameMaintenanceStatus('winter-slots');
    if (maintenance.enabled) {
      return res.status(503).json({
        success: false,
        code: 'GAME_MAINTENANCE',
        maintenance,
        message: maintenance.reasonAr || 'لعبة Winter Slots قيد الصيانة والتطوير حالياً',
      });
    }
    if (!getAppSettings().gamesEnabled) {
      return res.status(403).json({
        success: false,
        code: 'SECTION_DISABLED',
        message: 'قسم الألعاب معطّل حالياً من قبل الإدارة',
      });
    }

    const rawBet = Number(req.body?.betAmount);
    const betAmount = Math.floor(rawBet);
    if (!Number.isFinite(rawBet) || !(GAME_BET_AMOUNTS as readonly number[]).includes(betAmount)) {
      return res.status(400).json({
        success: false,
        message: 'قيمة الرهان غير صالحة (المتاح من 500 إلى 1,000,000 Coin)',
      });
    }

    const resolved = await resolvePlayerAccountForGames(req);
    if (!resolved.ok) {
      return res.status(resolved.status).json({
        success: false,
        message: resolved.message,
      });
    }

    const { users, userIndex, user, currentCoins } = resolved;
    if (currentCoins < betAmount) {
      return res.status(400).json({
        success: false,
        code: 'INSUFFICIENT_COINS',
        currentCoins,
        message: 'رصيد الكوينز غير كافٍ لإجراء هذه اللفة',
      });
    }

    const gameSettings = getGamesSettings();
    const winterLevel = gameSettings.absoluteStopProfit ? 0 : clampProfitLevel(gameSettings.winterSlotsProfitLevel);
    const decision = evaluateSmartGameDecision(user.id, 'winter-slots', betAmount, winterLevel, gameSettings.algorithm, currentCoins);
    const outcome = generateWinterSlotsOutcome(betAmount, winterLevel, decision);

    const netProfit = outcome.payout - betAmount;
    const newCoinsBalance = Math.max(0, currentCoins - betAmount + outcome.payout);

    user.coinsBalance = newCoinsBalance;
    user.updatedAt = new Date().toISOString();
    users[userIndex] = user;
    saveStoredUsers(users);

    recordPlayerGameOutcome(
      user.id,
      'Winter Slots',
      betAmount,
      outcome.payout,
      outcome.totalMultiplier,
      decision.reason
    );

    await updateNeonProfileByIdentifier(user.id || user.displayId || user.email, {
      coins_balance: newCoinsBalance,
      updated_at: user.updatedAt,
    }).catch(() => {});

    return res.json({
      success: true,
      betAmount,
      grid: outcome.grid,
      winningLines: outcome.winningLines,
      totalMultiplier: outcome.totalMultiplier,
      payout: outcome.payout,
      netProfit,
      newCoinsBalance,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'حدث خطأ أثناء تدوير البكرات',
    });
  }
});

// 3. Admin: Get Games Settings (Profit levels + Smart Algorithm + AI Monitor + Maintenance + Real Telemetry)
app.get('/api/admin/games/settings', verifyAdminAuth, async (_req: Request, res: Response) => {
  try {
    const settings = getGamesSettings();
    const telemetry = getGamesAlgorithmTelemetry();
    const connectedGames = getConnectedGamesList();
    const monitoredPlayers = getAiMonitoredPlayersSummary();
    return res.json({
      success: true,
      settings,
      algorithm: settings.algorithm,
      aiMonitor: settings.aiMonitor,
      aiPresets: AI_STRATEGY_PRESETS,
      absoluteStopProfit: settings.absoluteStopProfit,
      maintenanceGames: settings.maintenanceGames,
      monitoredPlayers,
      telemetry,
      connectedGames,
      multipliers: [...PLINKO_MULTIPLIERS],
      minesOptions: [...MINES_COUNT_OPTIONS],
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'خطأ في جلب إعدادات الألعاب',
    });
  }
});

// 4. Admin: Update Games Settings, Smart Algorithm, AI Monitor, Maintenance & Kill Switch
app.post('/api/admin/games/settings', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const hasUnified =
      req.body?.unifiedProfitLevel !== undefined || req.body?.profitLevel !== undefined;
    const hasTopTargetWinRate = req.body?.targetWinRatePercent !== undefined;
    const hasTopMaxMult = req.body?.maxAllowedMultiplier !== undefined;
    const hasPlinko = req.body?.plinkoProfitLevel !== undefined;
    const hasMines = req.body?.minesProfitLevel !== undefined;
    const hasDice = req.body?.diceProfitLevel !== undefined;
    const hasOlympus = req.body?.olympusProfitLevel !== undefined;
    const hasBoxes = req.body?.boxesProfitLevel !== undefined;
    const hasWinterSlots = req.body?.winterSlotsProfitLevel !== undefined;
    const hasAlgorithm = req.body?.algorithm !== undefined && typeof req.body.algorithm === 'object';
    const hasAiMonitor = req.body?.aiMonitor !== undefined && typeof req.body.aiMonitor === 'object';
    const hasAbsoluteStop = typeof req.body?.absoluteStopProfit === 'boolean';
    const hasMaintenanceGames =
      req.body?.maintenanceGames !== undefined && typeof req.body.maintenanceGames === 'object';

    if (
      !hasUnified &&
      !hasTopTargetWinRate &&
      !hasTopMaxMult &&
      !hasPlinko &&
      !hasMines &&
      !hasDice &&
      !hasOlympus &&
      !hasBoxes &&
      !hasWinterSlots &&
      !hasAlgorithm &&
      !hasAiMonitor &&
      !hasAbsoluteStop &&
      !hasMaintenanceGames
    ) {
      return res.status(400).json({
        success: false,
        message: 'يرجى تحديد إعدادات صالحة للحفظ',
      });
    }

    const patch: Partial<GamesSettings> = {};
    const currentSettings = getGamesSettings();
    let effectiveLevel = currentSettings.plinkoProfitLevel;

    if (hasUnified) {
      const rawUnified =
        req.body?.unifiedProfitLevel !== undefined
          ? req.body.unifiedProfitLevel
          : req.body.profitLevel;
      const numUnified = Number(rawUnified);
      if (!Number.isFinite(numUnified) || numUnified < 0 || numUnified > 10) {
        return res.status(400).json({
          success: false,
          message: 'يجب أن تكون قيمة الربح بين 0 و 10 فقط',
        });
      }
      effectiveLevel = numUnified;
      patch.plinkoProfitLevel = numUnified;
      patch.minesProfitLevel = numUnified;
      patch.diceProfitLevel = numUnified;
      patch.olympusProfitLevel = numUnified;
      patch.boxesProfitLevel = numUnified;
      patch.winterSlotsProfitLevel = numUnified;
    }

    if (hasPlinko) {
      const numPlinko = Number(req.body.plinkoProfitLevel);
      if (!Number.isFinite(numPlinko) || numPlinko < 0 || numPlinko > 10) {
        return res.status(400).json({
          success: false,
          message: 'يجب أن تكون قيمة ربح Plinko بين 0 و 10 فقط',
        });
      }
      patch.plinkoProfitLevel = numPlinko;
      effectiveLevel = numPlinko;
    }

    if (hasMines) {
      const numMines = Number(req.body.minesProfitLevel);
      if (!Number.isFinite(numMines) || numMines < 0 || numMines > 10) {
        return res.status(400).json({
          success: false,
          message: 'يجب أن تكون قيمة ربح Mines بين 0 و 10 فقط',
        });
      }
      patch.minesProfitLevel = numMines;
    }

    if (hasDice) {
      const numDice = Number(req.body.diceProfitLevel);
      if (!Number.isFinite(numDice) || numDice < 0 || numDice > 10) {
        return res.status(400).json({
          success: false,
          message: 'يجب أن تكون قيمة ربح Dice بين 0 و 10 فقط',
        });
      }
      patch.diceProfitLevel = numDice;
    }

    if (hasOlympus) {
      const numOlympus = Number(req.body.olympusProfitLevel);
      if (!Number.isFinite(numOlympus) || numOlympus < 0 || numOlympus > 10) {
        return res.status(400).json({
          success: false,
          message: 'يجب أن تكون قيمة ربح Olympus بين 0 و 10 فقط',
        });
      }
      patch.olympusProfitLevel = numOlympus;
    }

    if (hasBoxes) {
      const numBoxes = Number(req.body.boxesProfitLevel);
      if (!Number.isFinite(numBoxes) || numBoxes < 0 || numBoxes > 10) {
        return res.status(400).json({
          success: false,
          message: 'يجب أن تكون قيمة ربح الصناديق بين 0 و 10 فقط',
        });
      }
      patch.boxesProfitLevel = numBoxes;
    }

    if (hasWinterSlots) {
      const numWinter = Number(req.body.winterSlotsProfitLevel);
      if (!Number.isFinite(numWinter) || numWinter < 0 || numWinter > 10) {
        return res.status(400).json({
          success: false,
          message: 'يجب أن تكون قيمة ربح Winter Slots بين 0 و 10 فقط',
        });
      }
      patch.winterSlotsProfitLevel = numWinter;
    }

    if (hasAbsoluteStop) {
      patch.absoluteStopProfit = Boolean(req.body.absoluteStopProfit);
    }

    if (hasMaintenanceGames) {
      patch.maintenanceGames = req.body.maintenanceGames;
    }

    if (hasAiMonitor) {
      const incomingAi = req.body.aiMonitor as Record<string, unknown>;
      const profile = incomingAi.strategyProfile as AiStrategyProfile | undefined;
      const presetValues =
        profile && profile !== 'custom' && AI_STRATEGY_PRESETS[profile]
          ? AI_STRATEGY_PRESETS[profile]
          : {};
      patch.aiMonitor = normalizeAiGameMonitor({
        ...currentSettings.aiMonitor,
        ...presetValues,
        ...incomingAi,
      });
    }

    if (hasAlgorithm || hasTopTargetWinRate || hasTopMaxMult) {
      const currentAlgo = currentSettings.algorithm;
      const incomingAlgo = hasAlgorithm ? (req.body.algorithm as Record<string, unknown>) : {};
      const nextTargetWinRate =
        hasTopTargetWinRate
          ? Number(req.body.targetWinRatePercent)
          : incomingAlgo.targetWinRatePercent !== undefined
          ? Number(incomingAlgo.targetWinRatePercent)
          : currentAlgo.targetWinRatePercent;
      const nextMaxMult =
        hasTopMaxMult
          ? Number(req.body.maxAllowedMultiplier)
          : incomingAlgo.maxAllowedMultiplier !== undefined
          ? Number(incomingAlgo.maxAllowedMultiplier)
          : currentAlgo.maxAllowedMultiplier;

      const isSimplifiedPayload =
        Boolean(req.body?.simplified) ||
        hasTopTargetWinRate ||
        hasTopMaxMult ||
        (hasAlgorithm &&
          incomingAlgo.cycleWinsCount === undefined &&
          incomingAlgo.cycleLossesCount === undefined);

      if (isSimplifiedPayload) {
        const clampedRate = Math.max(0, Math.min(85, Math.round(Number(nextTargetWinRate) || 0)));
        const derivedCycleWins = clampedRate <= 0 ? 0 : clampedRate >= 55 ? 3 : clampedRate >= 35 ? 2 : 1;
        const derivedCycleLosses =
          clampedRate <= 0
            ? 8
            : Math.max(1, Math.min(12, Math.round((derivedCycleWins * (100 - clampedRate)) / Math.max(8, clampedRate))));
        const derivedSmallWinBias = Math.max(30, Math.min(95, Math.round(95 - effectiveLevel * 5.5)));
        const derivedRecovery = Math.max(0, Math.min(95, Math.round(90 - effectiveLevel * 7)));
        const derivedMaxConsec = clampedRate >= 50 ? 3 : clampedRate >= 30 ? 2 : 1;

        patch.algorithm = normalizeSmartAlgorithm({
          ...currentAlgo,
          ...incomingAlgo,
          algorithmMode: clampedRate <= 0 ? 'smart_cycle' : 'smart_cycle',
          targetWinRatePercent: clampedRate,
          maxAllowedMultiplier: nextMaxMult,
          cycleWinsCount: derivedCycleWins,
          cycleLossesCount: derivedCycleLosses,
          smallWinBiasPercent: derivedSmallWinBias,
          lossRecoveryIntensity: derivedRecovery,
          maxConsecutiveWins: derivedMaxConsec,
          highBetLossBoostPercent: Math.max(15, Math.min(90, Math.round(85 - effectiveLevel * 6))),
        });
      } else {
        patch.algorithm = normalizeSmartAlgorithm({
          ...currentAlgo,
          ...incomingAlgo,
        });
      }
    }

    const updated = saveGamesSettings(patch);
    // Reset cached player cycle plans so the new settings apply immediately on the next round
    const runtime = getAlgoRuntimeState();
    for (const key of Object.keys(runtime.players)) {
      runtime.players[key].cyclePlan = [];
      runtime.players[key].cycleCursor = 0;
    }
    scheduleSaveAlgoRuntimeState();

    await saveGamesSettingsToNeon(updated);

    return res.json({
      success: true,
      settings: updated,
      algorithm: updated.algorithm,
      aiMonitor: updated.aiMonitor,
      absoluteStopProfit: updated.absoluteStopProfit,
      maintenanceGames: updated.maintenanceGames,
      monitoredPlayers: getAiMonitoredPlayersSummary(),
      telemetry: getGamesAlgorithmTelemetry(),
      connectedGames: getConnectedGamesList(),
      message: 'تم حفظ إعدادات الألعاب ونظام الذكاء الاصطناعي بنجاح',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'فشل حفظ إعدادات الألعاب',
    });
  }
});

// 4b. Admin: Instant Toggle for Absolute Stop Profit (Zero-Profit Kill Switch across ALL games)
app.post('/api/admin/games/absolute-stop-profit', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const updated = saveGamesSettings({ absoluteStopProfit: enabled });
    await saveGamesSettingsToNeon(updated);
    return res.json({
      success: true,
      absoluteStopProfit: updated.absoluteStopProfit,
      settings: updated,
      message: enabled
        ? 'تم تفعيل الإيقاف القطعي للربح في جميع الألعاب بنجاح (0% ربح)'
        : 'تم إلغاء الإيقاف القطعي للربح وعادت الألعاب للعمل بالخوارزمية المضبوطة',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'فشل تغيير حالة إيقاف الربح القطعي',
    });
  }
});

// 4c. Admin: Instant Toggle for Per-Game Maintenance Mode
app.post('/api/admin/games/maintenance', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const gameId = String(req.body?.gameId || '').trim().toLowerCase();
    if (!gameId) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد معرف اللعبة' });
    }
    const enabled = Boolean(req.body?.enabled);
    const reasonAr =
      typeof req.body?.reasonAr === 'string' && req.body.reasonAr.trim()
        ? req.body.reasonAr.trim()
        : 'اللعبة تحت الصيانة والتطوير حالياً، يرجى المحاولة لاحقاً';
    const reasonEn =
      typeof req.body?.reasonEn === 'string' && req.body.reasonEn.trim()
        ? req.body.reasonEn.trim()
        : 'This game is currently under maintenance for development. Please check back soon.';

    const current = getGamesSettings();
    const nextMaint = {
      ...(current.maintenanceGames || {}),
      [gameId]: {
        enabled,
        reasonAr,
        reasonEn,
        updatedAt: new Date().toISOString(),
      },
    };
    const updated = saveGamesSettings({ maintenanceGames: nextMaint });
    await saveGamesSettingsToNeon(updated);
    return res.json({
      success: true,
      gameId,
      maintenance: updated.maintenanceGames[gameId],
      maintenanceGames: updated.maintenanceGames,
      message: enabled
        ? `تم تفعيل وضع الصيانة على لعبة ${gameId} وإيقافها مؤقتاً عن المستخدمين`
        : `تم إنهاء وضع الصيانة عن لعبة ${gameId} وأصبحت متاحة للاعبين`,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'فشل تحديث وضع الصيانة للعبة',
    });
  }
});

// 4d. Admin: Auto-Evolve / Develop AI Game Monitor Strategy from Live Data
app.post('/api/admin/games/ai/evolve', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const presetProfile = req.body?.strategyProfile as AiStrategyProfile | undefined;
    if (presetProfile && presetProfile !== 'custom' && AI_STRATEGY_PRESETS[presetProfile]) {
      const current = getGamesSettings();
      const verNum = parseFloat(current.aiMonitor.aiVersion) || 2.0;
      const nextVer = (Math.round((verNum + 0.1) * 10) / 10).toFixed(1);
      const updated = saveGamesSettings({
        aiMonitor: {
          ...current.aiMonitor,
          ...AI_STRATEGY_PRESETS[presetProfile],
          strategyProfile: presetProfile,
          aiVersion: nextVer,
          lastEvolvedAt: new Date().toISOString(),
          evolutionNotes: `تمت ترقية استراتيجية الذكاء الاصطناعي (${nextVer}) إلى نمط: ${presetProfile}`,
        },
      });
      await saveGamesSettingsToNeon(updated);
      return res.json({
        success: true,
        aiMonitor: updated.aiMonitor,
        settings: updated,
        message: updated.aiMonitor.evolutionNotes,
      });
    }

    const result = evolveAiMonitorFromTelemetry();
    await saveGamesSettingsToNeon(result.settings);
    return res.json({
      success: true,
      aiMonitor: result.settings.aiMonitor,
      settings: result.settings,
      message: result.summaryAr,
      summaryEn: result.summaryEn,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'فشل تطوير نظام الذكاء الاصطناعي',
    });
  }
});

// 4e. Admin: Reset Monitored AI Profile for a Player (or refresh)
app.post('/api/admin/games/ai/reset-player', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const playerId = String(req.body?.playerId || '').trim();
    const state = getAlgoRuntimeState();
    if (playerId) {
      delete state.players[playerId];
    } else {
      state.players = {};
    }
    scheduleSaveAlgoRuntimeState();
    return res.json({
      success: true,
      monitoredPlayers: getAiMonitoredPlayersSummary(),
      message: playerId ? 'تمت إعادة ضبط مراقبة الذكاء الاصطناعي للاعب' : 'تمت إعادة ضبط جميع ملفات مراقبة اللاعبين',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'فشل إعادة ضبط ملف المراقبة',
    });
  }
});

// 5. Admin: Dry-Run Simulation of Smart Algorithm (20-round sequence + 1000-round projection)
app.post('/api/admin/games/algorithm/simulate', verifyAdminAuth, async (req: Request, res: Response) => {
  try {
    const current = getGamesSettings();
    const level =
      req.body?.profitLevel !== undefined
        ? clampProfitLevel(req.body.profitLevel)
        : current.plinkoProfitLevel;
    const algo =
      req.body?.algorithm && typeof req.body.algorithm === 'object'
        ? normalizeSmartAlgorithm({ ...current.algorithm, ...req.body.algorithm })
        : current.algorithm;
    const sampleBet = Math.max(500, Math.min(1000000, Math.round(Number(req.body?.sampleBet) || 1000)));
    const simulation = simulateSmartAlgorithmSequence(level, algo, sampleBet);
    return res.json({
      success: true,
      ...simulation,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'فشل تشغيل محاكاة الخوارزمية',
    });
  }
});

// 6. Admin: Reset Games Algorithm Telemetry & Player Cycle Counters
app.post('/api/admin/games/telemetry/reset', verifyAdminAuth, async (_req: Request, res: Response) => {
  try {
    const telemetry = resetGamesAlgorithmTelemetry();
    return res.json({
      success: true,
      telemetry,
      monitoredPlayers: [],
      message: 'تم تصفير إحصائيات الخوارزمية وسجل الدورات بنجاح',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'فشل تصفير الإحصائيات',
    });
  }
});

// ==========================================
// Matchmaking Queue & Real-time Live Matches
// نظام دور المطابقة الحصري (المطابقة بين المتواجدين في الدور حصراً)
// ==========================================
function getRegisteredCountryForUser(uid?: string, fallbackCountry?: string, fallbackCity?: string): string {
  if (!uid) return fallbackCountry || fallbackCity || 'المملكة العربية السعودية';
  const allStored = getStoredUsers();
  const found = allStored.find(
    (u) =>
      u.id === uid ||
      u.displayId === uid ||
      (u.email && u.email.toLowerCase() === uid.toLowerCase())
  );
  if (found && found.country && found.country.trim()) {
    return found.country.trim();
  }
  return (fallbackCountry && fallbackCountry.trim()) ? fallbackCountry.trim() : (fallbackCity || 'المملكة العربية السعودية');
}

export interface QueueMember {
  userId: string;
  displayId: string;
  name: string;
  avatar: string;
  gender: 'male' | 'female';
  age: number;
  city: string;
  country?: string;
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
    createdAt?: string;
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
  const blockedList = getStoredBlockedUsers();
  const waitingMembers = Array.from(liveMatchingQueue.values()).filter((m) => {
    if (m.userId === seeker.userId || m.status !== 'waiting') return false;
    const isBlocked = blockedList.some((item) => {
      const bIds = [item.blockerId, item.blockerDisplayId].filter(Boolean) as string[];
      const tIds = [item.blockedId, item.blockedDisplayId].filter(Boolean) as string[];
      return (
        (bIds.includes(seeker.userId) && tIds.includes(m.userId)) ||
        (tIds.includes(seeker.userId) && bIds.includes(m.userId))
      );
    });
    return !isBlocked;
  });

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
  const storedUsers = getStoredUsers();
  recordMatchCreated(session, storedUsers);
  recordUserActivityLog({
    userId: userA.userId,
    displayId: userA.displayId,
    name: userA.name,
    action: 'match_started',
    actionLabelAr: 'مطابقة جديدة',
    details: `تمت المطابقة مع ${userB.name} (${userB.displayId || userB.userId})`,
  });
  recordUserActivityLog({
    userId: userB.userId,
    displayId: userB.displayId,
    name: userB.name,
    action: 'match_started',
    actionLabelAr: 'مطابقة جديدة',
    details: `تمت المطابقة مع ${userA.name} (${userA.displayId || userA.userId})`,
  });
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
    country,
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
      const partnerCountry = getRegisteredCountryForUser(partner.userId || partner.displayId, partner.country, partner.city);
      const partnerVerified = isUserIdentifierVerified(partner.userId) || isUserIdentifierVerified(partner.displayId);
      return res.json({
        success: true,
        matched: true,
        sessionId: session.id,
        partner: {
          ...partner,
          country: partnerCountry,
          isVerified: partnerVerified,
        },
      });
    }
  }

  const memberCountry = getRegisteredCountryForUser(userId, country, city);

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
    country: memberCountry,
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
    const partnerCountry = getRegisteredCountryForUser(partner.userId || partner.displayId, partner.country, partner.city);
    const partnerVerified = isUserIdentifierVerified(partner.userId) || isUserIdentifierVerified(partner.displayId);
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
        country: partnerCountry,
        bio: partner.bio,
        isVerified: partnerVerified,
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
      const partnerCountry = getRegisteredCountryForUser(partner.userId || partner.displayId, partner.country, partner.city);
      const partnerVerified = isUserIdentifierVerified(partner.userId) || isUserIdentifierVerified(partner.displayId);
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
          country: partnerCountry,
          bio: partner.bio,
          isVerified: partnerVerified,
        },
      });
    }
  }

  // If still waiting, try matching again against any newer entries in the queue
  const partner = findMatchInQueue(member);
  if (partner) {
    const session = createMatchSession(member, partner);
    const partnerCountry = getRegisteredCountryForUser(partner.userId || partner.displayId, partner.country, partner.city);
    const partnerVerified = isUserIdentifierVerified(partner.userId) || isUserIdentifierVerified(partner.displayId);
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
        country: partnerCountry,
        bio: partner.bio,
        isVerified: partnerVerified,
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

// 5. Get session messages and live status
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
  const partnerCountry = getRegisteredCountryForUser(partner.userId || partner.displayId, partner.country, partner.city);

  const users = getStoredUsers();
  const currentUserRecord = users.find(
    (u) =>
      u.id === userId ||
      u.displayId === userId ||
      (u.email && u.email.toLowerCase() === userId.toLowerCase())
  );

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
      country: partnerCountry,
      bio: partner.bio,
    },
    messages: session.messages,
    userCoins: currentUserRecord?.coinsBalance ?? 0,
    userDiamonds: currentUserRecord?.walletBalance ?? 0,
  });
});

// 6. Send message in match session (strictly between real users)
app.post('/api/matching/session/message', async (req, res) => {
  const { sessionId, senderId, senderName, text, isGift, giftIcon, giftName, giftCost, clientMessageId, id } = req.body;

  if (!sessionId || !senderId) {
    return res.status(400).json({ success: false, message: 'Missing parameters' });
  }

  const session = liveActiveMatches.get(sessionId);
  if (!session || session.status !== 'active') {
    return res.status(400).json({ success: false, message: 'Session is not active' });
  }

  const effectiveMsgId = String(clientMessageId || id || `m-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`).trim();
  const nowMs = Date.now();

  // Deduplication check: prevent duplicate message in match session
  const existingSessionMsg = session.messages.find(
    (m) =>
      m.id === effectiveMsgId ||
      (m.senderId === senderId && m.text === (text || '') && Math.abs(new Date(m.createdAt || 0).getTime() - nowMs) < 2500)
  );

  if (existingSessionMsg) {
    return res.json({
      success: true,
      message: existingSessionMsg,
    });
  }

  const otherMember = session.user1.userId === senderId ? session.user2 : session.user1;

  // Check if either member has blocked the other
  const matchBlockCheck = await isUserBlockedPair(senderId, otherMember.userId);
  if (matchBlockCheck.isBlocked) {
    return res.status(403).json({
      success: false,
      blocked: true,
      message: matchBlockCheck.blockedByB
        ? 'لا يمكنك مراسلة هذا المستخدم لأنه قام بحظرك'
        : 'لقد قمت بحظر هذا المستخدم. يرجى إلغاء الحظر أولاً.',
    });
  }

  // If sending a gift, deduct Coins from sender and credit Diamonds to the other member
  let giftTransfer: any = null;
  if (isGift && giftCost && Number(giftCost) > 0) {
    giftTransfer = await transferGiftCoinsToDiamonds(senderId, otherMember.userId, Number(giftCost));
    if (!giftTransfer.success) {
      return res.status(400).json({ success: false, message: giftTransfer.message || 'رصيد الكوينز غير كافٍ لإرسال هذه الهدية' });
    }
  }

  const nowUtc = new Date().toISOString();
  const newMsg = {
    id: effectiveMsgId,
    senderId,
    senderName: senderName || 'مستخدم',
    text: text || '',
    createdAt: nowUtc,
    time: nowUtc,
    isGift: Boolean(isGift),
    giftIcon,
    giftName,
    giftCost: giftCost ? Number(giftCost) : undefined,
  };

  session.messages.push(newMsg);
  recordMatchMessage(sessionId, newMsg, getStoredUsers());

  // Also persist this match message into permanent conversations so chat history is never lost!
  try {
    const messagesData = getStoredMessagesData();
    const allUsers = getStoredUsers();
    const senderUser = allUsers.find((u) => u.id === senderId || u.displayId === senderId);
    const recipientUser = allUsers.find((u) => u.id === otherMember.userId || u.displayId === otherMember.userId);
    const primarySenderKey = senderUser?.displayId || senderId;
    const primaryRecipientKey = recipientUser?.displayId || otherMember.userId;
    const canonicalConvId = `conv-${[primarySenderKey, primaryRecipientKey].sort().join('-')}`;

    let permConv: StoredConversation;
    const existingConv = messagesData.conversations.find(
      (c) =>
        c.id === canonicalConvId ||
        (c.participants.includes(senderId) && c.participants.includes(otherMember.userId))
    );

    const aliases = Array.from(
      new Set([
        senderId,
        otherMember.userId,
        ...(senderUser?.id ? [senderUser.id] : []),
        ...(senderUser?.displayId ? [senderUser.displayId] : []),
        ...(recipientUser?.id ? [recipientUser.id] : []),
        ...(recipientUser?.displayId ? [recipientUser.displayId] : []),
      ])
    );

    if (!existingConv) {
      permConv = {
        id: canonicalConvId,
        participants: aliases,
        participantDetails: {
          [senderId]: { id: senderId, displayId: senderUser?.displayId, name: senderName || senderUser?.name || 'مستخدم', avatar: senderUser?.photoUrl || '' },
          [otherMember.userId]: { id: otherMember.userId, displayId: recipientUser?.displayId, name: otherMember.name || recipientUser?.name || 'مستخدم', avatar: otherMember.avatar || recipientUser?.photoUrl || '' },
        },
        createdAt: nowUtc,
        updatedAt: nowUtc,
        messages: [],
      };
      messagesData.conversations.push(permConv);
    } else {
      permConv = existingConv;
      for (const a of aliases) {
        if (!permConv.participants.includes(a)) permConv.participants.push(a);
      }
      permConv.updatedAt = nowUtc;
    }

    permConv.messages.push({
      id: newMsg.id,
      conversationId: permConv.id,
      senderId,
      text: newMsg.text,
      isGift: Boolean(isGift),
      giftCost: giftCost ? Number(giftCost) : undefined,
      createdAt: nowUtc,
    });

    saveStoredMessagesData(messagesData);

    // Neon PostgreSQL persistence for matching conversation
    if (neonPool && verifiedNeonTables.conversations && verifiedNeonTables.messages) {
      neonPool.query(
        `INSERT INTO conversations (id, created_at, updated_at) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at`,
        [permConv.id, permConv.createdAt, nowUtc]
      ).catch(() => {});

      for (const p of permConv.participants) {
        if (p && !p.startsWith('conv-')) {
          neonPool.query(
            `INSERT INTO conversation_participants (id, conversation_id, user_id, created_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (conversation_id, user_id) DO NOTHING`,
            [crypto.randomUUID(), permConv.id, p]
          ).catch(() => {});
        }
      }

      neonPool.query(
        `INSERT INTO messages (id, conversation_id, sender_id, text, is_gift, gift_cost, created_at, sender_name, gift_icon, gift_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO NOTHING`,
        [
          newMsg.id,
          permConv.id,
          senderId,
          newMsg.text,
          Boolean(isGift),
          giftCost ? Number(giftCost) : null,
          nowUtc,
          senderName || 'مستخدم',
          giftIcon || null,
          giftName || null,
        ]
      ).catch(() => {});
    }
  } catch (matchPersistErr) {
    console.warn('Match message permanent persistence warning:', matchPersistErr);
  }

  return res.json({
    success: true,
    message: newMsg,
    senderCoins: giftTransfer?.senderCoins,
    recipientDiamonds: giftTransfer?.recipientDiamonds,
  });
});

// 8. End match session (Close / Exit)
app.post('/api/matching/session/end', (req, res) => {
  const { sessionId, userId, action = 'close' } = req.body;

  if (sessionId) {
    const session = liveActiveMatches.get(sessionId);
    if (session) {
      session.status = 'ended';
      session.endedBy = userId;
      session.endedReason = action === 'next' ? 'next_match' : 'closed';
      recordMatchEnded(sessionId, userId, session.endedReason);

      // Clean queue mappings for both users so they are free from the match
      liveMatchingQueue.delete(session.user1.userId);
      liveMatchingQueue.delete(session.user2.userId);

      // Keep ended session for 30 seconds so the partner's poll receives 'ended' status, then delete
      setTimeout(() => {
        liveActiveMatches.delete(sessionId);
      }, 30000);
    }
  }

  if (userId) {
    liveMatchingQueue.delete(userId);
  }

  return res.json({ success: true });
});

registerSupremeRoutes(app, {
  getStoredUsers,
  saveStoredUsers,
  getStoredSessions,
  saveStoredSessions,
  hashPassword,
  defaultAdminPassword: DEFAULT_ADMIN_PASSWORD,
  getAdminPin,
  deleteUserCompletely,
  updateUserPassword: async (targetUserId: string, newPassword: string) => {
    const users = getStoredUsers();
    const cleanTarget = targetUserId.trim().toLowerCase();
    const user = users.find(
      (u) =>
        u.id.toLowerCase() === cleanTarget ||
        (u.displayId && u.displayId.toLowerCase() === cleanTarget) ||
        u.email.toLowerCase() === cleanTarget
    );
    if (!user) {
      return { success: false, message: 'لم يتم العثور على المستخدم' };
    }
    const newHash = hashPassword(newPassword);
    user.passwordHash = newHash;
    user.updatedAt = new Date().toISOString();
    saveStoredUsers(users);
    await updateNeonProfileByIdentifier(user.id, { passwordHash: newHash }).catch(() => {});
    return { success: true, message: 'تم تحديث كلمة المرور بنجاح' };
  },
  getGeneralLogSources: () => {
    const friendsData = getStoredFriendsData();
    const messagesData = getStoredMessagesData();
    const botStore = getBotReferralStore();
    return {
      users: getStoredUsers(),
      deletedUserKeys: Array.from(getDeletedUserKeys()),
      conversations: messagesData.conversations || [],
      agents: getStoredAgents(),
      deletedAgentKeys: Array.from(getDeletedAgentKeys()),
      agencyTransactions: getStoredAgencyTransactions(),
      agencyWithdrawals: getStoredAgencyWithdrawals(),
      friends: friendsData.friends || [],
      friendRequests: friendsData.requests || [],
      blockedUsers: getStoredBlockedUsers(),
      feedbackReports: getStoredFeedbackReports(),
      passwordResetRequests: getStoredPasswordResetRequests(),
      verificationRequests: getStoredVerificationRequests(),
      botReferrals: {
        users: botStore.users || [],
        events: botStore.events || [],
        transfers: botStore.transfers || [],
      },
      sessions: getStoredSessions(),
    };
  },
});

registerGoldenTreeRoutes(app, {
  verifyAdminAuth,
  resolvePlayerAccountForGames,
  saveStoredUsers,
  updateNeonProfileByIdentifier,
  getAppSettings,
  recordPlayerGameOutcome,
  evaluateUnifiedGameDecision,
  getUnifiedGamesSettings: getGamesSettings,
  getGameMaintenance: getGameMaintenanceStatus,
  getNeonPool: () => neonPool,
  betAmounts: GAME_BET_AMOUNTS,
});

// ==========================================
// Admin Quick Account Switcher (ADMIN1 / ADMIN2 Only)
// ==========================================
const ADMIN_LINKED_ACCOUNTS_FILE = path.resolve(DATA_DIR, 'admin_linked_accounts.json');

interface AdminLinkedAccountRecord {
  id: string;
  adminEmail: string;
  linkedUserId: string;
  linkedDisplayId?: string;
  linkedEmail: string;
  addedByMethod: 'login' | 'register';
  addedAt: string;
}

let adminLinkedAccountsNeonInitialized = false;

async function ensureAdminLinkedAccountsNeonTable() {
  if (!neonPool || adminLinkedAccountsNeonInitialized) return;
  try {
    await withTimeout(
      neonPool.query(`
        CREATE TABLE IF NOT EXISTS admin_linked_accounts (
          id TEXT PRIMARY KEY,
          admin_email TEXT NOT NULL,
          linked_user_id TEXT NOT NULL,
          linked_display_id TEXT,
          linked_email TEXT NOT NULL,
          added_by_method TEXT NOT NULL DEFAULT 'login',
          added_at TEXT NOT NULL
        );
      `),
      4000
    );
    adminLinkedAccountsNeonInitialized = true;
  } catch (err) {
    console.warn('Admin linked accounts Neon init warning:', err);
  }
}

function getStoredAdminLinkedAccounts(): AdminLinkedAccountRecord[] {
  try {
    if (!fs.existsSync(ADMIN_LINKED_ACCOUNTS_FILE)) return [];
    const raw = fs.readFileSync(ADMIN_LINKED_ACCOUNTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredAdminLinkedAccounts(records: AdminLinkedAccountRecord[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ADMIN_LINKED_ACCOUNTS_FILE, JSON.stringify(records, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Failed to save admin linked accounts:', err);
  }
}

async function syncAdminLinkedAccountsWithNeon(): Promise<AdminLinkedAccountRecord[]> {
  const local = getStoredAdminLinkedAccounts();
  if (!neonPool) return local;
  try {
    await ensureAdminLinkedAccountsNeonTable();
    const res: any = await withTimeout(
      neonPool.query('SELECT id, admin_email, linked_user_id, linked_display_id, linked_email, added_by_method, added_at FROM admin_linked_accounts ORDER BY added_at DESC'),
      4000
    );
    if (res?.rows && res.rows.length > 0) {
      const merged = new Map<string, AdminLinkedAccountRecord>();
      for (const r of local) merged.set(`${r.adminEmail.toLowerCase()}::${r.linkedEmail.toLowerCase()}`, r);
      for (const row of res.rows) {
        const key = `${String(row.admin_email || '').toLowerCase()}::${String(row.linked_email || '').toLowerCase()}`;
        if (!merged.has(key)) {
          merged.set(key, {
            id: row.id,
            adminEmail: String(row.admin_email || '').toLowerCase(),
            linkedUserId: row.linked_user_id,
            linkedDisplayId: row.linked_display_id || undefined,
            linkedEmail: String(row.linked_email || '').toLowerCase(),
            addedByMethod: row.added_by_method === 'register' ? 'register' : 'login',
            addedAt: row.added_at || new Date().toISOString(),
          });
        }
      }
      const list = Array.from(merged.values());
      saveStoredAdminLinkedAccounts(list);
      return list;
    }
  } catch {}
  return local;
}

function getSwitcherSigningSecret(): string {
  const pin = getAdminPin();
  return crypto
    .createHash('sha256')
    .update(`SOULX_SWITCHER_SECRET:${pin || 'NO_PIN'}:${process.env.ADMIN1 || ''}:${process.env.ADMIN2 || ''}`)
    .digest('hex');
}

function signAdminSwitchOriginToken(adminEmail: string, adminUserId: string, switchedUserId: string): string {
  const payload = {
    type: 'admin_switch_origin',
    adminEmail: adminEmail.trim().toLowerCase(),
    adminUserId,
    switchedUserId,
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(12).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSwitcherSigningSecret()).update(payloadB64).digest('base64url');
  return `sx_sw_${payloadB64}.${sig}`;
}

function verifyAdminSwitchOriginToken(
  token: string,
  expectedSwitchedUserId?: string
): { valid: boolean; adminEmail?: string; adminUserId?: string; switchedUserId?: string } {
  try {
    if (!token || typeof token !== 'string' || !token.startsWith('sx_sw_')) {
      return { valid: false };
    }
    const raw = token.slice(6);
    const [payloadB64, sig] = raw.split('.');
    if (!payloadB64 || !sig) return { valid: false };
    const expectedSig = crypto.createHmac('sha256', getSwitcherSigningSecret()).update(payloadB64).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { valid: false };
    }
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (!parsed || parsed.type !== 'admin_switch_origin' || !parsed.adminEmail) {
      return { valid: false };
    }
    const adminEmails = getAdminEmails();
    if (!adminEmails.includes(String(parsed.adminEmail).toLowerCase())) {
      return { valid: false };
    }
    if (
      expectedSwitchedUserId &&
      parsed.switchedUserId &&
      String(parsed.switchedUserId).toLowerCase() !== String(expectedSwitchedUserId).toLowerCase()
    ) {
      return { valid: false };
    }
    return {
      valid: true,
      adminEmail: String(parsed.adminEmail).toLowerCase(),
      adminUserId: parsed.adminUserId,
      switchedUserId: parsed.switchedUserId,
    };
  } catch {
    return { valid: false };
  }
}

function signAdminSwitchUnlockToken(adminEmail: string, switchedUserId: string): string {
  const payload = {
    type: 'admin_switch_unlock',
    adminEmail: adminEmail.trim().toLowerCase(),
    switchedUserId,
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
    nonce: crypto.randomBytes(10).toString('hex'),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto.createHmac('sha256', getSwitcherSigningSecret()).update(payloadB64).digest('base64url');
  return `sx_swu_${payloadB64}.${sig}`;
}

function verifyAdminSwitchUnlockToken(
  token: string,
  expectedAdminEmail: string,
  expectedSwitchedUserId?: string
): boolean {
  try {
    if (!token || typeof token !== 'string' || !token.startsWith('sx_swu_')) return false;
    const raw = token.slice(7);
    const [payloadB64, sig] = raw.split('.');
    if (!payloadB64 || !sig) return false;
    const expectedSig = crypto.createHmac('sha256', getSwitcherSigningSecret()).update(payloadB64).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (!parsed || parsed.type !== 'admin_switch_unlock') return false;
    if (!parsed.expiresAt || Number(parsed.expiresAt) < Date.now()) return false;
    if (String(parsed.adminEmail || '').toLowerCase() !== expectedAdminEmail.toLowerCase()) return false;
    if (
      expectedSwitchedUserId &&
      parsed.switchedUserId &&
      String(parsed.switchedUserId).toLowerCase() !== expectedSwitchedUserId.toLowerCase()
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function serializeSwitchedUser(u: StoredUser, isTargetAdmin: boolean) {
  return {
    id: u.id,
    displayId: u.displayId,
    name: u.name,
    email: u.email,
    photoUrl: u.photoUrl,
    createdAt: u.createdAt,
    birthDate: u.birthDate || null,
    gender: u.gender || null,
    country: u.country || null,
    bio: u.bio || getDefaultUserBio(),
    walletBalance: u.walletBalance ?? (isTargetAdmin ? 99999 : 0),
    coinsBalance: u.coinsBalance ?? (isTargetAdmin ? 100000 : 0),
    isAdmin: isTargetAdmin,
    twoFactorEnabled: Boolean(u.twoFactorEnabled),
    isBanned: Boolean(u.isBanned),
    bannedAt: u.bannedAt || null,
    banReason: u.banReason || null,
    isFrozen: Boolean(u.isFrozen),
    frozenAt: u.frozenAt || null,
    freezeDurationMinutes: u.freezeDurationMinutes || null,
    freezeExpiresAt: u.freezeExpiresAt || null,
    freezeReason: u.freezeReason || null,
    isVerified: Boolean(u.isVerified),
  };
}

function resolveUserRecordByAnyId(idOrEmail: string): StoredUser | undefined {
  const clean = String(idOrEmail || '').trim().toLowerCase();
  if (!clean) return undefined;
  return getStoredUsers().find(
    (u) =>
      u.id.toLowerCase() === clean ||
      u.email.toLowerCase() === clean ||
      (u.displayId && u.displayId.toLowerCase() === clean)
  );
}

function ensureAdminRecordExists(adminEmail: string): StoredUser {
  const norm = adminEmail.trim().toLowerCase();
  const users = getStoredUsers();
  let adminUser = users.find((u) => u.email.toLowerCase() === norm);
  if (adminUser) return adminUser;

  const admin1Email = (process.env.ADMIN1 || '').trim().toLowerCase();
  const isAdmin1 = Boolean(admin1Email && norm === admin1Email);
  adminUser = {
    id: isAdmin1 ? 'admin-1001' : 'admin-1002',
    displayId: isAdmin1 ? '1' : '2',
    email: norm,
    name: isAdmin1 ? 'مدير النظام (ADMIN1)' : 'مدير النظام (ADMIN2)',
    passwordHash: '',
    createdAt: new Date().toISOString(),
    birthDate: '1995-01-01',
    gender: 'male',
    walletBalance: 99999,
    coinsBalance: 100000,
  };
  users.push(adminUser);
  saveStoredUsers(users);
  return adminUser;
}

async function resolveSwitcherContext(req: Request, requireUnlockedIfSwitched = true): Promise<{
  authorized: boolean;
  mode?: 'admin' | 'switched';
  adminEmail?: string;
  currentUser?: any;
  isCurrentAdmin?: boolean;
  requiresPin?: boolean;
  pinVerified?: boolean;
  errorStatus?: number;
  errorMessage?: string;
}> {
  const authHeader = (req.headers['authorization'] as string) || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  const refreshToken = ((req.headers['x-refresh-token'] as string) || '').trim();
  const originToken = ((req.headers['x-admin-switch-origin'] as string) || '').trim();
  const unlockToken = ((req.headers['x-admin-switch-unlock'] as string) || '').trim();
  const pinInput = String(req.body?.pin || req.headers['x-admin-pin'] || '').trim();

  if (!bearerToken && !refreshToken) {
    return { authorized: false, errorStatus: 401, errorMessage: 'يرجى تسجيل الدخول أولاً' };
  }

  const verified = await verifyToken(bearerToken, refreshToken);
  if (!verified.valid || !verified.user) {
    return { authorized: false, errorStatus: 401, errorMessage: 'جلسة الدخول منتهية أو غير صالحة' };
  }

  const adminEmails = getAdminEmails();
  const currentUserEmail = String(verified.user.email || '').toLowerCase();
  const isAdminUser = Boolean(verified.isAdmin && adminEmails.includes(currentUserEmail));

  if (isAdminUser) {
    return {
      authorized: true,
      mode: 'admin',
      adminEmail: currentUserEmail,
      currentUser: verified.user,
      isCurrentAdmin: true,
      requiresPin: false,
      pinVerified: true,
    };
  }

  // Non-admin user: MUST hold a valid signed Admin Switch Origin Token bound to this user!
  if (!originToken) {
    return { authorized: false, errorStatus: 403, errorMessage: 'غير مصرح بالوصول إلى تبديل الحسابات' };
  }

  const originCheck = verifyAdminSwitchOriginToken(originToken, verified.user.id);
  if (!originCheck.valid || !originCheck.adminEmail) {
    return { authorized: false, errorStatus: 403, errorMessage: 'رمز جلسة تبديل الأدمن غير صالح أو منتهي' };
  }

  const expectedPin = getAdminPin();
  let pinVerified = false;
  if (pinInput && expectedPin && pinInput === expectedPin) {
    pinVerified = true;
  } else if (unlockToken && verifyAdminSwitchUnlockToken(unlockToken, originCheck.adminEmail, verified.user.id)) {
    pinVerified = true;
  }

  if (requireUnlockedIfSwitched && !pinVerified) {
    return {
      authorized: false,
      mode: 'switched',
      adminEmail: originCheck.adminEmail,
      currentUser: verified.user,
      isCurrentAdmin: false,
      requiresPin: true,
      pinVerified: false,
      errorStatus: 403,
      errorMessage: !expectedPin
        ? 'لم يتم تعيين رمز ADMIN_PIN في إعدادات الخادم'
        : pinInput
        ? 'كلمة مرور لوحة التحكم (PIN) غير صحيحة'
        : 'يرجى إدخال كلمة مرور لوحة التحكم (PIN) للمتابعة',
    };
  }

  return {
    authorized: true,
    mode: 'switched',
    adminEmail: originCheck.adminEmail,
    currentUser: verified.user,
    isCurrentAdmin: false,
    requiresPin: true,
    pinVerified,
  };
}

async function buildSwitcherAccountsResponse(adminEmail: string) {
  const allLinks = await syncAdminLinkedAccountsWithNeon();
  const adminEmails = getAdminEmails();
  const adminUser = ensureAdminRecordExists(adminEmail);

  const adminLinks = allLinks.filter((l) => l.adminEmail.toLowerCase() === adminEmail.toLowerCase());
  const accounts = adminLinks
    .map((link) => {
      const u = resolveUserRecordByAnyId(link.linkedUserId) || resolveUserRecordByAnyId(link.linkedEmail);
      if (!u) return null;
      const isUAdmin = adminEmails.includes(u.email.toLowerCase());
      return {
        linkId: link.id,
        userId: u.id,
        displayId: u.displayId || link.linkedDisplayId,
        name: u.name,
        email: u.email,
        photoUrl: u.photoUrl || null,
        gender: u.gender || null,
        country: u.country || null,
        isAdmin: isUAdmin,
        isVerified: Boolean(u.isVerified),
        isBanned: Boolean(u.isBanned),
        isFrozen: Boolean(u.isFrozen),
        addedByMethod: link.addedByMethod,
        addedAt: link.addedAt,
      };
    })
    .filter(Boolean);

  return {
    adminAccount: {
      userId: adminUser.id,
      displayId: adminUser.displayId,
      name: adminUser.name,
      email: adminUser.email,
      photoUrl: adminUser.photoUrl || null,
      gender: adminUser.gender || null,
      isAdmin: true,
      isVerified: Boolean(adminUser.isVerified),
    },
    accounts,
  };
}

const tempSwitcher2FAStore = new Map<
  string,
  {
    adminEmail: string;
    targetUserId: string;
    targetEmail: string;
    expiresAt: number;
  }
>();

// 1. Check quick switcher eligibility (returns NO linked accounts for normal users!)
app.get('/api/admin-switcher/status', async (req: Request, res: Response) => {
  const ctx = await resolveSwitcherContext(req, false);
  if (!ctx.authorized) {
    return res.json({ success: true, eligible: false });
  }
  if (ctx.mode === 'admin') {
    return res.json({
      success: true,
      eligible: true,
      mode: 'admin',
      requiresPin: false,
    });
  }
  return res.json({
    success: true,
    eligible: true,
    mode: 'switched',
    requiresPin: true,
  });
});

// 2. Unlock switcher from a switched regular account using ADMIN_PIN only
app.post('/api/admin-switcher/unlock', async (req: Request, res: Response) => {
  const ctx = await resolveSwitcherContext(req, true);
  if (!ctx.authorized || !ctx.adminEmail) {
    return res.status(ctx.errorStatus || 403).json({
      success: false,
      message: ctx.errorMessage || 'كلمة مرور لوحة التحكم غير صحيحة',
    });
  }

  const unlockToken = signAdminSwitchUnlockToken(ctx.adminEmail, ctx.currentUser?.id || '');
  const payload = await buildSwitcherAccountsResponse(ctx.adminEmail);
  return res.json({
    success: true,
    unlockToken,
    ...payload,
  });
});

// 3. Get linked accounts (only for active Admin OR unlocked switched session)
app.get('/api/admin-switcher/accounts', async (req: Request, res: Response) => {
  const ctx = await resolveSwitcherContext(req, true);
  if (!ctx.authorized || !ctx.adminEmail) {
    return res.status(ctx.errorStatus || 403).json({
      success: false,
      message: ctx.errorMessage || 'غير مصرح بالوصول',
    });
  }

  const payload = await buildSwitcherAccountsResponse(ctx.adminEmail);
  return res.json({
    success: true,
    mode: ctx.mode,
    ...payload,
  });
});

// 4. Add linked account by logging into an existing real account (email + password + optional 2FA)
app.post('/api/admin-switcher/link-existing', async (req: Request, res: Response) => {
  const ctx = await resolveSwitcherContext(req, true);
  if (!ctx.authorized || !ctx.adminEmail) {
    return res.status(ctx.errorStatus || 403).json({
      success: false,
      message: ctx.errorMessage || 'غير مصرح بالوصول',
    });
  }

  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'يرجى إدخال البريد الإلكتروني وكلمة المرور للحساب المراد ربطه',
    });
  }

  const normalized = String(email).trim().toLowerCase();
  if (normalized === ctx.adminEmail.toLowerCase()) {
    return res.status(400).json({
      success: false,
      message: 'هذا هو حساب الأدمن الأساسي ومرتبط تلقائياً بالفعل',
    });
  }

  const adminEmails = getAdminEmails();
  const isTargetAdminEmail = adminEmails.includes(normalized);
  const users = getStoredUsers();
  let targetUser = users.find((u) => u.email.toLowerCase() === normalized);

  if (!targetUser && neonPool) {
    try {
      const neonProfile = await getNeonProfileByIdentifier(normalized);
      if (neonProfile) {
        targetUser = {
          id: neonProfile.id,
          displayId: neonProfile.display_id || generateSoulXId(),
          email: neonProfile.email || normalized,
          name: neonProfile.name || normalized.split('@')[0],
          passwordHash: neonProfile.password_hash || '',
          createdAt: neonProfile.created_at || new Date().toISOString(),
          birthDate: neonProfile.birth_date || null,
          gender: neonProfile.gender || null,
          country: neonProfile.country || null,
          walletBalance: parseDbNumber(neonProfile.wallet_balance, isTargetAdminEmail ? 99999 : 0),
          coinsBalance: parseDbNumber(neonProfile.coins_balance, isTargetAdminEmail ? 100000 : 0),
          photoUrl: neonProfile.avatar_url || undefined,
          bio: neonProfile.bio || undefined,
        };
        users.push(targetUser);
        saveStoredUsers(users);
      }
    } catch {}
  }

  if (isTargetAdminEmail) {
    const passMatch = Boolean(
      (targetUser && targetUser.passwordHash && targetUser.passwordHash === hashPassword(password)) ||
        (!targetUser?.passwordHash && password === DEFAULT_ADMIN_PASSWORD)
    );
    if (!passMatch) {
      return res.status(401).json({
        success: false,
        message: 'كلمة المرور غير صحيحة لحساب الأدمن',
      });
    }
    if (!targetUser) {
      targetUser = ensureAdminRecordExists(normalized);
    }
  } else {
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'هذا البريد الإلكتروني غير مسجل، يمكنك اختيار إنشاء حساب جديد حقيقي',
      });
    }
    if (targetUser.passwordHash && targetUser.passwordHash !== hashPassword(password)) {
      return res.status(401).json({
        success: false,
        message: 'كلمة المرور غير صحيحة، يرجى التحقق وإعادة المحاولة',
      });
    }
  }

  const allLinks = await syncAdminLinkedAccountsWithNeon();
  const alreadyLinked = allLinks.some(
    (l) =>
      l.adminEmail.toLowerCase() === ctx.adminEmail!.toLowerCase() &&
      (l.linkedEmail.toLowerCase() === targetUser!.email.toLowerCase() || l.linkedUserId === targetUser!.id)
  );
  if (alreadyLinked) {
    return res.status(409).json({
      success: false,
      message: 'هذا الحساب مرتبط بالفعل في قائمة تبديل الحسابات',
    });
  }

  // Require real 2FA verification if target account has 2FA enabled
  if (targetUser.twoFactorEnabled && targetUser.twoFactorSecret) {
    const tempToken = `sw_2fa_${crypto.randomBytes(24).toString('hex')}`;
    tempSwitcher2FAStore.set(tempToken, {
      adminEmail: ctx.adminEmail,
      targetUserId: targetUser.id,
      targetEmail: targetUser.email,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return res.json({
      success: true,
      requires2FA: true,
      tempToken,
      user: {
        id: targetUser.id,
        displayId: targetUser.displayId,
        name: targetUser.name,
        email: targetUser.email,
      },
    });
  }

  const newLink: AdminLinkedAccountRecord = {
    id: `link_${crypto.randomBytes(8).toString('hex')}`,
    adminEmail: ctx.adminEmail.toLowerCase(),
    linkedUserId: targetUser.id,
    linkedDisplayId: targetUser.displayId,
    linkedEmail: targetUser.email.toLowerCase(),
    addedByMethod: 'login',
    addedAt: new Date().toISOString(),
  };

  allLinks.unshift(newLink);
  saveStoredAdminLinkedAccounts(allLinks);
  if (neonPool) {
    await ensureAdminLinkedAccountsNeonTable();
    await neonPool
      .query(
        'INSERT INTO admin_linked_accounts (id, admin_email, linked_user_id, linked_display_id, linked_email, added_by_method, added_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
        [newLink.id, newLink.adminEmail, newLink.linkedUserId, newLink.linkedDisplayId || null, newLink.linkedEmail, newLink.addedByMethod, newLink.addedAt]
      )
      .catch(() => {});
  }

  recordGeneralSiteLog({
    category: 'admin',
    actorRole: ctx.adminEmail === getAdmin1Email() ? 'ADMIN1' : 'ADMIN2',
    email: ctx.adminEmail,
    userId: ctx.currentUser?.id,
    userName: ctx.currentUser?.name || ctx.adminEmail,
    targetUserId: targetUser.id,
    targetDisplayId: targetUser.displayId,
    targetEmail: targetUser.email,
    targetName: targetUser.name,
    action: 'admin_link_existing_account',
    actionLabelAr: 'ربط حساب حالي في مبدّل الأدمن',
    details: `ربط الحساب ${targetUser.name} (${targetUser.email})`,
    ip: getClientIp(req),
    status: 'success',
  });

  const payload = await buildSwitcherAccountsResponse(ctx.adminEmail);
  return res.json({
    success: true,
    message: `تم ربط حساب ${targetUser.name} بنجاح`,
    ...payload,
  });
});

// 4b. Complete 2FA verification when linking a 2FA-protected existing account
app.post('/api/admin-switcher/link-existing/verify-2fa', async (req: Request, res: Response) => {
  const ctx = await resolveSwitcherContext(req, true);
  if (!ctx.authorized || !ctx.adminEmail) {
    return res.status(ctx.errorStatus || 403).json({
      success: false,
      message: ctx.errorMessage || 'غير مصرح بالوصول',
    });
  }

  const { tempToken, code } = req.body;
  if (!tempToken || !code) {
    return res.status(400).json({ success: false, message: 'رمز التحقق مطلوب' });
  }

  const pending = tempSwitcher2FAStore.get(String(tempToken));
  if (!pending || pending.expiresAt < Date.now() || pending.adminEmail.toLowerCase() !== ctx.adminEmail.toLowerCase()) {
    tempSwitcher2FAStore.delete(String(tempToken));
    return res.status(401).json({ success: false, message: 'انتهت جلسة التحقق الثنائي، يرجى المحاولة مرة أخرى' });
  }

  const users = getStoredUsers();
  const targetIndex = users.findIndex(
    (u) => u.id === pending.targetUserId || u.email.toLowerCase() === pending.targetEmail.toLowerCase()
  );
  if (targetIndex === -1) {
    return res.status(404).json({ success: false, message: 'لم يتم العثور على الحساب' });
  }

  const targetUser = users[targetIndex];
  const cleanCode = String(code).trim().toUpperCase();
  let isValid = false;
  if (/^\d{6}$/.test(cleanCode) && targetUser.twoFactorSecret) {
    isValid = verifyTOTP(cleanCode, targetUser.twoFactorSecret, 1);
  }
  if (!isValid && Array.isArray(targetUser.twoFactorBackupCodes)) {
    const normInput = cleanCode.replace(/[^A-Z0-9]/g, '');
    const idx = targetUser.twoFactorBackupCodes.findIndex((b) => b.replace(/[^A-Z0-9]/g, '').toUpperCase() === normInput);
    if (idx !== -1) {
      isValid = true;
      targetUser.twoFactorBackupCodes.splice(idx, 1);
      users[targetIndex] = targetUser;
      saveStoredUsers(users);
    }
  }

  if (!isValid) {
    return res.status(400).json({ success: false, message: 'رمز المصادقة الثنائية غير صحيح' });
  }

  tempSwitcher2FAStore.delete(String(tempToken));

  const allLinks = await syncAdminLinkedAccountsWithNeon();
  const alreadyLinked = allLinks.some(
    (l) =>
      l.adminEmail.toLowerCase() === ctx.adminEmail!.toLowerCase() &&
      (l.linkedEmail.toLowerCase() === targetUser.email.toLowerCase() || l.linkedUserId === targetUser.id)
  );
  if (!alreadyLinked) {
    const newLink: AdminLinkedAccountRecord = {
      id: `link_${crypto.randomBytes(8).toString('hex')}`,
      adminEmail: ctx.adminEmail.toLowerCase(),
      linkedUserId: targetUser.id,
      linkedDisplayId: targetUser.displayId,
      linkedEmail: targetUser.email.toLowerCase(),
      addedByMethod: 'login',
      addedAt: new Date().toISOString(),
    };
    allLinks.unshift(newLink);
    saveStoredAdminLinkedAccounts(allLinks);
    if (neonPool) {
      await ensureAdminLinkedAccountsNeonTable();
      await neonPool
        .query(
          'INSERT INTO admin_linked_accounts (id, admin_email, linked_user_id, linked_display_id, linked_email, added_by_method, added_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
          [newLink.id, newLink.adminEmail, newLink.linkedUserId, newLink.linkedDisplayId || null, newLink.linkedEmail, newLink.addedByMethod, newLink.addedAt]
        )
        .catch(() => {});
    }
  }

  const payload = await buildSwitcherAccountsResponse(ctx.adminEmail);
  return res.json({
    success: true,
    message: `تم التحقق وربط حساب ${targetUser.name} بنجاح`,
    ...payload,
  });
});

// 5. Add linked account by creating a brand new REAL account with mandatory user details
app.post('/api/admin-switcher/create-and-link', async (req: Request, res: Response) => {
  const ctx = await resolveSwitcherContext(req, true);
  if (!ctx.authorized || !ctx.adminEmail) {
    return res.status(ctx.errorStatus || 403).json({
      success: false,
      message: ctx.errorMessage || 'غير مصرح بالوصول',
    });
  }

  const { email, name, password, birthDate, gender, country } = req.body;
  if (!email || !name || !password) {
    return res.status(400).json({
      success: false,
      message: 'يرجى كتابة البريد الإلكتروني والاسم وكلمة المرور للمتابعة',
    });
  }
  if (!gender || (gender !== 'male' && gender !== 'female')) {
    return res.status(400).json({
      success: false,
      message: 'تحديد الجنس (ذكر / أنثى) خطوة إجبارية لإنشاء الحساب الحقيقي',
    });
  }
  if (!country || typeof country !== 'string' || !country.trim()) {
    return res.status(400).json({
      success: false,
      message: 'اختيار الدولة خطوة إجبارية لإنشاء الحساب الحقيقي',
    });
  }
  if (!birthDate || typeof birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return res.status(400).json({
      success: false,
      message: 'تحديد تاريخ الميلاد خطوة إجبارية لإنشاء الحساب الحقيقي',
    });
  }

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
      message: 'يجب أن يكون العمر 18 عاماً أو أكثر لإنشاء الحساب',
    });
  }

  const normalized = String(email).trim().toLowerCase();
  if (!normalized.includes('@') || !normalized.includes('.')) {
    return res.status(400).json({
      success: false,
      message: 'يرجى إدخال بريد إلكتروني صحيح',
    });
  }
  if (String(password).length < 4) {
    return res.status(400).json({
      success: false,
      message: 'كلمة المرور يجب أن لا تقل عن 4 خانات',
    });
  }

  const users = getStoredUsers();
  if (users.some((u) => u.email.toLowerCase() === normalized)) {
    return res.status(409).json({
      success: false,
      message: 'هذا البريد مسجل مسبقاً، يرجى استخدام خيار تسجيل الدخول إلى حساب حالي',
    });
  }

  if (neonPool) {
    try {
      const neonCheck: any = await withTimeout(
        neonPool.query('SELECT id FROM profiles WHERE email = LOWER($1) LIMIT 1', [normalized]),
        4000
      );
      if (neonCheck?.rows && neonCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'هذا البريد مسجل مسبقاً في قاعدة البيانات، استخدم تسجيل الدخول إلى حساب حالي',
        });
      }
    } catch {}
  }

  const cleanCountry = country.trim();
  const displayId = generateSoulXId();
  const createdUserId = crypto.randomUUID();
  const hashedPass = hashPassword(password);
  const isNewUserAdmin = getAdminEmails().includes(normalized);

  const newUser: StoredUser = {
    id: createdUserId,
    displayId,
    email: normalized,
    name: String(name).trim(),
    passwordHash: hashedPass,
    createdAt: new Date().toISOString(),
    birthDate,
    gender,
    country: cleanCountry,
    bio: getDefaultUserBio(),
    walletBalance: isNewUserAdmin ? 99999 : 0,
    coinsBalance: isNewUserAdmin ? 100000 : 0,
  };

  users.push(newUser);
  saveStoredUsers(users);

  const neonSaveRes = await saveProfileToNeon(newUser);
  if (!neonSaveRes.success && neonPool) {
    await autoMigrateNeonSchema().catch(() => {});
    await saveProfileToNeon(newUser).catch(() => {});
  }

  const allLinks = await syncAdminLinkedAccountsWithNeon();
  const newLink: AdminLinkedAccountRecord = {
    id: `link_${crypto.randomBytes(8).toString('hex')}`,
    adminEmail: ctx.adminEmail.toLowerCase(),
    linkedUserId: newUser.id,
    linkedDisplayId: newUser.displayId,
    linkedEmail: newUser.email.toLowerCase(),
    addedByMethod: 'register',
    addedAt: new Date().toISOString(),
  };
  allLinks.unshift(newLink);
  saveStoredAdminLinkedAccounts(allLinks);
  if (neonPool) {
    await ensureAdminLinkedAccountsNeonTable();
    await neonPool
      .query(
        'INSERT INTO admin_linked_accounts (id, admin_email, linked_user_id, linked_display_id, linked_email, added_by_method, added_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
        [newLink.id, newLink.adminEmail, newLink.linkedUserId, newLink.linkedDisplayId || null, newLink.linkedEmail, newLink.addedByMethod, newLink.addedAt]
      )
      .catch(() => {});
  }

  recordUserActivityLog({
    userId: newUser.id,
    displayId: newUser.displayId,
    email: newUser.email,
    name: newUser.name,
    action: 'register',
    actionLabelAr: 'إنشاء حساب جديد عبر مبدّل الأدمن',
    details: `الدولة: ${cleanCountry} | الجنس: ${gender}`,
    ip: getClientIp(req),
  });

  recordGeneralSiteLog({
    category: 'admin',
    actorRole: ctx.adminEmail === getAdmin1Email() ? 'ADMIN1' : 'ADMIN2',
    email: ctx.adminEmail,
    userId: ctx.currentUser?.id,
    userName: ctx.currentUser?.name || ctx.adminEmail,
    targetUserId: newUser.id,
    targetDisplayId: newUser.displayId,
    targetEmail: newUser.email,
    targetName: newUser.name,
    action: 'admin_create_and_link_account',
    actionLabelAr: 'إنشاء وربط حساب حقيقي جديد من مبدّل الأدمن',
    details: `تم إنشاء ${newUser.name} (${newUser.email}) - ${cleanCountry}`,
    ip: getClientIp(req),
    status: 'success',
  });

  const payload = await buildSwitcherAccountsResponse(ctx.adminEmail);
  return res.json({
    success: true,
    message: `تم إنشاء الحساب الحقيقي "${newUser.name}" وربطه بنجاح`,
    createdUserId: newUser.id,
    ...payload,
  });
});

// 6. Unlink (delete from linked accounts list only; keeps actual user account intact)
app.delete('/api/admin-switcher/accounts/:linkId', async (req: Request, res: Response) => {
  const ctx = await resolveSwitcherContext(req, true);
  if (!ctx.authorized || !ctx.adminEmail) {
    return res.status(ctx.errorStatus || 403).json({
      success: false,
      message: ctx.errorMessage || 'غير مصرح بالوصول',
    });
  }

  const linkId = decodeURIComponent(String(req.params.linkId || '')).trim();
  const allLinks = await syncAdminLinkedAccountsWithNeon();
  const targetLink = allLinks.find(
    (l) => l.id === linkId && l.adminEmail.toLowerCase() === ctx.adminEmail!.toLowerCase()
  );

  if (!targetLink) {
    return res.status(404).json({
      success: false,
      message: 'الحساب المرتبط غير موجود في القائمة',
    });
  }

  const updated = allLinks.filter((l) => l.id !== linkId);
  saveStoredAdminLinkedAccounts(updated);
  if (neonPool) {
    await ensureAdminLinkedAccountsNeonTable();
    await neonPool
      .query('DELETE FROM admin_linked_accounts WHERE id = $1 AND LOWER(admin_email) = LOWER($2)', [linkId, ctx.adminEmail])
      .catch(() => {});
  }

  recordGeneralSiteLog({
    category: 'admin',
    actorRole: ctx.adminEmail === getAdmin1Email() ? 'ADMIN1' : 'ADMIN2',
    email: ctx.adminEmail,
    userId: ctx.currentUser?.id,
    targetUserId: targetLink.linkedUserId,
    targetEmail: targetLink.linkedEmail,
    action: 'admin_unlink_account',
    actionLabelAr: 'إزالة حساب مرتبط من مبدّل الأدمن',
    details: `إزالة ربط الحساب ${targetLink.linkedEmail}`,
    ip: getClientIp(req),
    status: 'success',
  });

  const payload = await buildSwitcherAccountsResponse(ctx.adminEmail);
  return res.json({
    success: true,
    message: 'تمت إزالة الحساب من قائمة الحسابات المرتبطة بنجاح',
    ...payload,
  });
});

// 7. Quick Switch between owning Admin account and any linked account
//    - From Admin -> Linked Account: allowed immediately for authenticated Admin
//    - From Switched Account -> Admin or Another Linked Account: strictly requires ADMIN_PIN (or verified unlock token)
app.post('/api/admin-switcher/switch', async (req: Request, res: Response) => {
  const ctx = await resolveSwitcherContext(req, true);
  if (!ctx.authorized || !ctx.adminEmail) {
    return res.status(ctx.errorStatus || 403).json({
      success: false,
      message: ctx.errorMessage || 'كلمة مرور لوحة التحكم (PIN) غير صحيحة أو غير مصرح بالوصول',
    });
  }

  const { targetType, targetUserId } = req.body;
  const adminEmails = getAdminEmails();
  const owningAdmin = ensureAdminRecordExists(ctx.adminEmail);

  let targetUser: StoredUser | undefined;
  let nextOriginToken: string | null = null;

  if (targetType === 'admin' || (targetUserId && targetUserId === owningAdmin.id)) {
    targetUser = owningAdmin;
    nextOriginToken = null; // Back on origin Admin -> clear switch origin token
  } else {
    const cleanTargetId = String(targetUserId || '').trim();
    if (!cleanTargetId) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد الحساب المستهدف للتبديل' });
    }
    const allLinks = await syncAdminLinkedAccountsWithNeon();
    const matchedLink = allLinks.find(
      (l) =>
        l.adminEmail.toLowerCase() === ctx.adminEmail!.toLowerCase() &&
        (l.linkedUserId === cleanTargetId ||
          l.linkedEmail.toLowerCase() === cleanTargetId.toLowerCase() ||
          (l.linkedDisplayId && l.linkedDisplayId.toLowerCase() === cleanTargetId.toLowerCase()))
    );
    if (!matchedLink) {
      return res.status(404).json({
        success: false,
        message: 'الحساب غير مرتبط بحساب الأدمن هذا',
      });
    }
    targetUser = resolveUserRecordByAnyId(matchedLink.linkedUserId) || resolveUserRecordByAnyId(matchedLink.linkedEmail);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'لم يعد هذا الحساب موجوداً في النظام',
      });
    }
    nextOriginToken = signAdminSwitchOriginToken(ctx.adminEmail, owningAdmin.id, targetUser.id);
  }

  const isTargetAdmin = adminEmails.includes(targetUser.email.toLowerCase());
  const session = createSession(targetUser.id, targetUser.email, targetUser.name, isTargetAdmin, targetUser.displayId);

  recordGeneralSiteLog({
    category: 'admin',
    actorRole: ctx.adminEmail === getAdmin1Email() ? 'ADMIN1' : 'ADMIN2',
    email: ctx.adminEmail,
    userId: owningAdmin.id,
    userName: owningAdmin.name,
    targetUserId: targetUser.id,
    targetDisplayId: targetUser.displayId,
    targetEmail: targetUser.email,
    targetName: targetUser.name,
    action: 'admin_quick_switch',
    actionLabelAr: targetType === 'admin' ? 'عودة سريعة إلى حساب الأدمن' : 'تبديل سريع إلى حساب مرتبط',
    details: `من ${ctx.currentUser?.email || ctx.adminEmail} إلى ${targetUser.email}`,
    ip: getClientIp(req),
    status: 'success',
  });

  return res.json({
    success: true,
    message: `تم التبديل إلى حساب ${targetUser.name} بنجاح`,
    token: session.token,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
    isAdmin: isTargetAdmin,
    user: serializeSwitchedUser(targetUser, isTargetAdmin),
    adminSwitchOriginToken: nextOriginToken,
  });
});

// Mount Vite or serve static assets
async function startServer() {
  // Wait for initial Neon PostgreSQL connection, schema migration & balance restoration before serving traffic
  await withTimeout(neonInitPromise, 8000).catch(() => false);

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

    // Ensure full bidirectional consistency across users, agents, agency records & messages
    if (neonPool) {
      await syncDatabaseFromNeon().catch((err) => {
        console.warn('⚠️ [Neon Database] Startup sync failed:', err);
      });
      await syncAgentsWithNeon().catch(() => {});
      await syncAgencyTransactionsWithNeon().catch(() => {});
      await syncAgencyWithdrawalsWithNeon().catch(() => {});
      await syncMessagesWithNeon().catch((err) => {
        console.warn('⚠️ [Neon Database] Startup messages sync failed:', err);
      });
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
