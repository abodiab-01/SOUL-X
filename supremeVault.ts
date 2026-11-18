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

export interface SupremeVaultData {
  deletedChats: SupremeDeletedChat[];
  matchLogs: SupremeMatchLog[];
  userLogs: SupremeUserLog[];
  admin2Logs: SupremeAdmin2Log[];
}

// ==========================================
// Admin Role Resolution (Strict Isolation)
// ==========================================
function loadEnvAdmins(): { admin1: string; admin2: string; adminPin: string; supremePin: string } {
  let admin1 = (process.env.ADMIN1 || '').trim().toLowerCase();
  let admin2 = (process.env.ADMIN2 || '').trim().toLowerCase();
  let adminPin = (process.env.ADMIN_PIN || '').trim();
  let supremePin = (process.env.SUPREME_PIN || '').trim();

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
      if (parsed.SUPREME_PIN && String(parsed.SUPREME_PIN).trim()) {
        supremePin = String(parsed.SUPREME_PIN).trim();
      }
    }
  } catch {}

  return {
    admin1: admin1 || 'abojafar@soul-x.com',
    admin2: admin2 || 'abohaidar@soul-x.com',
    adminPin,
    supremePin,
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
      };
    }
  } catch {}
  return {
    deletedChats: [],
    matchLogs: [],
    userLogs: [],
    admin2Logs: [],
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
    const { adminPin, supremePin } = loadEnvAdmins();
    if (!check.isAdmin1) {
      return res.json({ eligible: false });
    }
    return res.json({
      eligible: true,
      requiresPin: Boolean(supremePin || adminPin),
    });
  });

  // Unlock Supreme Panel (ADMIN1 session + ADMIN1 password + PIN if configured)
  app.post('/api/supreme/unlock', (req: Request, res: Response) => {
    const check = resolveAdmin1FromRequest(req);
    if (!check.isAdmin1) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    const { password, pin } = req.body || {};
    const { adminPin, supremePin } = loadEnvAdmins();
    const expectedPin = supremePin || adminPin;

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'كلمة مرور حساب ADMIN1 مطلوبة' });
    }

    const user = check.user;
    const isPasswordValid = Boolean(
      (user?.passwordHash && user.passwordHash === deps.hashPassword(password)) ||
      (!user?.passwordHash && password === deps.defaultAdminPassword)
    );

    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'كلمة مرور ADMIN1 غير صحيحة' });
    }

    if (expectedPin) {
      if (!pin || String(pin).trim() !== expectedPin) {
        return res.status(401).json({ success: false, message: 'رمز الأمان الإداري غير صحيح' });
      }
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
}
