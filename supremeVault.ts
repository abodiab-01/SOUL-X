import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import type pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const SUPREME_VAULT_FILE = path.resolve(DATA_DIR, 'supreme_vault.json');
const SUPREME_MEDIA_DIR = path.resolve(DATA_DIR, 'supreme_media');
const MEDIA_DIR = path.resolve(DATA_DIR, 'media');

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(SUPREME_MEDIA_DIR)) fs.mkdirSync(SUPREME_MEDIA_DIR, { recursive: true });
} catch {}

// ==========================================
// Types
// ==========================================
export interface SupremeDeletedChatMessage {
  id: string;
  senderId: string;
  senderEmail?: string;
  senderName?: string;
  text: string;
  mediaType?: 'image' | 'audio' | 'text';
  mediaUrl?: string;
  hasArchivedMedia?: boolean;
  audioDuration?: number;
  isGift?: boolean;
  giftIcon?: string;
  giftName?: string;
  giftCost?: number;
  createdAt: string;
}

export interface SupremeDeletedChat {
  id: string;
  conversationId: string;
  senderId: string;
  senderDisplayId?: string;
  senderEmail: string;
  senderName: string;
  senderAvatar?: string;
  receiverId: string;
  receiverDisplayId?: string;
  receiverEmail: string;
  receiverName: string;
  receiverAvatar?: string;
  deletedByUserId?: string;
  deletedByEmail?: string;
  deletedByName?: string;
  deletedAt: string;
  createdAt?: string;
  messages: SupremeDeletedChatMessage[];
  mediaCount: number;
}

export interface SupremeMatchParticipant {
  userId: string;
  displayId?: string;
  email?: string;
  name: string;
  avatar?: string;
  gender?: string;
  age?: number;
  country?: string;
}

export interface SupremeMatchMessage {
  id: string;
  senderId: string;
  senderEmail?: string;
  senderName: string;
  text: string;
  mediaType?: 'image' | 'audio' | 'text';
  mediaUrl?: string;
  isGift?: boolean;
  giftIcon?: string;
  giftName?: string;
  giftCost?: number;
  createdAt: string;
}

export interface SupremeMatchLog {
  id: string;
  sessionId: string;
  user1: SupremeMatchParticipant;
  user2: SupremeMatchParticipant;
  matchedAt: string;
  endedAt?: string;
  endedBy?: string;
  endedReason?: string;
  status: 'active' | 'ended';
  messages: SupremeMatchMessage[];
}

export interface SupremeUserLog {
  id: string;
  userId?: string;
  displayId?: string;
  email?: string;
  name?: string;
  action: string;
  actionLabelAr: string;
  details?: string;
  ip?: string;
  createdAt: string;
}

export interface SupremeAdmin2Log {
  id: string;
  adminEmail: string;
  adminId?: string;
  adminName?: string;
  action: string;
  actionLabelAr: string;
  target?: string;
  details?: string;
  method: string;
  path: string;
  ip?: string;
  createdAt: string;
}

export type SupremeGeneralLogCategory =
  | 'auth'
  | 'profile'
  | 'wallet'
  | 'agency'
  | 'games'
  | 'chat'
  | 'matches'
  | 'social'
  | 'reports'
  | 'verification'
  | 'admin'
  | 'system';

export type SupremeActorRole = 'USER' | 'ADMIN1' | 'ADMIN2' | 'AGENT' | 'SYSTEM';

export interface SupremeGeneralLogEntry {
  id: string;
  refId?: string;
  source: string;
  category: SupremeGeneralLogCategory;
  categoryLabelAr: string;
  actorRole: SupremeActorRole;
  userId?: string;
  displayId?: string;
  email?: string;
  userName?: string;
  targetUserId?: string;
  targetDisplayId?: string;
  targetEmail?: string;
  targetName?: string;
  action: string;
  actionLabelAr: string;
  details?: string;
  amount?: number;
  currency?: string;
  ip?: string;
  method?: string;
  path?: string;
  status?: string;
  createdAt: string;
  deletable?: boolean;
}

export interface SupremeVaultData {
  deletedChats: SupremeDeletedChat[];
  matchLogs: SupremeMatchLog[];
  userLogs: SupremeUserLog[];
  admin2Logs: SupremeAdmin2Log[];
  generalLogs: SupremeGeneralLogEntry[];
}

// ==========================================
// Admin Role Resolution (Strict Isolation)
// ==========================================
function loadEnvAdmins(): { admin1: string; admin2: string; adminPin: string; aapanel: string } {
  let admin1 = (process.env.ADMIN1 || '').trim().toLowerCase();
  let admin2 = (process.env.ADMIN2 || '').trim().toLowerCase();
  let adminPin = (process.env.ADMIN_PIN || '').trim();
  let aapanel = (process.env.AAPANEL || '').trim();

  try {
    const envPath = path.resolve(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const parsed = dotenv.parse(fs.readFileSync(envPath, 'utf-8'));
      if (parsed.ADMIN1 && String(parsed.ADMIN1).trim()) {
        admin1 = String(parsed.ADMIN1).trim().toLowerCase();
      }
      if (parsed.ADMIN2 && String(parsed.ADMIN2).trim()) {
        admin2 = String(parsed.ADMIN2).trim().toLowerCase();
      }
      if (parsed.ADMIN_PIN && String(parsed.ADMIN_PIN).trim()) {
        adminPin = String(parsed.ADMIN_PIN).trim();
      }
      if (parsed.AAPANEL && String(parsed.AAPANEL).trim()) {
        aapanel = String(parsed.AAPANEL).trim();
      }
    }
  } catch {}

  return {
    admin1: admin1 || 'abojafar@soul-x.com',
    admin2: admin2 || 'abohaidar@soul-x.com',
    adminPin,
    aapanel,
  };
}

export function getAdmin1Email(): string {
  return loadEnvAdmins().admin1;
}

export function getAdmin2Email(): string {
  const { admin1, admin2 } = loadEnvAdmins();
  if (!admin2 || admin2 === admin1) return '';
  return admin2;
}

// ==========================================
// Vault Storage (JSON + Optional Neon Sync)
// ==========================================
let neonPoolRef: pg.Pool | null = null;

function readVault(): SupremeVaultData {
  try {
    if (fs.existsSync(SUPREME_VAULT_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SUPREME_VAULT_FILE, 'utf-8'));
      return {
        deletedChats: Array.isArray(raw?.deletedChats) ? raw.deletedChats : [],
        matchLogs: Array.isArray(raw?.matchLogs) ? raw.matchLogs : [],
        userLogs: Array.isArray(raw?.userLogs) ? raw.userLogs : [],
        admin2Logs: Array.isArray(raw?.admin2Logs) ? raw.admin2Logs : [],
        generalLogs: Array.isArray(raw?.generalLogs) ? raw.generalLogs : [],
      };
    }
  } catch {}
  return {
    deletedChats: [],
    matchLogs: [],
    userLogs: [],
    admin2Logs: [],
    generalLogs: [],
  };
}

function writeVault(data: SupremeVaultData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SUPREME_VAULT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

export async function initSupremeNeonTables(pool: pg.Pool | null): Promise<void> {
  neonPoolRef = pool;
  if (!pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supreme_deleted_chats (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        sender_id TEXT,
        sender_display_id TEXT,
        sender_email TEXT,
        sender_name TEXT,
        sender_avatar TEXT,
        receiver_id TEXT,
        receiver_display_id TEXT,
        receiver_email TEXT,
        receiver_name TEXT,
        receiver_avatar TEXT,
        deleted_by_user_id TEXT,
        deleted_by_email TEXT,
        deleted_by_name TEXT,
        deleted_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ,
        messages JSONB DEFAULT '[]'::jsonb,
        media_count INT DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS supreme_match_logs (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        user1 JSONB NOT NULL,
        user2 JSONB NOT NULL,
        matched_at TIMESTAMPTZ DEFAULT NOW(),
        ended_at TIMESTAMPTZ,
        ended_by TEXT,
        ended_reason TEXT,
        status TEXT DEFAULT 'active',
        messages JSONB DEFAULT '[]'::jsonb
      );
      CREATE TABLE IF NOT EXISTS supreme_user_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        display_id TEXT,
        email TEXT,
        name TEXT,
        action TEXT NOT NULL,
        action_label_ar TEXT,
        details TEXT,
        ip TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS supreme_admin2_logs (
        id TEXT PRIMARY KEY,
        admin_email TEXT NOT NULL,
        admin_id TEXT,
        admin_name TEXT,
        action TEXT NOT NULL,
        action_label_ar TEXT,
        target TEXT,
        details TEXT,
        method TEXT,
        path TEXT,
        ip TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS supreme_general_logs (
        id TEXT PRIMARY KEY,
        ref_id TEXT,
        source TEXT NOT NULL,
        category TEXT NOT NULL,
        category_label_ar TEXT,
        actor_role TEXT NOT NULL,
        user_id TEXT,
        display_id TEXT,
        email TEXT,
        user_name TEXT,
        target_user_id TEXT,
        target_display_id TEXT,
        target_email TEXT,
        target_name TEXT,
        action TEXT NOT NULL,
        action_label_ar TEXT,
        details TEXT,
        amount NUMERIC,
        currency TEXT,
        ip TEXT,
        method TEXT,
        path TEXT,
        status TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const vault = readVault();
    let changed = false;

    const dcRes = await pool.query('SELECT * FROM supreme_deleted_chats ORDER BY deleted_at DESC LIMIT 500').catch(() => ({ rows: [] }));
    const existingDcIds = new Set(vault.deletedChats.map((c) => c.id));
    for (const r of dcRes.rows || []) {
      if (!existingDcIds.has(r.id)) {
        vault.deletedChats.push({
          id: r.id,
          conversationId: r.conversation_id,
          senderId: r.sender_id,
          senderDisplayId: r.sender_display_id || undefined,
          senderEmail: r.sender_email,
          senderName: r.sender_name,
          senderAvatar: r.sender_avatar || undefined,
          receiverId: r.receiver_id,
          receiverDisplayId: r.receiver_display_id || undefined,
          receiverEmail: r.receiver_email,
          receiverName: r.receiver_name,
          receiverAvatar: r.receiver_avatar || undefined,
          deletedByUserId: r.deleted_by_user_id || undefined,
          deletedByEmail: r.deleted_by_email || undefined,
          deletedByName: r.deleted_by_name || undefined,
          deletedAt: r.deleted_at ? new Date(r.deleted_at).toISOString() : new Date().toISOString(),
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
          messages: Array.isArray(r.messages) ? r.messages : [],
          mediaCount: Number(r.media_count || 0),
        });
        changed = true;
      }
    }

    const mRes = await pool.query('SELECT * FROM supreme_match_logs ORDER BY matched_at DESC LIMIT 500').catch(() => ({ rows: [] }));
    const existingMIds = new Set(vault.matchLogs.map((m) => m.id));
    for (const r of mRes.rows || []) {
      if (!existingMIds.has(r.id)) {
        vault.matchLogs.push({
          id: r.id,
          sessionId: r.session_id || r.id,
          user1: r.user1,
          user2: r.user2,
          matchedAt: r.matched_at ? new Date(r.matched_at).toISOString() : new Date().toISOString(),
          endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : undefined,
          endedBy: r.ended_by || undefined,
          endedReason: r.ended_reason || undefined,
          status: r.status === 'active' ? 'active' : 'ended',
          messages: Array.isArray(r.messages) ? r.messages : [],
        });
        changed = true;
      }
    }

    const uLogRes = await pool.query('SELECT * FROM supreme_user_logs ORDER BY created_at DESC LIMIT 1000').catch(() => ({ rows: [] }));
    const existingULogIds = new Set(vault.userLogs.map((l) => l.id));
    for (const r of uLogRes.rows || []) {
      if (!existingULogIds.has(r.id)) {
        vault.userLogs.push({
          id: r.id,
          userId: r.user_id || undefined,
          displayId: r.display_id || undefined,
          email: r.email || undefined,
          name: r.name || undefined,
          action: r.action,
          actionLabelAr: r.action_label_ar || r.action,
          details: r.details || undefined,
          ip: r.ip || undefined,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        });
        changed = true;
      }
    }

    const a2LogRes = await pool.query('SELECT * FROM supreme_admin2_logs ORDER BY created_at DESC LIMIT 1000').catch(() => ({ rows: [] }));
    const existingA2LogIds = new Set(vault.admin2Logs.map((l) => l.id));
    for (const r of a2LogRes.rows || []) {
      if (!existingA2LogIds.has(r.id)) {
        vault.admin2Logs.push({
          id: r.id,
          adminEmail: r.admin_email,
          adminId: r.admin_id || undefined,
          adminName: r.admin_name || undefined,
          action: r.action,
          actionLabelAr: r.action_label_ar || r.action,
          target: r.target || undefined,
          details: r.details || undefined,
          method: r.method || 'POST',
          path: r.path || '',
          ip: r.ip || undefined,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
        });
        changed = true;
      }
    }

    const gLogRes = await pool.query('SELECT * FROM supreme_general_logs ORDER BY created_at DESC LIMIT 2000').catch(() => ({ rows: [] }));
    const existingGLogIds = new Set(vault.generalLogs.map((l) => l.id));
    for (const r of gLogRes.rows || []) {
      if (!existingGLogIds.has(r.id)) {
        vault.generalLogs.push({
          id: r.id,
          refId: r.ref_id || undefined,
          source: r.source || 'live',
          category: (r.category || 'system') as SupremeGeneralLogCategory,
          categoryLabelAr: r.category_label_ar || getCategoryLabelAr((r.category || 'system') as SupremeGeneralLogCategory),
          actorRole: (r.actor_role || 'USER') as SupremeActorRole,
          userId: r.user_id || undefined,
          displayId: r.display_id || undefined,
          email: r.email || undefined,
          userName: r.user_name || undefined,
          targetUserId: r.target_user_id || undefined,
          targetDisplayId: r.target_display_id || undefined,
          targetEmail: r.target_email || undefined,
          targetName: r.target_name || undefined,
          action: r.action,
          actionLabelAr: r.action_label_ar || r.action,
          details: r.details || undefined,
          amount: r.amount !== null && r.amount !== undefined ? Number(r.amount) : undefined,
          currency: r.currency || undefined,
          ip: r.ip || undefined,
          method: r.method || undefined,
          path: r.path || undefined,
          status: r.status || undefined,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          deletable: true,
        });
        changed = true;
      }
    }

    if (changed) writeVault(vault);
  } catch {}
}

// ==========================================
// Media Archiving Helpers (for Deleted Chats)
// ==========================================
function getMediaHashName(messageId: string): string {
  const hash = crypto.createHash('sha256').update(String(messageId || '')).digest('hex').slice(0, 32);
  return `msg_${hash}`;
}

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
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

export function archiveMediaForMessage(messageId: string, rawMediaUrl?: string | null): boolean {
  if (!messageId) return false;
  try {
    if (!fs.existsSync(SUPREME_MEDIA_DIR)) fs.mkdirSync(SUPREME_MEDIA_DIR, { recursive: true });
    const baseName = getMediaHashName(messageId);
    const targetBin = path.resolve(SUPREME_MEDIA_DIR, `${baseName}.bin`);
    const targetMeta = path.resolve(SUPREME_MEDIA_DIR, `${baseName}.json`);

    if (fs.existsSync(targetBin)) return true;

    const srcBin = path.resolve(MEDIA_DIR, `${baseName}.bin`);
    const srcMeta = path.resolve(MEDIA_DIR, `${baseName}.json`);
    if (fs.existsSync(srcBin)) {
      fs.copyFileSync(srcBin, targetBin);
      if (fs.existsSync(srcMeta)) {
        fs.copyFileSync(srcMeta, targetMeta);
      } else {
        fs.writeFileSync(
          targetMeta,
          JSON.stringify({ messageId, mimeType: 'application/octet-stream' }),
          'utf-8'
        );
      }
      return true;
    }

    if (rawMediaUrl && typeof rawMediaUrl === 'string' && rawMediaUrl.startsWith('data:')) {
      const parsed = parseDataUrl(rawMediaUrl);
      if (parsed) {
        fs.writeFileSync(targetBin, parsed.buffer);
        fs.writeFileSync(
          targetMeta,
          JSON.stringify({ messageId, mimeType: parsed.mimeType, size: parsed.buffer.length }),
          'utf-8'
        );
        return true;
      }
    }
  } catch {}
  return false;
}

export function readSupremeMediaFromDisk(messageId: string): { mimeType: string; buffer: Buffer } | null {
  if (!messageId) return null;
  try {
    const baseName = getMediaHashName(messageId);
    for (const dir of [SUPREME_MEDIA_DIR, MEDIA_DIR]) {
      const binPath = path.resolve(dir, `${baseName}.bin`);
      const metaPath = path.resolve(dir, `${baseName}.json`);
      if (fs.existsSync(binPath)) {
        const buffer = fs.readFileSync(binPath);
        let mimeType = 'application/octet-stream';
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            if (meta?.mimeType) mimeType = String(meta.mimeType);
          } catch {}
        }
        return { mimeType, buffer };
      }
    }
  } catch {}
  return null;
}

export function deleteSupremeMediaForMessageIds(messageIds: string[]): void {
  for (const mid of messageIds) {
    if (!mid) continue;
    try {
      const baseName = getMediaHashName(mid);
      const binPath = path.resolve(SUPREME_MEDIA_DIR, `${baseName}.bin`);
      const metaPath = path.resolve(SUPREME_MEDIA_DIR, `${baseName}.json`);
      if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    } catch {}
  }
}

// ==========================================
// 1. Deleted Chat Archiving (with All Media)
// ==========================================
export interface ArchiveChatInput {
  conversationId: string;
  participants: string[];
  participantDetails?: Record<string, { id?: string; displayId?: string; name?: string; avatar?: string }>;
  createdAt?: string;
  messages: Array<{
    id: string;
    senderId: string;
    senderName?: string;
    text?: string;
    mediaType?: 'image' | 'audio' | 'text';
    mediaUrl?: string;
    audioDuration?: number;
    isGift?: boolean;
    giftIcon?: string;
    giftName?: string;
    giftCost?: number;
    createdAt?: string;
  }>;
}

export interface UserLookupRecord {
  id: string;
  displayId?: string;
  email: string;
  name: string;
  photoUrl?: string;
}

function resolveUserFromList(
  identifier: string | undefined,
  users: UserLookupRecord[]
): UserLookupRecord | undefined {
  if (!identifier) return undefined;
  const clean = String(identifier).trim().toLowerCase();
  return users.find(
    (u) =>
      u.id.toLowerCase() === clean ||
      (u.displayId && u.displayId.toLowerCase() === clean) ||
      u.email.toLowerCase() === clean
  );
}

export function archiveDeletedChatSnapshot(
  conv: ArchiveChatInput,
  users: UserLookupRecord[],
  deletedByUserId?: string
): void {
  try {
    if (!conv || !Array.isArray(conv.messages) || conv.messages.length === 0) return;

    const now = new Date().toISOString();
    const allParticipantIds = Array.from(
      new Set([
        ...(conv.participants || []),
        ...conv.messages.map((m) => m.senderId).filter(Boolean),
      ])
    ).filter((p) => p && !String(p).startsWith('conv-'));

    const resolvedPair: Array<{
      id: string;
      displayId?: string;
      email: string;
      name: string;
      avatar?: string;
    }> = [];
    const seenKeys = new Set<string>();

    for (const pid of allParticipantIds) {
      const matched = resolveUserFromList(pid, users);
      const canonicalKey = (matched?.email || matched?.id || pid).toLowerCase();
      if (seenKeys.has(canonicalKey)) continue;
      seenKeys.add(canonicalKey);

      const detail = conv.participantDetails?.[pid];
      resolvedPair.push({
        id: matched?.id || detail?.id || pid,
        displayId: matched?.displayId || detail?.displayId || pid,
        email: matched?.email || `${pid}@soul-x.local`,
        name: matched?.name || detail?.name || 'مستخدم Soul-X',
        avatar: matched?.photoUrl || detail?.avatar,
      });
    }

    const firstMsgSenderId = conv.messages[0]?.senderId || deletedByUserId;
    const firstSenderUser = resolveUserFromList(firstMsgSenderId, users);
    let sender = resolvedPair[0];
    let receiver = resolvedPair[1];

    if (resolvedPair.length >= 2 && firstMsgSenderId) {
      const firstIdx = resolvedPair.findIndex(
        (p) =>
          p.id.toLowerCase() === firstMsgSenderId.toLowerCase() ||
          (p.displayId && p.displayId.toLowerCase() === firstMsgSenderId.toLowerCase()) ||
          (firstSenderUser?.email && p.email.toLowerCase() === firstSenderUser.email.toLowerCase())
      );
      if (firstIdx === 1) {
        sender = resolvedPair[1];
        receiver = resolvedPair[0];
      }
    }

    if (!sender) {
      sender = {
        id: deletedByUserId || 'unknown',
        email: 'unknown@soul-x.local',
        name: 'غير معروف',
      };
    }
    if (!receiver) {
      receiver = {
        id: 'unknown',
        email: 'unknown@soul-x.local',
        name: 'طرف غير معروف',
      };
    }

    const deleter = resolveUserFromList(deletedByUserId, users);

    let mediaCount = 0;
    const archivedMessages: SupremeDeletedChatMessage[] = conv.messages.map((m) => {
      const msgSender = resolveUserFromList(m.senderId, users);
      const hasMedia = Boolean(m.mediaUrl || m.mediaType === 'image' || m.mediaType === 'audio');
      let archivedOk = false;
      if (hasMedia) {
        archivedOk = archiveMediaForMessage(m.id, m.mediaUrl);
        mediaCount++;
      }

      let storedMediaUrl = m.mediaUrl;
      if (archivedOk || (m.mediaUrl && m.mediaUrl.startsWith('/api/messages/media/'))) {
        storedMediaUrl = `/api/supreme/media/${encodeURIComponent(m.id)}`;
      }

      return {
        id: m.id,
        senderId: m.senderId,
        senderEmail:
          msgSender?.email ||
          (m.senderId === sender.id || m.senderId === sender.displayId ? sender.email : receiver.email),
        senderName:
          m.senderName ||
          msgSender?.name ||
          (m.senderId === sender.id || m.senderId === sender.displayId ? sender.name : receiver.name),
        text: m.text || '',
        mediaType: m.mediaType,
        mediaUrl: storedMediaUrl,
        hasArchivedMedia: archivedOk || Boolean(m.mediaUrl),
        audioDuration: m.audioDuration,
        isGift: m.isGift,
        giftIcon: m.giftIcon,
        giftName: m.giftName,
        giftCost: m.giftCost,
        createdAt: m.createdAt || now,
      };
    });

    const entry: SupremeDeletedChat = {
      id: `delchat_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      conversationId: conv.conversationId,
      senderId: sender.id,
      senderDisplayId: sender.displayId,
      senderEmail: sender.email,
      senderName: sender.name,
      senderAvatar: sender.avatar,
      receiverId: receiver.id,
      receiverDisplayId: receiver.displayId,
      receiverEmail: receiver.email,
      receiverName: receiver.name,
      receiverAvatar: receiver.avatar,
      deletedByUserId: deleter?.id || deletedByUserId,
      deletedByEmail: deleter?.email,
      deletedByName: deleter?.name,
      deletedAt: now,
      createdAt: conv.createdAt,
      messages: archivedMessages,
      mediaCount,
    };

    const vault = readVault();
    vault.deletedChats.unshift(entry);
    if (vault.deletedChats.length > 500) {
      vault.deletedChats = vault.deletedChats.slice(0, 500);
    }
    writeVault(vault);

    if (neonPoolRef) {
      neonPoolRef
        .query(
          `INSERT INTO supreme_deleted_chats (
             id, conversation_id, sender_id, sender_display_id, sender_email, sender_name, sender_avatar,
             receiver_id, receiver_display_id, receiver_email, receiver_name, receiver_avatar,
             deleted_by_user_id, deleted_by_email, deleted_by_name, deleted_at, created_at, messages, media_count
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19)`,
          [
            entry.id,
            entry.conversationId,
            entry.senderId,
            entry.senderDisplayId || null,
            entry.senderEmail,
            entry.senderName,
            entry.senderAvatar || null,
            entry.receiverId,
            entry.receiverDisplayId || null,
            entry.receiverEmail,
            entry.receiverName,
            entry.receiverAvatar || null,
            entry.deletedByUserId || null,
            entry.deletedByEmail || null,
            entry.deletedByName || null,
            entry.deletedAt,
            entry.createdAt || null,
            JSON.stringify(entry.messages),
            entry.mediaCount,
          ]
        )
        .catch(() => {});
    }
  } catch {}
}

// ==========================================
// 2. Match History Logging (with Full Chat Log)
// ==========================================
export function recordMatchCreated(
  session: {
    id: string;
    createdAt: number;
    user1: SupremeMatchParticipant;
    user2: SupremeMatchParticipant;
  },
  users: UserLookupRecord[]
): void {
  try {
    const u1 = resolveUserFromList(session.user1.userId, users) || resolveUserFromList(session.user1.displayId, users);
    const u2 = resolveUserFromList(session.user2.userId, users) || resolveUserFromList(session.user2.displayId, users);

    const entry: SupremeMatchLog = {
      id: session.id,
      sessionId: session.id,
      user1: {
        ...session.user1,
        email: u1?.email || session.user1.email,
        displayId: u1?.displayId || session.user1.displayId,
        name: u1?.name || session.user1.name,
        avatar: u1?.photoUrl || session.user1.avatar,
      },
      user2: {
        ...session.user2,
        email: u2?.email || session.user2.email,
        displayId: u2?.displayId || session.user2.displayId,
        name: u2?.name || session.user2.name,
        avatar: u2?.photoUrl || session.user2.avatar,
      },
      matchedAt: new Date(session.createdAt || Date.now()).toISOString(),
      status: 'active',
      messages: [],
    };

    const vault = readVault();
    const existingIdx = vault.matchLogs.findIndex((m) => m.id === entry.id);
    if (existingIdx === -1) {
      vault.matchLogs.unshift(entry);
    } else {
      vault.matchLogs[existingIdx] = entry;
    }
    if (vault.matchLogs.length > 1000) {
      vault.matchLogs = vault.matchLogs.slice(0, 1000);
    }
    writeVault(vault);

    if (neonPoolRef) {
      neonPoolRef
        .query(
          `INSERT INTO supreme_match_logs (id, session_id, user1, user2, matched_at, status, messages)
           VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, '[]'::jsonb)
           ON CONFLICT (id) DO NOTHING`,
          [entry.id, entry.sessionId, JSON.stringify(entry.user1), JSON.stringify(entry.user2), entry.matchedAt, 'active']
        )
        .catch(() => {});
    }
  } catch {}
}

export function recordMatchMessage(
  sessionId: string,
  msg: SupremeMatchMessage,
  users: UserLookupRecord[]
): void {
  try {
    if (!sessionId || !msg) return;
    const sender = resolveUserFromList(msg.senderId, users);
    const fullMsg: SupremeMatchMessage = {
      ...msg,
      senderEmail: sender?.email || msg.senderEmail,
      senderName: msg.senderName || sender?.name || 'مستخدم',
    };

    const vault = readVault();
    const match = vault.matchLogs.find((m) => m.id === sessionId || m.sessionId === sessionId);
    if (match) {
      if (!match.messages.some((m) => m.id === fullMsg.id)) {
        match.messages.push(fullMsg);
        writeVault(vault);
        if (neonPoolRef) {
          neonPoolRef
            .query(`UPDATE supreme_match_logs SET messages = $2::jsonb WHERE id = $1`, [
              match.id,
              JSON.stringify(match.messages),
            ])
            .catch(() => {});
        }
      }
    }
  } catch {}
}

export function recordMatchEnded(sessionId: string, endedBy?: string, endedReason?: string): void {
  try {
    if (!sessionId) return;
    const now = new Date().toISOString();
    const vault = readVault();
    const match = vault.matchLogs.find((m) => m.id === sessionId || m.sessionId === sessionId);
    if (match) {
      match.status = 'ended';
      match.endedAt = now;
      if (endedBy) match.endedBy = endedBy;
      if (endedReason) match.endedReason = endedReason;
      writeVault(vault);

      if (neonPoolRef) {
        neonPoolRef
          .query(
            `UPDATE supreme_match_logs SET status = 'ended', ended_at = $2, ended_by = $3, ended_reason = $4 WHERE id = $1`,
            [match.id, now, endedBy || null, endedReason || null]
          )
          .catch(() => {});
      }
    }
  } catch {}
}

// ==========================================
// 3. User Activity Logs
// ==========================================
export function recordUserActivityLog(input: {
  userId?: string;
  displayId?: string;
  email?: string;
  name?: string;
  action: string;
  actionLabelAr: string;
  details?: string;
  ip?: string;
}): void {
  try {
    const entry: SupremeUserLog = {
      id: `ulog_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      userId: input.userId,
      displayId: input.displayId,
      email: input.email ? String(input.email).toLowerCase() : undefined,
      name: input.name,
      action: input.action,
      actionLabelAr: input.actionLabelAr,
      details: input.details,
      ip: input.ip,
      createdAt: new Date().toISOString(),
    };

    const vault = readVault();
    vault.userLogs.unshift(entry);
    if (vault.userLogs.length > 2500) {
      vault.userLogs = vault.userLogs.slice(0, 2500);
    }
    writeVault(vault);

    if (neonPoolRef) {
      neonPoolRef
        .query(
          `INSERT INTO supreme_user_logs (id, user_id, display_id, email, name, action, action_label_ar, details, ip, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            entry.id,
            entry.userId || null,
            entry.displayId || null,
            entry.email || null,
            entry.name || null,
            entry.action,
            entry.actionLabelAr,
            entry.details || null,
            entry.ip || null,
            entry.createdAt,
          ]
        )
        .catch(() => {});
    }
  } catch {}
}

// ==========================================
// 4. ADMIN2 Activity Logs
// ==========================================
export function recordAdmin2ActivityLog(input: {
  adminEmail: string;
  adminId?: string;
  adminName?: string;
  action: string;
  actionLabelAr: string;
  target?: string;
  details?: string;
  method: string;
  path: string;
  ip?: string;
}): void {
  try {
    const admin2 = getAdmin2Email();
    if (!admin2 || String(input.adminEmail || '').trim().toLowerCase() !== admin2) {
      return;
    }

    const entry: SupremeAdmin2Log = {
      id: `a2log_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      adminEmail: admin2,
      adminId: input.adminId,
      adminName: input.adminName || 'مدير النظام (ADMIN2)',
      action: input.action,
      actionLabelAr: input.actionLabelAr,
      target: input.target,
      details: input.details,
      method: input.method,
      path: input.path,
      ip: input.ip,
      createdAt: new Date().toISOString(),
    };

    const vault = readVault();
    vault.admin2Logs.unshift(entry);
    if (vault.admin2Logs.length > 2500) {
      vault.admin2Logs = vault.admin2Logs.slice(0, 2500);
    }
    writeVault(vault);

    if (neonPoolRef) {
      neonPoolRef
        .query(
          `INSERT INTO supreme_admin2_logs (id, admin_email, admin_id, admin_name, action, action_label_ar, target, details, method, path, ip, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            entry.id,
            entry.adminEmail,
            entry.adminId || null,
            entry.adminName || null,
            entry.action,
            entry.actionLabelAr,
            entry.target || null,
            entry.details || null,
            entry.method,
            entry.path,
            entry.ip || null,
            entry.createdAt,
          ]
        )
        .catch(() => {});
    }
  } catch {}
}

// ==========================================
// 4b. General Site & All-Users Comprehensive Audit Log
// ==========================================
const CATEGORY_LABEL_AR_MAP: Record<SupremeGeneralLogCategory, string> = {
  auth: 'الحساب والأمان',
  profile: 'الملف الشخصي',
  wallet: 'المحفظة والمالية',
  agency: 'الوكالات والشحن',
  games: 'الألعاب',
  chat: 'المحادثات والهدايا',
  matches: 'المطابقات',
  social: 'الأصدقاء والحظر',
  reports: 'البلاغات والاقتراحات',
  verification: 'توثيق الحسابات',
  admin: 'الإدارة والرقابة',
  system: 'النظام والبوت',
};

export function getCategoryLabelAr(category: SupremeGeneralLogCategory): string {
  return CATEGORY_LABEL_AR_MAP[category] || 'عام';
}

function inferCategoryFromUserAction(action: string): SupremeGeneralLogCategory {
  const a = String(action || '').toLowerCase();
  if (a.includes('login') || a.includes('register') || a.includes('logout') || a.includes('password') || a.includes('2fa')) return 'auth';
  if (a.includes('profile') || a.includes('avatar')) return 'profile';
  if (a.includes('block') || a.includes('friend')) return 'social';
  if (a.includes('chat') || a.includes('message') || a.includes('gift')) return 'chat';
  if (a.includes('match')) return 'matches';
  if (a.includes('report') || a.includes('feedback')) return 'reports';
  if (a.includes('verification')) return 'verification';
  if (a.includes('wallet') || a.includes('coin') || a.includes('diamond')) return 'wallet';
  if (a.includes('agent') || a.includes('agency')) return 'agency';
  if (a.includes('game')) return 'games';
  return 'system';
}

export function recordGeneralSiteLog(input: {
  refId?: string;
  source?: string;
  category: SupremeGeneralLogCategory;
  categoryLabelAr?: string;
  actorRole?: SupremeActorRole;
  userId?: string;
  displayId?: string;
  email?: string;
  userName?: string;
  targetUserId?: string;
  targetDisplayId?: string;
  targetEmail?: string;
  targetName?: string;
  action: string;
  actionLabelAr: string;
  details?: string;
  amount?: number;
  currency?: string;
  ip?: string;
  method?: string;
  path?: string;
  status?: string;
  createdAt?: string;
}): void {
  try {
    const admin1 = getAdmin1Email();
    const admin2 = getAdmin2Email();
    const cleanEmail = input.email ? String(input.email).trim().toLowerCase() : undefined;
    let resolvedRole: SupremeActorRole = input.actorRole || 'USER';
    if (!input.actorRole && cleanEmail) {
      if (cleanEmail === admin1) resolvedRole = 'ADMIN1';
      else if (admin2 && cleanEmail === admin2) resolvedRole = 'ADMIN2';
    }

    const entry: SupremeGeneralLogEntry = {
      id: `glog_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      refId: input.refId,
      source: input.source || 'live',
      category: input.category,
      categoryLabelAr: input.categoryLabelAr || getCategoryLabelAr(input.category),
      actorRole: resolvedRole,
      userId: input.userId,
      displayId: input.displayId,
      email: cleanEmail,
      userName: input.userName,
      targetUserId: input.targetUserId,
      targetDisplayId: input.targetDisplayId,
      targetEmail: input.targetEmail ? String(input.targetEmail).trim().toLowerCase() : undefined,
      targetName: input.targetName,
      action: input.action,
      actionLabelAr: input.actionLabelAr,
      details: input.details,
      amount: typeof input.amount === 'number' && Number.isFinite(input.amount) ? input.amount : undefined,
      currency: input.currency,
      ip: input.ip,
      method: input.method,
      path: input.path,
      status: input.status,
      createdAt: input.createdAt || new Date().toISOString(),
      deletable: true,
    };

    const vault = readVault();
    vault.generalLogs.unshift(entry);
    if (vault.generalLogs.length > 5000) {
      vault.generalLogs = vault.generalLogs.slice(0, 5000);
    }
    writeVault(vault);

    if (neonPoolRef) {
      neonPoolRef
        .query(
          `INSERT INTO supreme_general_logs (
             id, ref_id, source, category, category_label_ar, actor_role,
             user_id, display_id, email, user_name,
             target_user_id, target_display_id, target_email, target_name,
             action, action_label_ar, details, amount, currency, ip, method, path, status, created_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
          [
            entry.id,
            entry.refId || null,
            entry.source,
            entry.category,
            entry.categoryLabelAr,
            entry.actorRole,
            entry.userId || null,
            entry.displayId || null,
            entry.email || null,
            entry.userName || null,
            entry.targetUserId || null,
            entry.targetDisplayId || null,
            entry.targetEmail || null,
            entry.targetName || null,
            entry.action,
            entry.actionLabelAr,
            entry.details || null,
            entry.amount ?? null,
            entry.currency || null,
            entry.ip || null,
            entry.method || null,
            entry.path || null,
            entry.status || null,
            entry.createdAt,
          ]
        )
        .catch(() => {});
    }
  } catch {}
}

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || '';
}

// ==========================================
// 5. Strict ADMIN1 Supreme Session & Routes
// ==========================================
interface SupremeUnlockSession {
  token: string;
  adminEmail: string;
  expiresAt: number;
}

const supremeUnlockSessions = new Map<string, SupremeUnlockSession>();

export interface SupremeGeneralLogSources {
  users: any[];
  deletedUserKeys: string[];
  conversations: any[];
  agents: any[];
  deletedAgentKeys: string[];
  agencyTransactions: any[];
  agencyWithdrawals: any[];
  friends: any[];
  friendRequests: any[];
  blockedUsers: any[];
  feedbackReports: any[];
  passwordResetRequests: any[];
  verificationRequests: any[];
  botReferrals: { users: any[]; events: any[]; transfers: any[] };
  sessions: any[];
}

export interface SupremeRouteDeps {
  getStoredUsers: () => any[];
  saveStoredUsers: (users: any[]) => void;
  getStoredSessions: () => Array<{ token: string; refreshToken: string; userId: string; email: string; name: string; displayId?: string; isAdmin?: boolean }>;
  saveStoredSessions: (sessions: any[]) => void;
  hashPassword: (pw: string) => string;
  defaultAdminPassword: string;
  getAdminPin: () => string;
  deleteUserCompletely: (userId: string) => Promise<void>;
  updateUserPassword?: (userId: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  getGeneralLogSources?: () => SupremeGeneralLogSources;
}

export function registerSupremeRoutes(app: Express, deps: SupremeRouteDeps): void {
  const resolveAdmin1FromRequest = (req: Request): { isAdmin1: boolean; email: string; user?: any } => {
    const admin1Email = getAdmin1Email();
    const admin2Email = getAdmin2Email();
    const authHeader = ((req.headers['authorization'] as string) || '').trim();
    const refreshHeader = ((req.headers['x-refresh-token'] as string) || '').trim();
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';

    if (!token && !refreshHeader) {
      return { isAdmin1: false, email: '' };
    }

    const sessions = deps.getStoredSessions();
    const session = sessions.find(
      (s) => (token && s.token === token) || (refreshHeader && s.refreshToken === refreshHeader)
    );

    if (!session || !session.email) {
      return { isAdmin1: false, email: '' };
    }

    const sessionEmail = session.email.trim().toLowerCase();
    if (sessionEmail !== admin1Email || (admin2Email && sessionEmail === admin2Email)) {
      return { isAdmin1: false, email: sessionEmail };
    }

    const users = deps.getStoredUsers();
    const user = users.find((u) => u.email.toLowerCase() === admin1Email);
    return { isAdmin1: true, email: sessionEmail, user };
  };

  const requireSupremeAuth = (req: Request, res: Response, next: () => void) => {
    const check = resolveAdmin1FromRequest(req);
    if (!check.isAdmin1) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const supremeHeader = ((req.headers['x-supreme-token'] as string) || (req.query.st as string) || '').trim();
    if (!supremeHeader) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const supSession = supremeUnlockSessions.get(supremeHeader);
    if (!supSession || supSession.expiresAt < Date.now() || supSession.adminEmail !== check.email) {
      if (supSession && supSession.expiresAt < Date.now()) {
        supremeUnlockSessions.delete(supremeHeader);
      }
      return res.status(401).json({ success: false, message: 'انتهت جلسة الإدارة العليا' });
    }

    return next();
  };

  // Silent check for ADMIN1 eligibility
  app.get('/api/supreme/check', (req: Request, res: Response) => {
    const check = resolveAdmin1FromRequest(req);
    const { aapanel } = loadEnvAdmins();
    if (!check.isAdmin1) {
      return res.json({ eligible: false });
    }
    return res.json({
      eligible: true,
      configured: Boolean(aapanel),
    });
  });

  // Unlock Supreme Panel (ADMIN1 session + AAPANEL env password only)
  app.post('/api/supreme/unlock', (req: Request, res: Response) => {
    const check = resolveAdmin1FromRequest(req);
    if (!check.isAdmin1) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const { aapanel } = loadEnvAdmins();
    if (!aapanel) {
      return res.status(503).json({
        success: false,
        message: 'لم يتم ضبط متغير البيئة AAPANEL لفتح لوحة الإدارة العليا',
      });
    }

    const { password } = req.body || {};
    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'كلمة مرور لوحة الإدارة العليا مطلوبة',
      });
    }

    const enteredDigest = crypto.createHash('sha256').update(password).digest();
    const expectedDigest = crypto.createHash('sha256').update(aapanel).digest();
    const isValid = crypto.timingSafeEqual(enteredDigest, expectedDigest);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'كلمة مرور لوحة الإدارة العليا غير صحيحة',
      });
    }

    const supremeToken = `sup_${crypto.randomBytes(32).toString('hex')}`;
    supremeUnlockSessions.set(supremeToken, {
      token: supremeToken,
      adminEmail: check.email,
      expiresAt: Date.now() + 4 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      supremeToken,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    });
  });

  // Lock Supreme Panel
  app.post('/api/supreme/lock', (req: Request, res: Response) => {
    const supremeHeader = ((req.headers['x-supreme-token'] as string) || '').trim();
    if (supremeHeader) {
      supremeUnlockSessions.delete(supremeHeader);
    }
    return res.json({ success: true });
  });

  // Users with full profile & security metadata (hashed credentials only, never plaintext)
  app.get('/api/supreme/users', requireSupremeAuth, async (_req: Request, res: Response) => {
    const users = deps.getStoredUsers();
    const vault = readVault();
    const admin1Email = getAdmin1Email();
    const admin2Email = getAdmin2Email();

    const enriched = users.map((u) => {
      const emailKey = String(u.email || '').trim().toLowerCase();
      return {
        id: u.id,
        displayId: u.displayId || u.id,
        name: u.name,
        email: u.email,
        hasPasswordHash: Boolean(u.passwordHash),
        passwordHashFingerprint: u.passwordHash ? `${String(u.passwordHash).slice(0, 12)}...` : null,
        role:
          emailKey === admin1Email
            ? 'ADMIN1'
            : admin2Email && emailKey === admin2Email
            ? 'ADMIN2'
            : 'USER',
        photoUrl: u.photoUrl || null,
        birthDate: u.birthDate || null,
        gender: u.gender || null,
        country: u.country || null,
        bio: u.bio || null,
        walletBalance: u.walletBalance ?? 0,
        coinsBalance: u.coinsBalance ?? 0,
        isVerified: Boolean(u.isVerified),
        isBanned: Boolean(u.isBanned),
        banReason: u.banReason || null,
        bannedAt: u.bannedAt || null,
        isFrozen: Boolean(u.isFrozen),
        freezeReason: u.freezeReason || null,
        freezeExpiresAt: u.freezeExpiresAt || null,
        twoFactorEnabled: Boolean(u.twoFactorEnabled),
        twoFactorEnabledAt: u.twoFactorEnabledAt || null,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt || null,
      };
    });

    return res.json({
      success: true,
      users: enriched,
      counts: {
        users: enriched.length,
        deletedChats: vault.deletedChats.length,
        matches: vault.matchLogs.length,
        userLogs: vault.userLogs.length,
        admin2Logs: vault.admin2Logs.length,
        generalLogs: vault.generalLogs.length,
      },
    });
  });

  // Admin1 reset user password from Supreme Panel
  app.post('/api/supreme/users/:userId/reset-password', requireSupremeAuth, async (req: Request, res: Response) => {
    const target = decodeURIComponent(String(req.params.userId || '')).trim();
    const { newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 4) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الجديدة يجب أن لا تقل عن 4 خانات' });
    }
    if (deps.updateUserPassword) {
      const result = await deps.updateUserPassword(target, String(newPassword));
      if (result.success) {
        const users = deps.getStoredUsers();
        const u = users.find((x) => x.id === target || x.displayId === target || x.email?.toLowerCase() === target.toLowerCase());
        recordGeneralSiteLog({
          category: 'admin',
          actorRole: 'ADMIN1',
          email: getAdmin1Email(),
          userName: 'ADMIN1',
          targetUserId: u?.id || target,
          targetDisplayId: u?.displayId,
          targetEmail: u?.email,
          targetName: u?.name,
          action: 'supreme_reset_password',
          actionLabelAr: 'تغيير كلمة مرور مستخدم من الإدارة العليا',
          details: `المستخدم: ${u?.name || target} (${u?.email || target})`,
          ip: getClientIp(req),
          method: 'POST',
          path: '/api/supreme/users/:userId/reset-password',
          status: 'success',
        });
      }
      return res.status(result.success ? 200 : 404).json(result);
    }
    return res.status(500).json({ success: false, message: 'غير متاح' });
  });

  // Permanently delete a user & all their data
  app.delete('/api/supreme/users/:userId', requireSupremeAuth, async (req: Request, res: Response) => {
    const target = decodeURIComponent(String(req.params.userId || '')).trim();
    const admin1Email = getAdmin1Email();
    const users = deps.getStoredUsers();
    const matched = users.find(
      (u) => u.id === target || u.displayId === target || u.email.toLowerCase() === target.toLowerCase()
    );
    if (matched && matched.email.toLowerCase() === admin1Email) {
      return res.status(400).json({ success: false, message: 'لا يمكن حذف حساب ADMIN1 الرئيسي' });
    }

    await deps.deleteUserCompletely(target);
    recordGeneralSiteLog({
      category: 'admin',
      actorRole: 'ADMIN1',
      email: admin1Email,
      userName: 'ADMIN1',
      targetUserId: matched?.id || target,
      targetDisplayId: matched?.displayId,
      targetEmail: matched?.email,
      targetName: matched?.name,
      action: 'supreme_delete_user',
      actionLabelAr: 'حذف مستخدم بالكامل من الإدارة العليا',
      details: `تم حذف الحساب نهائياً: ${matched?.name || target} (${matched?.email || target})`,
      ip: getClientIp(req),
      method: 'DELETE',
      path: '/api/supreme/users/:userId',
      status: 'success',
    });
    return res.json({ success: true, message: 'تم حذف المستخدم وجميع بياناته نهائياً' });
  });

  // Serve archived media for deleted chats (protected by ADMIN1 supremeToken)
  app.get('/api/supreme/media/:messageId', (req: Request, res: Response) => {
    const tokenParam = ((req.headers['x-supreme-token'] as string) || (req.query.st as string) || '').trim();
    const supSession = tokenParam ? supremeUnlockSessions.get(tokenParam) : undefined;
    if (!supSession || supSession.expiresAt < Date.now() || supSession.adminEmail !== getAdmin1Email()) {
      return res.status(404).end();
    }

    const rawMessageId = decodeURIComponent(String(req.params.messageId || '')).trim();
    const asset = readSupremeMediaFromDisk(rawMessageId);
    if (!asset) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    const total = asset.buffer.length;
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-store');

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
  });

  // Deleted Chats List
  app.get('/api/supreme/deleted-chats', requireSupremeAuth, (_req: Request, res: Response) => {
    const vault = readVault();
    return res.json({
      success: true,
      deletedChats: vault.deletedChats,
    });
  });

  // Delete single archived deleted chat permanently (including archived media files)
  app.delete('/api/supreme/deleted-chats/:chatId', requireSupremeAuth, async (req: Request, res: Response) => {
    const chatId = decodeURIComponent(String(req.params.chatId || '')).trim();
    const vault = readVault();
    const target = vault.deletedChats.find((c) => c.id === chatId);
    if (target) {
      const msgIds = (target.messages || []).map((m) => m.id).filter(Boolean);
      deleteSupremeMediaForMessageIds(msgIds);
      vault.deletedChats = vault.deletedChats.filter((c) => c.id !== chatId);
      writeVault(vault);
      if (neonPoolRef) {
        await neonPoolRef.query('DELETE FROM supreme_deleted_chats WHERE id = $1', [chatId]).catch(() => {});
      }
    }
    return res.json({ success: true, message: 'تم حذف الدردشة المحذوفة وجميع وسائطها بالكامل' });
  });

  // Clear all deleted chats permanently
  app.delete('/api/supreme/deleted-chats', requireSupremeAuth, async (_req: Request, res: Response) => {
    const vault = readVault();
    const allMsgIds = vault.deletedChats.flatMap((c) => (c.messages || []).map((m) => m.id)).filter(Boolean);
    deleteSupremeMediaForMessageIds(allMsgIds);
    vault.deletedChats = [];
    writeVault(vault);
    if (neonPoolRef) {
      await neonPoolRef.query('DELETE FROM supreme_deleted_chats').catch(() => {});
    }
    return res.json({ success: true });
  });

  // Match Logs List
  app.get('/api/supreme/matches', requireSupremeAuth, (_req: Request, res: Response) => {
    const vault = readVault();
    return res.json({
      success: true,
      matches: vault.matchLogs,
    });
  });

  app.delete('/api/supreme/matches/:matchId', requireSupremeAuth, async (req: Request, res: Response) => {
    const matchId = decodeURIComponent(String(req.params.matchId || '')).trim();
    const vault = readVault();
    vault.matchLogs = vault.matchLogs.filter((m) => m.id !== matchId);
    writeVault(vault);
    if (neonPoolRef) {
      await neonPoolRef.query('DELETE FROM supreme_match_logs WHERE id = $1', [matchId]).catch(() => {});
    }
    return res.json({ success: true });
  });

  app.delete('/api/supreme/matches', requireSupremeAuth, async (_req: Request, res: Response) => {
    const vault = readVault();
    vault.matchLogs = [];
    writeVault(vault);
    if (neonPoolRef) {
      await neonPoolRef.query('DELETE FROM supreme_match_logs').catch(() => {});
    }
    return res.json({ success: true });
  });

  // User Logs List & Delete
  app.get('/api/supreme/user-logs', requireSupremeAuth, (_req: Request, res: Response) => {
    const vault = readVault();
    return res.json({
      success: true,
      logs: vault.userLogs,
    });
  });

  app.delete('/api/supreme/user-logs/:logId', requireSupremeAuth, async (req: Request, res: Response) => {
    const logId = decodeURIComponent(String(req.params.logId || '')).trim();
    const vault = readVault();
    vault.userLogs = vault.userLogs.filter((l) => l.id !== logId);
    writeVault(vault);
    if (neonPoolRef) {
      await neonPoolRef.query('DELETE FROM supreme_user_logs WHERE id = $1', [logId]).catch(() => {});
    }
    return res.json({ success: true });
  });

  app.delete('/api/supreme/user-logs', requireSupremeAuth, async (_req: Request, res: Response) => {
    const vault = readVault();
    vault.userLogs = [];
    writeVault(vault);
    if (neonPoolRef) {
      await neonPoolRef.query('DELETE FROM supreme_user_logs').catch(() => {});
    }
    return res.json({ success: true });
  });

  // ADMIN2 Activity Logs List & Delete
  app.get('/api/supreme/admin2-logs', requireSupremeAuth, (_req: Request, res: Response) => {
    const vault = readVault();
    return res.json({
      success: true,
      logs: vault.admin2Logs,
      admin2Email: getAdmin2Email(),
    });
  });

  app.delete('/api/supreme/admin2-logs/:logId', requireSupremeAuth, async (req: Request, res: Response) => {
    const logId = decodeURIComponent(String(req.params.logId || '')).trim();
    const vault = readVault();
    vault.admin2Logs = vault.admin2Logs.filter((l) => l.id !== logId);
    writeVault(vault);
    if (neonPoolRef) {
      await neonPoolRef.query('DELETE FROM supreme_admin2_logs WHERE id = $1', [logId]).catch(() => {});
    }
    return res.json({ success: true });
  });

  app.delete('/api/supreme/admin2-logs', requireSupremeAuth, async (_req: Request, res: Response) => {
    const vault = readVault();
    vault.admin2Logs = [];
    writeVault(vault);
    if (neonPoolRef) {
      await neonPoolRef.query('DELETE FROM supreme_admin2_logs').catch(() => {});
    }
    return res.json({ success: true });
  });

  // ==========================================
  // General Site & All Users Comprehensive Log + Search
  // ==========================================
  app.get('/api/supreme/general-log', requireSupremeAuth, (req: Request, res: Response) => {
    const vault = readVault();
    const admin1Email = getAdmin1Email();
    const admin2Email = getAdmin2Email();
    const sources: SupremeGeneralLogSources = deps.getGeneralLogSources
      ? deps.getGeneralLogSources()
      : {
          users: deps.getStoredUsers(),
          deletedUserKeys: [],
          conversations: [],
          agents: [],
          deletedAgentKeys: [],
          agencyTransactions: [],
          agencyWithdrawals: [],
          friends: [],
          friendRequests: [],
          blockedUsers: [],
          feedbackReports: [],
          passwordResetRequests: [],
          verificationRequests: [],
          botReferrals: { users: [], events: [], transfers: [] },
          sessions: deps.getStoredSessions(),
        };

    const usersList = Array.isArray(sources.users) ? sources.users : [];
    const lookupUser = (ident?: string | null) => {
      if (!ident) return undefined;
      const clean = String(ident).trim().toLowerCase();
      return usersList.find(
        (u) =>
          (u.id && String(u.id).toLowerCase() === clean) ||
          (u.displayId && String(u.displayId).toLowerCase() === clean) ||
          (u.email && String(u.email).toLowerCase() === clean)
      );
    };

    const resolveRoleForEmail = (email?: string | null): SupremeActorRole => {
      const clean = email ? String(email).trim().toLowerCase() : '';
      if (clean && clean === admin1Email) return 'ADMIN1';
      if (clean && admin2Email && clean === admin2Email) return 'ADMIN2';
      return 'USER';
    };

    const entries: SupremeGeneralLogEntry[] = [];
    const seenRefIds = new Set<string>();

    // 1. Live vault generalLogs
    for (const g of vault.generalLogs) {
      if (g.refId) seenRefIds.add(g.refId);
      entries.push({ ...g, deletable: true });
    }

    // 2. Vault userLogs
    for (const ul of vault.userLogs) {
      const cat = inferCategoryFromUserAction(ul.action);
      const u = lookupUser(ul.userId || ul.email || ul.displayId);
      entries.push({
        id: ul.id,
        source: 'user_log',
        category: cat,
        categoryLabelAr: getCategoryLabelAr(cat),
        actorRole: resolveRoleForEmail(ul.email || u?.email),
        userId: ul.userId || u?.id,
        displayId: ul.displayId || u?.displayId,
        email: ul.email || u?.email,
        userName: ul.name || u?.name,
        action: ul.action,
        actionLabelAr: ul.actionLabelAr || ul.action,
        details: ul.details,
        ip: ul.ip,
        status: ul.action.includes('failed') ? 'failed' : 'success',
        createdAt: ul.createdAt,
        deletable: false,
      });
    }

    // 3. Vault admin2Logs
    for (const a2 of vault.admin2Logs) {
      const targetUser = a2.target ? lookupUser(a2.target) : undefined;
      entries.push({
        id: a2.id,
        source: 'admin2_log',
        category: 'admin',
        categoryLabelAr: getCategoryLabelAr('admin'),
        actorRole: 'ADMIN2',
        userId: a2.adminId,
        email: a2.adminEmail,
        userName: a2.adminName || 'ADMIN2',
        targetUserId: targetUser?.id,
        targetDisplayId: targetUser?.displayId,
        targetEmail: targetUser?.email,
        targetName: targetUser?.name || a2.target,
        action: a2.action,
        actionLabelAr: a2.actionLabelAr || a2.action,
        details: a2.details,
        ip: a2.ip,
        method: a2.method,
        path: a2.path,
        createdAt: a2.createdAt,
        deletable: false,
      });
    }

    // 4. Vault matchLogs
    for (const m of vault.matchLogs) {
      const refStart = `match_start:${m.id}`;
      if (!seenRefIds.has(refStart)) {
        seenRefIds.add(refStart);
        entries.push({
          id: `hist_match_${m.id}`,
          refId: refStart,
          source: 'match',
          category: 'matches',
          categoryLabelAr: getCategoryLabelAr('matches'),
          actorRole: 'USER',
          userId: m.user1?.userId,
          displayId: m.user1?.displayId,
          email: m.user1?.email,
          userName: m.user1?.name,
          targetUserId: m.user2?.userId,
          targetDisplayId: m.user2?.displayId,
          targetEmail: m.user2?.email,
          targetName: m.user2?.name,
          action: m.status === 'active' ? 'match_active' : 'match_ended',
          actionLabelAr: m.status === 'active' ? 'جلسة مطابقة جارية' : 'جلسة مطابقة مكتملة',
          details: `عدد الرسائل: ${(m.messages || []).length}${m.endedReason ? ` | سبب الإنهاء: ${m.endedReason}` : ''}`,
          status: m.status,
          createdAt: m.matchedAt,
          deletable: false,
        });
      }
    }

    // 5. Vault deletedChats
    for (const dc of vault.deletedChats) {
      const refDc = `delchat:${dc.id}`;
      if (!seenRefIds.has(refDc)) {
        seenRefIds.add(refDc);
        entries.push({
          id: `hist_${dc.id}`,
          refId: refDc,
          source: 'deleted_chat',
          category: 'chat',
          categoryLabelAr: getCategoryLabelAr('chat'),
          actorRole: resolveRoleForEmail(dc.deletedByEmail),
          userId: dc.deletedByUserId || dc.senderId,
          displayId: dc.senderDisplayId,
          email: dc.deletedByEmail || dc.senderEmail,
          userName: dc.deletedByName || dc.senderName,
          targetUserId: dc.receiverId,
          targetDisplayId: dc.receiverDisplayId,
          targetEmail: dc.receiverEmail,
          targetName: dc.receiverName,
          action: 'deleted_chat_archived',
          actionLabelAr: 'محادثة محذوفة مؤرشفة',
          details: `${dc.senderEmail} ⇄ ${dc.receiverEmail} | الرسائل: ${(dc.messages || []).length} | الوسائط: ${dc.mediaCount || 0}`,
          status: 'archived',
          createdAt: dc.deletedAt,
          deletable: false,
        });
      }
    }

    // 6. All registered users + bans/freezes
    for (const u of usersList) {
      const refReg = `user_reg:${u.id}`;
      if (!seenRefIds.has(refReg)) {
        seenRefIds.add(refReg);
        entries.push({
          id: `hist_user_${u.id}`,
          refId: refReg,
          source: 'user_account',
          category: 'auth',
          categoryLabelAr: getCategoryLabelAr('auth'),
          actorRole: resolveRoleForEmail(u.email),
          userId: u.id,
          displayId: u.displayId,
          email: u.email,
          userName: u.name,
          action: 'account_registered',
          actionLabelAr: 'تسجيل حساب في الموقع',
          details: `الدولة: ${u.country || '—'} | الكوينز: ${Number(u.coinsBalance || 0).toLocaleString()} | الماسات: ${Number(u.walletBalance || 0).toLocaleString()}${u.isVerified ? ' | موثّق ✓' : ''}`,
          status: u.isBanned ? 'banned' : u.isFrozen ? 'frozen' : 'active',
          createdAt: u.createdAt || new Date().toISOString(),
          deletable: false,
        });
      }
      if (u.isBanned && u.bannedAt) {
        entries.push({
          id: `hist_ban_${u.id}`,
          source: 'user_account',
          category: 'admin',
          categoryLabelAr: getCategoryLabelAr('admin'),
          actorRole: 'ADMIN2',
          targetUserId: u.id,
          targetDisplayId: u.displayId,
          targetEmail: u.email,
          targetName: u.name,
          action: 'account_banned',
          actionLabelAr: 'حساب محظور',
          details: u.banReason ? `السبب: ${u.banReason}` : 'تم حظر الحساب',
          status: 'banned',
          createdAt: u.bannedAt,
          deletable: false,
        });
      }
      if (u.isFrozen) {
        entries.push({
          id: `hist_freeze_${u.id}`,
          source: 'user_account',
          category: 'admin',
          categoryLabelAr: getCategoryLabelAr('admin'),
          actorRole: 'ADMIN2',
          targetUserId: u.id,
          targetDisplayId: u.displayId,
          targetEmail: u.email,
          targetName: u.name,
          action: 'account_frozen',
          actionLabelAr: 'حساب مجمّد',
          details: `${u.freezeReason || 'تجميد مؤقت'}${u.freezeExpiresAt ? ` | ينتهي: ${u.freezeExpiresAt}` : ''}`,
          status: 'frozen',
          createdAt: u.updatedAt || u.createdAt || new Date().toISOString(),
          deletable: false,
        });
      }
    }

    // 7. Deleted user tombstones
    const deletedUsersList = Array.isArray(sources.deletedUserKeys) ? sources.deletedUserKeys : [];
    const groupedDeleted = deletedUsersList.filter((k) => k.includes('@') || k.startsWith('s-') || k.length > 10);
    groupedDeleted.forEach((key, idx) => {
      entries.push({
        id: `hist_deluser_${idx}_${key}`,
        source: 'user_account',
        category: 'admin',
        categoryLabelAr: getCategoryLabelAr('admin'),
        actorRole: 'SYSTEM',
        userId: key,
        email: key.includes('@') ? key : undefined,
        displayId: key.startsWith('s-') ? key.toUpperCase() : undefined,
        userName: `حساب محذوف (${key})`,
        action: 'deleted_user_tombstone',
        actionLabelAr: 'سجل حساب محذوف نهائياً',
        details: `المعرف/البريد المحذوف من الموقع: ${key}`,
        status: 'deleted',
        createdAt: new Date(0).toISOString(),
        deletable: false,
      });
    });

    // 8. All active conversations messages & gifts
    let totalMessagesCount = 0;
    const conversations = Array.isArray(sources.conversations) ? sources.conversations : [];
    for (const conv of conversations) {
      const msgs = Array.isArray(conv?.messages) ? conv.messages : [];
      totalMessagesCount += msgs.length;
      const participants: string[] = Array.isArray(conv?.participants) ? conv.participants : [];
      for (const msg of msgs) {
        const refMsg = `msg:${msg.id}`;
        if (seenRefIds.has(refMsg)) continue;
        seenRefIds.add(refMsg);

        const sender = lookupUser(msg.senderId);
        const receiverIdent = participants.find(
          (p) =>
            p !== msg.senderId &&
            p !== sender?.id &&
            p !== sender?.displayId &&
            p !== sender?.email
        );
        const receiver = lookupUser(receiverIdent);

        entries.push({
          id: `hist_msg_${msg.id}`,
          refId: refMsg,
          source: 'message',
          category: 'chat',
          categoryLabelAr: getCategoryLabelAr('chat'),
          actorRole: resolveRoleForEmail(sender?.email),
          userId: sender?.id || msg.senderId,
          displayId: sender?.displayId,
          email: sender?.email,
          userName: msg.senderName || sender?.name || msg.senderId,
          targetUserId: receiver?.id || receiverIdent,
          targetDisplayId: receiver?.displayId,
          targetEmail: receiver?.email,
          targetName: receiver?.name || conv?.participantDetails?.[receiverIdent || '']?.name,
          action: msg.isGift ? 'send_gift' : msg.mediaType === 'image' ? 'send_image' : msg.mediaType === 'audio' ? 'send_audio' : 'send_message',
          actionLabelAr: msg.isGift
            ? 'إرسال هدية في المحادثة'
            : msg.mediaType === 'image'
            ? 'إرسال صورة في المحادثة'
            : msg.mediaType === 'audio'
            ? 'إرسال رسالة صوتية'
            : 'إرسال رسالة محادثة',
          details: msg.isGift
            ? `${msg.giftIcon || '🎁'} ${msg.giftName || 'هدية'}${msg.giftCost ? ` (${Number(msg.giftCost).toLocaleString()} كوينز)` : ''} — ${msg.text || ''}`
            : msg.text || (msg.mediaType ? `[${msg.mediaType}]` : 'رسالة'),
          amount: msg.isGift && msg.giftCost ? Number(msg.giftCost) : undefined,
          currency: msg.isGift ? 'coins' : undefined,
          createdAt: msg.createdAt || conv.updatedAt || conv.createdAt || new Date().toISOString(),
          deletable: false,
        });
      }
    }

    // 9. Agents & Agency Transactions & Withdrawals
    const agents = Array.isArray(sources.agents) ? sources.agents : [];
    const lookupAgent = (idOrCode?: string) => {
      if (!idOrCode) return undefined;
      const clean = String(idOrCode).trim().toLowerCase();
      return agents.find(
        (a) =>
          (a.id && String(a.id).toLowerCase() === clean) ||
          (a.gridCode && String(a.gridCode).toLowerCase() === clean)
      );
    };

    for (const ag of agents) {
      const refAg = `agent:${ag.id}`;
      if (!seenRefIds.has(refAg)) {
        seenRefIds.add(refAg);
        const linkedUser = lookupUser(ag.userId || ag.email);
        entries.push({
          id: `hist_agent_${ag.id}`,
          refId: refAg,
          source: 'agency_tx',
          category: 'agency',
          categoryLabelAr: getCategoryLabelAr('agency'),
          actorRole: 'AGENT',
          userId: linkedUser?.id || ag.userId || ag.id,
          displayId: ag.gridCode || linkedUser?.displayId,
          email: ag.email || linkedUser?.email,
          userName: ag.nameAr || ag.name,
          action: 'agent_profile',
          actionLabelAr: 'وكالة شحن معتمدة',
          details: `كود الوكالة: ${ag.gridCode || ag.id} | الرصيد: ${Number(ag.balance || 0).toLocaleString()} | الطلبات المكتملة: ${ag.completedOrders || 0} | الحالة: ${ag.status || 'active'}`,
          amount: Number(ag.balance || 0),
          currency: 'coins',
          status: ag.status || 'active',
          createdAt: ag.createdAt || new Date().toISOString(),
          deletable: false,
        });
      }
    }

    const agencyTxs = Array.isArray(sources.agencyTransactions) ? sources.agencyTransactions : [];
    for (const tx of agencyTxs) {
      const refTx = `tx:${tx.id}`;
      if (seenRefIds.has(refTx)) continue;
      seenRefIds.add(refTx);
      const ag = lookupAgent(tx.agentId || tx.gridCode);
      const targetU = lookupUser(tx.targetUserId || tx.targetUserDisplayId);
      const isWithdraw = tx.type === 'user_withdrawal';
      entries.push({
        id: `hist_tx_${tx.id}`,
        refId: refTx,
        source: 'agency_tx',
        category: 'agency',
        categoryLabelAr: getCategoryLabelAr('agency'),
        actorRole: isWithdraw ? 'USER' : 'AGENT',
        userId: isWithdraw ? (targetU?.id || tx.targetUserId) : (ag?.userId || ag?.id || tx.agentId),
        displayId: isWithdraw ? (targetU?.displayId || tx.targetUserDisplayId) : (tx.gridCode || ag?.gridCode),
        email: isWithdraw ? targetU?.email : ag?.email,
        userName: isWithdraw ? (tx.targetUserName || targetU?.name) : (ag?.nameAr || ag?.name || tx.gridCode),
        targetUserId: isWithdraw ? (ag?.id || tx.agentId) : (targetU?.id || tx.targetUserId),
        targetDisplayId: isWithdraw ? (tx.gridCode || ag?.gridCode) : (targetU?.displayId || tx.targetUserDisplayId),
        targetEmail: isWithdraw ? ag?.email : targetU?.email,
        targetName: isWithdraw ? (ag?.nameAr || ag?.name || tx.gridCode) : (tx.targetUserName || targetU?.name),
        action: isWithdraw ? 'agency_user_withdrawal' : 'agency_recharge',
        actionLabelAr: isWithdraw ? 'سحب أرباح مستخدم عبر وكالة' : 'شحن رصيد مستخدم عبر وكالة',
        details: isWithdraw
          ? `الطلب: ${tx.orderNumber || tx.orderId || tx.id} | الماسات المسحوبة: ${Number(tx.grossAmount || 0).toLocaleString()} | الصافي: $${tx.netUsdAmount ?? tx.usdAmount ?? 0} | صافي كوينز الوكالة: ${Number(tx.amount || 0).toLocaleString()}`
          : `الوكيل (${tx.gridCode || tx.agentId}) شحن ${Number(tx.amount || 0).toLocaleString()} كوينز للمستخدم ${tx.targetUserName || tx.targetUserDisplayId || ''}`,
        amount: Number(tx.amount || 0),
        currency: isWithdraw ? 'diamonds' : 'coins',
        status: 'completed',
        createdAt: tx.timestamp || new Date().toISOString(),
        deletable: false,
      });
    }

    const agencyWdrs = Array.isArray(sources.agencyWithdrawals) ? sources.agencyWithdrawals : [];
    for (const w of agencyWdrs) {
      const refW = `wdr:${w.id}`;
      if (seenRefIds.has(refW)) continue;
      seenRefIds.add(refW);
      const u = lookupUser(w.userId || w.userDisplayId);
      const ag = lookupAgent(w.agentId || w.gridCode);
      entries.push({
        id: `hist_wdr_${w.id}`,
        refId: refW,
        source: 'agency_withdrawal',
        category: 'wallet',
        categoryLabelAr: getCategoryLabelAr('wallet'),
        actorRole: w.type === 'agency_cashout' ? 'AGENT' : 'USER',
        userId: u?.id || w.userId || ag?.id || w.agentId,
        displayId: u?.displayId || w.userDisplayId || w.gridCode,
        email: u?.email || ag?.email,
        userName: w.userName || u?.name || w.agentName || ag?.name,
        targetUserId: ag?.id || w.agentId,
        targetDisplayId: w.gridCode,
        targetName: w.agentName || ag?.name,
        action: w.type === 'agency_cashout' ? 'agency_cashout_request' : 'user_withdrawal_request',
        actionLabelAr: w.type === 'agency_cashout' ? 'طلب سحب رصيد وكالة' : 'طلب سحب ماسات عبر وكيل',
        details: `${w.orderNumber ? `طلب: ${w.orderNumber} | ` : ''}المبلغ: ${Number(w.amount || 0).toLocaleString()} | الطريقة: ${w.method || w.payoutMethod || '—'} | الحالة: ${w.status || 'pending'}`,
        amount: Number(w.amount || 0),
        currency: 'diamonds',
        status: w.status || 'pending',
        createdAt: w.createdAt || new Date().toISOString(),
        deletable: false,
      });
    }

    // 10. Friends & Friend Requests
    for (const f of sources.friends || []) {
      const refF = `friend:${f.id}`;
      if (seenRefIds.has(refF)) continue;
      seenRefIds.add(refF);
      const u1 = lookupUser(f.userId || f.userDisplayId);
      const u2 = lookupUser(f.friendId || f.friendDisplayId);
      entries.push({
        id: `hist_fr_${f.id}`,
        refId: refF,
        source: 'friend',
        category: 'social',
        categoryLabelAr: getCategoryLabelAr('social'),
        actorRole: 'USER',
        userId: u1?.id || f.userId,
        displayId: u1?.displayId || f.userDisplayId,
        email: u1?.email,
        userName: f.userName || u1?.name,
        targetUserId: u2?.id || f.friendId,
        targetDisplayId: u2?.displayId || f.friendDisplayId,
        targetEmail: u2?.email,
        targetName: f.friendName || u2?.name,
        action: 'friendship_established',
        actionLabelAr: 'علاقة صداقة',
        details: `${f.userName || f.userId} ⇄ ${f.friendName || f.friendId}`,
        status: 'accepted',
        createdAt: f.createdAt || new Date().toISOString(),
        deletable: false,
      });
    }

    for (const r of sources.friendRequests || []) {
      const refR = `freq:${r.id}`;
      if (seenRefIds.has(refR)) continue;
      seenRefIds.add(refR);
      const u1 = lookupUser(r.senderId || r.senderDisplayId);
      const u2 = lookupUser(r.receiverId || r.receiverDisplayId);
      entries.push({
        id: `hist_freq_${r.id}`,
        refId: refR,
        source: 'friend',
        category: 'social',
        categoryLabelAr: getCategoryLabelAr('social'),
        actorRole: 'USER',
        userId: u1?.id || r.senderId,
        displayId: u1?.displayId || r.senderDisplayId,
        email: u1?.email,
        userName: r.senderName || u1?.name,
        targetUserId: u2?.id || r.receiverId,
        targetDisplayId: u2?.displayId || r.receiverDisplayId,
        targetEmail: u2?.email,
        targetName: r.receiverName || u2?.name,
        action: `friend_request_${r.status || 'pending'}`,
        actionLabelAr: r.status === 'accepted' ? 'طلب صداقة مقبول' : r.status === 'declined' ? 'طلب صداقة مرفوض' : 'طلب صداقة معلق',
        details: `من ${r.senderName || r.senderId} إلى ${r.receiverName || r.receiverId}`,
        status: r.status || 'pending',
        createdAt: r.updatedAt || r.createdAt || new Date().toISOString(),
        deletable: false,
      });
    }

    // 11. Blocked users
    for (const b of sources.blockedUsers || []) {
      const refB = `block:${b.id}`;
      if (seenRefIds.has(refB)) continue;
      seenRefIds.add(refB);
      const u1 = lookupUser(b.blockerId || b.blockerDisplayId);
      const u2 = lookupUser(b.blockedId || b.blockedDisplayId);
      entries.push({
        id: `hist_blk_${b.id}`,
        refId: refB,
        source: 'block',
        category: 'social',
        categoryLabelAr: getCategoryLabelAr('social'),
        actorRole: 'USER',
        userId: u1?.id || b.blockerId,
        displayId: u1?.displayId || b.blockerDisplayId,
        email: u1?.email,
        userName: u1?.name || b.blockerId,
        targetUserId: u2?.id || b.blockedId,
        targetDisplayId: u2?.displayId || b.blockedDisplayId,
        targetEmail: u2?.email,
        targetName: b.blockedName || u2?.name || b.blockedId,
        action: 'block_user_record',
        actionLabelAr: 'حظر مستخدم',
        details: `${u1?.name || b.blockerId} حظر ${b.blockedName || u2?.name || b.blockedId}`,
        status: 'blocked',
        createdAt: b.blockedAt || new Date().toISOString(),
        deletable: false,
      });
    }

    // 12. Feedback & User Reports
    for (const fb of sources.feedbackReports || []) {
      const refFb = `fb:${fb.id}`;
      if (seenRefIds.has(refFb)) continue;
      seenRefIds.add(refFb);
      const u = lookupUser(fb.userId || fb.userEmail || fb.userDisplayId);
      const targetU = fb.reportedUserId ? lookupUser(fb.reportedUserId) : undefined;
      entries.push({
        id: `hist_fb_${fb.id}`,
        refId: refFb,
        source: 'feedback',
        category: 'reports',
        categoryLabelAr: getCategoryLabelAr('reports'),
        actorRole: 'USER',
        userId: u?.id || fb.userId,
        displayId: u?.displayId || fb.userDisplayId,
        email: fb.userEmail || u?.email,
        userName: fb.userName || u?.name,
        targetUserId: targetU?.id || fb.reportedUserId,
        targetDisplayId: targetU?.displayId || fb.reportedUserDisplayId,
        targetEmail: targetU?.email,
        targetName: fb.reportedUserName || targetU?.name,
        action: fb.type === 'user_report' ? 'user_report' : fb.type === 'bug' ? 'bug_report' : 'suggestion',
        actionLabelAr: fb.type === 'user_report' ? 'بلاغ ضد مستخدم' : fb.type === 'bug' ? 'بلاغ خطأ تقني' : 'اقتراح مستخدم',
        details: `${fb.title || ''}${fb.description ? ` — ${fb.description}` : ''}${fb.adminReply ? ` | رد الإدارة: ${fb.adminReply}` : ''}`,
        status: fb.status || 'pending',
        createdAt: fb.createdAt || new Date().toISOString(),
        deletable: false,
      });
    }

    // 13. Password Reset Requests
    for (const pr of sources.passwordResetRequests || []) {
      const refPr = `pwr:${pr.id}`;
      if (seenRefIds.has(refPr)) continue;
      seenRefIds.add(refPr);
      const u = lookupUser(pr.userId || pr.userEmail || pr.userDisplayId);
      entries.push({
        id: `hist_pr_${pr.id}`,
        refId: refPr,
        source: 'password_reset',
        category: 'auth',
        categoryLabelAr: getCategoryLabelAr('auth'),
        actorRole: 'USER',
        userId: u?.id || pr.userId,
        displayId: u?.displayId || pr.userDisplayId,
        email: pr.userEmail || u?.email,
        userName: pr.userName || u?.name,
        action: 'password_reset_request',
        actionLabelAr: 'طلب استعادة كلمة المرور',
        details: `المصدر: ${pr.source || 'web'} | الحالة: ${pr.status || 'pending'}${pr.contactNote ? ` | ملاحظة: ${pr.contactNote}` : ''}`,
        status: pr.status || 'pending',
        createdAt: pr.createdAt || new Date().toISOString(),
        deletable: false,
      });
    }

    // 14. Verification Requests
    for (const vr of sources.verificationRequests || []) {
      const refVr = `ver:${vr.id}`;
      if (seenRefIds.has(refVr)) continue;
      seenRefIds.add(refVr);
      const u = lookupUser(vr.userId || vr.userEmail || vr.userDisplayId);
      entries.push({
        id: `hist_ver_${vr.id}`,
        refId: refVr,
        source: 'verification',
        category: 'verification',
        categoryLabelAr: getCategoryLabelAr('verification'),
        actorRole: 'USER',
        userId: u?.id || vr.userId,
        displayId: u?.displayId || vr.userDisplayId,
        email: vr.userEmail || u?.email,
        userName: vr.userName || u?.name,
        action: `verification_${vr.status || 'pending'}`,
        actionLabelAr:
          vr.status === 'approved'
            ? 'طلب توثيق مقبول ✓'
            : vr.status === 'rejected'
            ? 'طلب توثيق مرفوض'
            : 'طلب توثيق حساب قيد المراجعة',
        details: vr.rejectionReason ? `سبب الرفض: ${vr.rejectionReason}` : `الحالة: ${vr.status || 'pending'}`,
        status: vr.status || 'pending',
        createdAt: vr.reviewedAt || vr.createdAt || new Date().toISOString(),
        deletable: false,
      });
    }

    // 15. Bot Referrals
    const botRef = sources.botReferrals || { users: [], events: [], transfers: [] };
    for (const ev of botRef.events || []) {
      entries.push({
        id: `hist_bot_ev_${ev.id || ev.createdAt}`,
        source: 'bot_referral',
        category: 'system',
        categoryLabelAr: getCategoryLabelAr('system'),
        actorRole: 'SYSTEM',
        userId: ev.telegramUserId ? String(ev.telegramUserId) : undefined,
        userName: ev.username || ev.firstName || 'Telegram User',
        action: 'bot_referral_event',
        actionLabelAr: 'إحالة عبر بوت تيليجرام',
        details: `المُحيل: ${ev.referrerTelegramId || '—'} | المكافأة: ${ev.bonusCoins || ev.bonusUsd || 0}`,
        createdAt: ev.createdAt || new Date().toISOString(),
        deletable: false,
      });
    }
    for (const tr of botRef.transfers || []) {
      const targetU = lookupUser(tr.targetUserId || tr.displayId);
      entries.push({
        id: `hist_bot_tr_${tr.id || tr.createdAt}`,
        source: 'bot_referral',
        category: 'wallet',
        categoryLabelAr: getCategoryLabelAr('wallet'),
        actorRole: 'SYSTEM',
        userId: targetU?.id || tr.targetUserId,
        displayId: targetU?.displayId || tr.displayId,
        email: targetU?.email,
        userName: targetU?.name || tr.targetName,
        action: 'bot_referral_transfer',
        actionLabelAr: 'تحويل مكافأة بوت تيليجرام',
        details: `تحويل ${Number(tr.coins || tr.amount || 0).toLocaleString()} كوينز إلى الحساب`,
        amount: Number(tr.coins || tr.amount || 0),
        currency: 'coins',
        createdAt: tr.createdAt || new Date().toISOString(),
        deletable: false,
      });
    }

    // 16. Active Sessions
    for (const sess of sources.sessions || []) {
      const u = lookupUser(sess.userId || sess.email);
      entries.push({
        id: `hist_sess_${String(sess.token || '').slice(0, 12)}_${sess.userId}`,
        source: 'session',
        category: 'auth',
        categoryLabelAr: getCategoryLabelAr('auth'),
        actorRole: resolveRoleForEmail(sess.email),
        userId: sess.userId || u?.id,
        displayId: sess.displayId || u?.displayId,
        email: sess.email || u?.email,
        userName: sess.name || u?.name,
        action: 'active_session',
        actionLabelAr: 'جلسة دخول نشطة',
        details: `جلسة مفعلة${sess.isAdmin ? ' (صلاحية إدارية)' : ''}`,
        status: 'active',
        createdAt: (sess as any).createdAt || u?.updatedAt || u?.createdAt || new Date().toISOString(),
        deletable: false,
      });
    }

    // Sort all entries chronologically (newest first)
    entries.sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });

    // Build unified users index across ALL active + historical users
    const userMap = new Map<
      string,
      {
        key: string;
        userId?: string;
        displayId?: string;
        email?: string;
        name: string;
        role: SupremeActorRole;
        isBanned?: boolean;
        isFrozen?: boolean;
        isVerified?: boolean;
        isDeleted?: boolean;
        eventCount: number;
      }
    >();

    for (const u of usersList) {
      const key = String(u.id || u.email || u.displayId).toLowerCase();
      userMap.set(key, {
        key,
        userId: u.id,
        displayId: u.displayId,
        email: u.email,
        name: u.name || u.email,
        role: resolveRoleForEmail(u.email),
        isBanned: Boolean(u.isBanned),
        isFrozen: Boolean(u.isFrozen),
        isVerified: Boolean(u.isVerified),
        isDeleted: false,
        eventCount: 0,
      });
    }

    const resolveMapKeyForLog = (uid?: string, did?: string, em?: string): string | null => {
      const matched = lookupUser(uid || em || did);
      if (matched) return String(matched.id || matched.email || matched.displayId).toLowerCase();
      if (em) return `email:${em.toLowerCase()}`;
      if (uid) return `id:${uid.toLowerCase()}`;
      if (did) return `did:${did.toLowerCase()}`;
      return null;
    };

    for (const e of entries) {
      const actorKey = resolveMapKeyForLog(e.userId, e.displayId, e.email);
      if (actorKey) {
        const existing = userMap.get(actorKey);
        if (existing) {
          existing.eventCount += 1;
        } else {
          userMap.set(actorKey, {
            key: actorKey,
            userId: e.userId,
            displayId: e.displayId,
            email: e.email,
            name: e.userName || e.email || e.displayId || e.userId || 'مستخدم',
            role: e.actorRole,
            isDeleted: e.action === 'deleted_user_tombstone',
            eventCount: 1,
          });
        }
      }
      const targetKey = resolveMapKeyForLog(e.targetUserId, e.targetDisplayId, e.targetEmail);
      if (targetKey && targetKey !== actorKey) {
        const existingTarget = userMap.get(targetKey);
        if (existingTarget) {
          existingTarget.eventCount += 1;
        } else {
          userMap.set(targetKey, {
            key: targetKey,
            userId: e.targetUserId,
            displayId: e.targetDisplayId,
            email: e.targetEmail,
            name: e.targetName || e.targetEmail || e.targetDisplayId || e.targetUserId || 'مستخدم',
            role: 'USER',
            isDeleted: false,
            eventCount: 1,
          });
        }
      }
    }

    // Category summary counts across entire site
    const categoryCounts: Record<string, number> = {};
    let gameRoundsCount = 0;
    for (const e of entries) {
      categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
      if (e.category === 'games') gameRoundsCount += 1;
    }

    // Query filters
    const qParam = String(req.query.q || '').trim().toLowerCase();
    const categoryParam = String(req.query.category || 'all').trim();
    const roleParam = String(req.query.actorRole || 'all').trim().toUpperCase();
    const userKeyParam = String(req.query.userKey || '').trim().toLowerCase();
    const dateFromParam = String(req.query.dateFrom || '').trim();
    const dateToParam = String(req.query.dateTo || '').trim();
    const limitParam = Math.min(3000, Math.max(1, parseInt(String(req.query.limit || '1000'), 10) || 1000));
    const offsetParam = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0);

    const fromMs = dateFromParam ? new Date(dateFromParam).getTime() : null;
    const toMs = dateToParam ? new Date(dateToParam + (dateToParam.length <= 10 ? 'T23:59:59.999Z' : '')).getTime() : null;

    // Resolve all identifiers of selected userKeyParam so we match every log touching that user
    let userAliasSet: Set<string> | null = null;
    if (userKeyParam && userKeyParam !== 'all') {
      userAliasSet = new Set<string>();
      const cleanParam = userKeyParam.replace(/^(email:|id:|did:)/, '');
      userAliasSet.add(cleanParam);
      const matched = lookupUser(cleanParam);
      if (matched) {
        if (matched.id) userAliasSet.add(String(matched.id).toLowerCase());
        if (matched.displayId) userAliasSet.add(String(matched.displayId).toLowerCase());
        if (matched.email) userAliasSet.add(String(matched.email).toLowerCase());
        if (matched.name) userAliasSet.add(String(matched.name).toLowerCase());
      }
      const indexItem = userMap.get(userKeyParam);
      if (indexItem) {
        if (indexItem.userId) userAliasSet.add(String(indexItem.userId).toLowerCase());
        if (indexItem.displayId) userAliasSet.add(String(indexItem.displayId).toLowerCase());
        if (indexItem.email) userAliasSet.add(String(indexItem.email).toLowerCase());
      }
    }

    const filtered = entries.filter((e) => {
      if (categoryParam && categoryParam !== 'all' && e.category !== categoryParam) return false;
      if (roleParam && roleParam !== 'ALL' && e.actorRole !== roleParam) return false;
      if (userAliasSet) {
        const hitsUser =
          (e.userId && userAliasSet.has(String(e.userId).toLowerCase())) ||
          (e.displayId && userAliasSet.has(String(e.displayId).toLowerCase())) ||
          (e.email && userAliasSet.has(String(e.email).toLowerCase())) ||
          (e.targetUserId && userAliasSet.has(String(e.targetUserId).toLowerCase())) ||
          (e.targetDisplayId && userAliasSet.has(String(e.targetDisplayId).toLowerCase())) ||
          (e.targetEmail && userAliasSet.has(String(e.targetEmail).toLowerCase()));
        if (!hitsUser) return false;
      }
      if (fromMs !== null && Number.isFinite(fromMs)) {
        const ts = new Date(e.createdAt).getTime();
        if (!Number.isFinite(ts) || ts < fromMs) return false;
      }
      if (toMs !== null && Number.isFinite(toMs)) {
        const ts = new Date(e.createdAt).getTime();
        if (!Number.isFinite(ts) || ts > toMs) return false;
      }
      if (qParam) {
        const haystack = [
          e.userName,
          e.email,
          e.displayId,
          e.userId,
          e.targetName,
          e.targetEmail,
          e.targetDisplayId,
          e.targetUserId,
          e.action,
          e.actionLabelAr,
          e.categoryLabelAr,
          e.details,
          e.ip,
          e.path,
          e.actorRole,
          e.status,
          e.amount !== undefined ? String(e.amount) : '',
          e.currency,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(qParam)) return false;
      }
      return true;
    });

    const sliced = filtered.slice(offsetParam, offsetParam + limitParam);

    return res.json({
      success: true,
      logs: sliced,
      totalMatched: filtered.length,
      totalAll: entries.length,
      summary: {
        totalEvents: entries.length,
        totalUsers: usersList.length,
        deletedUsers: groupedDeleted.length,
        bannedUsers: usersList.filter((u) => u.isBanned).length,
        frozenUsers: usersList.filter((u) => u.isFrozen).length,
        totalMessages: totalMessagesCount,
        totalDeletedChats: vault.deletedChats.length,
        totalMatches: vault.matchLogs.length,
        totalTransactions: agencyTxs.length,
        totalWithdrawals: agencyWdrs.length,
        totalGameRounds: gameRoundsCount,
        totalReports: (sources.feedbackReports || []).length,
        totalVerifications: (sources.verificationRequests || []).length,
        totalPasswordResets: (sources.passwordResetRequests || []).length,
        totalAdmin2Events: vault.admin2Logs.length,
        categoryCounts,
      },
      usersIndex: Array.from(userMap.values()).sort((a, b) => b.eventCount - a.eventCount),
    });
  });

  app.delete('/api/supreme/general-log/:logId', requireSupremeAuth, async (req: Request, res: Response) => {
    const logId = decodeURIComponent(String(req.params.logId || '')).trim();
    const vault = readVault();
    vault.generalLogs = vault.generalLogs.filter((l) => l.id !== logId);
    vault.userLogs = vault.userLogs.filter((l) => l.id !== logId);
    vault.admin2Logs = vault.admin2Logs.filter((l) => l.id !== logId);
    writeVault(vault);
    if (neonPoolRef) {
      await Promise.all([
        neonPoolRef.query('DELETE FROM supreme_general_logs WHERE id = $1', [logId]).catch(() => {}),
        neonPoolRef.query('DELETE FROM supreme_user_logs WHERE id = $1', [logId]).catch(() => {}),
        neonPoolRef.query('DELETE FROM supreme_admin2_logs WHERE id = $1', [logId]).catch(() => {}),
      ]);
    }
    return res.json({ success: true });
  });

  app.delete('/api/supreme/general-log', requireSupremeAuth, async (_req: Request, res: Response) => {
    const vault = readVault();
    vault.generalLogs = [];
    writeVault(vault);
    if (neonPoolRef) {
      await neonPoolRef.query('DELETE FROM supreme_general_logs').catch(() => {});
    }
    return res.json({ success: true });
  });
}
