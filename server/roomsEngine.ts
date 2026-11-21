import type { Express, Request, Response } from 'express';
import type { Server as HttpServer, IncomingMessage } from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import type pg from 'pg';
import {
  MAX_ROOM_COVER_BYTES,
  isValidRoomCoverKey,
  validateAndProcessRoomCoverBuffer,
  uploadRoomCoverObject,
  readRoomCoverFromStorage,
  deleteRoomCoverObject,
} from './services/s3-client.ts';
import {
  ROOM_CREATE_COST_COINS,
  ROOM_MAX_SEATS,
  ROOM_RECONNECT_GRACE_MS,
  SOULX_ROOM_GIFTS,
  ROOM_MUSIC_PLAYLIST,
  ROOM_GAMES_BANK,
  getEffectivePermissions,
  getRoleRank,
} from './roomsCatalog.ts';
import type {
  RoomCategory,
  RoomRole,
  RoomModPermissions,
  RoomSeatInfo,
  RoomOccupantInfo,
  RoomQueueItem,
  RoomMessageRecord,
  RoomModRecord,
  RoomBanRecord,
  RoomEventRecord,
  RoomAuditLogRecord,
  RoomMusicState,
  RoomGameState,
  RoomMiniGameType,
  RoomSummary,
  RoomDetail,
} from '../src/types.ts';

export interface RoomsDeps {
  getNeonPool: () => pg.Pool | null;
  getStoredUsers: () => any[];
  saveStoredUsers: (users: any[]) => void;
  getStoredSessions: () => any[];
  getStoredFriendsData: () => { friends: any[]; requests: any[] };
  isUserBlockedPair: (a: string, b: string) => Promise<{ isBlocked: boolean; blockedByA?: boolean; blockedByB?: boolean }>;
  updateNeonProfileByIdentifier: (identifier: string, updates: Record<string, any>) => Promise<boolean>;
  broadcastChatMessage: (identKeys: (string | undefined)[], payload: any) => void;
  createAndSaveUserNotification?: (notifData: any) => any;
  getAdminEmails: () => string[];
  resolveUserRecordByAnyId: (idOrEmail: string) => any;
  verifyAdminAuth: (req: Request, res: Response, next: () => void) => void;
  DATA_DIR: string;
}

interface StoredRoomRecord {
  id: string;
  code: string;
  name: string;
  description: string;
  category: RoomCategory;
  coverKey: string | null;
  coverUrl: string;
  ownerId: string;
  isPublic: boolean;
  isLocked: boolean;
  pinHash: string | null;
  pinEncrypted: string | null;
  isFeatured: boolean;
  isHidden: boolean;
  isFrozen: boolean;
  freezeReason: string | null;
  frozenAt: string | null;
  isRoomMuted: boolean;
  chatEnabled: boolean;
  chatPaused: boolean;
  micRequestsEnabled: boolean;
  queueEnabled: boolean;
  invitesEnabled: boolean;
  gamesPermission: 'owner' | 'moderators' | 'all';
  musicPermission: 'owner' | 'moderators';
  notificationsEnabled: boolean;
  musicState: RoomMusicState;
  pinnedMessageId: string | null;
  totalGiftsCoins: number;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

interface StoredSeatRow {
  roomId: string;
  seatNumber: number;
  userId: string | null;
  isLocked: boolean;
  isMutedBySelf: boolean;
  isMutedByMod: boolean;
  occupiedAt: string | null;
}

interface StoredModRow {
  id: string;
  roomId: string;
  userId: string;
  role: 'head_admin' | 'moderator';
  permissions: RoomModPermissions;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredBanRow {
  id: string;
  roomId: string;
  userId: string;
  banType: 'ban' | 'kick';
  reason: string | null;
  bannedBy: string;
  expiresAt: string | null;
  createdAt: string;
}

interface StoredInviteRow {
  id: string;
  roomId: string;
  token: string;
  createdBy: string;
  targetUserId: string | null;
  expiresAt: string;
  createdAt: string;
}

interface StoredFavoriteRow {
  id: string;
  roomId: string;
  userId: string;
  notificationsEnabled: boolean;
  createdAt: string;
}

interface StoredEventRow {
  id: string;
  roomId: string;
  title: string;
  description: string;
  startsAt: string;
  createdBy: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  rsvpUserIds: string[];
  createdAt: string;
  updatedAt: string;
}

interface RoomsLocalStore {
  rooms: StoredRoomRecord[];
  seats: StoredSeatRow[];
  moderators: StoredModRow[];
  bans: StoredBanRow[];
  messages: RoomMessageRecord[];
  favorites: StoredFavoriteRow[];
  events: StoredEventRow[];
  auditLogs: RoomAuditLogRecord[];
  invites: StoredInviteRow[];
  idempotency: Record<string, { userId: string; action: string; response: any; createdAt: string }>;
}

interface LiveClientSocket {
  ws: WebSocket;
  userId: string;
  roomId: string;
  socketId: string;
  isAlive: boolean;
}

interface LiveGameRuntime {
  state: RoomGameState;
  questions: Array<typeof ROOM_GAMES_BANK.quiz[number]>;
  scores: Map<string, number>;
  roundTimer: NodeJS.Timeout | null;
}

interface LiveRoomRuntime {
  roomId: string;
  occupants: Map<
    string,
    {
      userId: string;
      joinedAt: string;
      isSpeaking: boolean;
      reconnecting: boolean;
      sockets: Set<string>;
      lastSpeakEmitMs: number;
      recentChatTimestamps: number[];
      lastChatText: string;
      lastChatAtMs: number;
    }
  >;
  disconnectTimers: Map<string, NodeJS.Timeout>;
  queue: RoomQueueItem[];
  game: LiveGameRuntime;
}

const DEFAULT_MUSIC_STATE: RoomMusicState = {
  isPlaying: false,
  trackId: ROOM_MUSIC_PLAYLIST[0].id,
  trackTitleAr: ROOM_MUSIC_PLAYLIST[0].titleAr,
  trackTitleEn: ROOM_MUSIC_PLAYLIST[0].titleEn,
  artist: ROOM_MUSIC_PLAYLIST[0].artist,
  startedAtMs: 0,
  offsetSec: 0,
};

function createIdleGameState(): RoomGameState {
  return {
    status: 'idle',
    gameType: null,
    gameId: null,
    roundNumber: 0,
    totalRounds: 0,
    question: null,
    roundStartedAtMs: 0,
    roundDurationSec: 15,
    answeredUserIds: [],
    winnerName: null,
    leaderboard: [],
  };
}

export function registerRoomsSystem(app: Express, httpServer: HttpServer, deps: RoomsDeps) {
  const ROOMS_DATA_FILE = path.resolve(deps.DATA_DIR, 'rooms_data.json');
  const uploadCover = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_ROOM_COVER_BYTES },
  });
  const handleCoverUpload = (req: Request, res: Response, next: (err?: any) => void) => {
    uploadCover.single('cover')(req, res, (err: any) => {
      if (err) {
        const isSizeErr = err?.code === 'LIMIT_FILE_SIZE';
        return res.status(isSizeErr ? 413 : 400).json({
          success: false,
          message: isSizeErr ? 'حجم صورة الغرفة يتجاوز الحد الأقصى (5 ميجابايت)' : 'فشل معالجة ملف الصورة المرفوع',
        });
      }
      next();
    });
  };

  // Encryption key for optional owner/admin PIN reveal
  const pinEncryptionKey = crypto
    .createHash('sha256')
    .update(`${process.env.ADMIN_PIN || 'soulx-pin-salt'}|${process.env.DATABASE_URL1 || 'soulx-local-room-key'}`)
    .digest();

  function encryptPin(pin: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', pinEncryptionKey, iv);
    const enc = Buffer.concat([cipher.update(pin, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
  }

  function decryptPin(payload?: string | null): string | null {
    if (!payload) return null;
    try {
      const parts = payload.split(':');
      if (parts.length !== 3) return null;
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const enc = Buffer.from(parts[2], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-gcm', pinEncryptionKey, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
  }

  function hashRoomPin(pin: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(pin, salt, 64).toString('hex');
    return `scrypt:${salt}:${derived}`;
  }

  function verifyRoomPin(pin: string, storedHash?: string | null): boolean {
    if (!pin || !storedHash) return false;
    try {
      const parts = storedHash.split(':');
      if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
      const [, salt, originalHex] = parts;
      const derived = crypto.scryptSync(pin, salt, 64);
      const original = Buffer.from(originalHex, 'hex');
      if (derived.length !== original.length) return false;
      return crypto.timingSafeEqual(derived, original);
    } catch {
      return false;
    }
  }

  // PIN brute-force rate limiter
  const pinAttempts = new Map<string, { count: number; blockedUntil: number }>();

  // Per-room async mutex locks + global coin mutation lock
  const roomLocks = new Map<string, Promise<any>>();
  function withRoomLock<T>(roomId: string, fn: () => Promise<T>): Promise<T> {
    const prev = roomLocks.get(roomId) || Promise.resolve();
    const next = prev.then(fn, fn);
    roomLocks.set(
      roomId,
      next.catch(() => {})
    );
    return next;
  }

  let coinChain: Promise<any> = Promise.resolve();
  function withCoinLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = coinChain.then(fn, fn);
    coinChain = next.catch(() => {});
    return next;
  }

  // Local persistent JSON store (mirrored with Neon PostgreSQL)
  function emptyLocalStore(): RoomsLocalStore {
    return {
      rooms: [],
      seats: [],
      moderators: [],
      bans: [],
      messages: [],
      favorites: [],
      events: [],
      auditLogs: [],
      invites: [],
      idempotency: {},
    };
  }

  let storeCache: RoomsLocalStore | null = null;
  function loadStore(): RoomsLocalStore {
    if (storeCache) return storeCache;
    try {
      if (fs.existsSync(ROOMS_DATA_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(ROOMS_DATA_FILE, 'utf-8'));
        storeCache = {
          rooms: Array.isArray(parsed.rooms)
            ? parsed.rooms.map((r: any) => ({
                ...r,
                isHidden: Boolean(r.isHidden),
                isFrozen: Boolean(r.isFrozen),
                freezeReason: r.freezeReason || null,
                frozenAt: r.frozenAt || null,
              }))
            : [],
          seats: Array.isArray(parsed.seats) ? parsed.seats : [],
          moderators: Array.isArray(parsed.moderators) ? parsed.moderators : [],
          bans: Array.isArray(parsed.bans) ? parsed.bans : [],
          messages: Array.isArray(parsed.messages) ? parsed.messages : [],
          favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
          events: Array.isArray(parsed.events) ? parsed.events : [],
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
          invites: Array.isArray(parsed.invites) ? parsed.invites : [],
          idempotency: parsed.idempotency && typeof parsed.idempotency === 'object' ? parsed.idempotency : {},
        };
        return storeCache;
      }
    } catch (err) {
      console.warn('Rooms local store read warning:', err);
    }
    storeCache = emptyLocalStore();
    return storeCache;
  }

  function saveStore() {
    const data = loadStore();
    try {
      if (!fs.existsSync(deps.DATA_DIR)) fs.mkdirSync(deps.DATA_DIR, { recursive: true });
      fs.writeFileSync(ROOMS_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Rooms local store write warning:', err);
    }
  }

  // Hydrate from Neon PostgreSQL if available (runs asynchronously on startup)
  let hydratedFromNeon = false;
  async function hydrateFromNeonIfNeeded() {
    if (hydratedFromNeon) return;
    const pool = deps.getNeonPool();
    if (!pool) return;
    hydratedFromNeon = true;
    try {
      await pool.query('ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE').catch(() => {});
      await pool.query('ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT FALSE').catch(() => {});
      await pool.query('ALTER TABLE rooms ADD COLUMN IF NOT EXISTS freeze_reason TEXT').catch(() => {});
      await pool.query('ALTER TABLE rooms ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ').catch(() => {});

      const rRes = await pool.query('SELECT * FROM rooms ORDER BY created_at DESC');
      if (!rRes || !Array.isArray(rRes.rows)) return;
      const store = loadStore();
      if (rRes.rows.length > 0) {
        // Authoritative sync from Neon
        const [sRes, modRes, banRes, msgRes, favRes, evtRes, audRes, invRes] = await Promise.all([
          pool.query('SELECT * FROM room_seats ORDER BY room_id, seat_number ASC'),
          pool.query('SELECT * FROM room_moderators'),
          pool.query('SELECT * FROM room_bans'),
          pool.query('SELECT * FROM room_messages ORDER BY created_at ASC LIMIT 4000'),
          pool.query('SELECT * FROM room_favorites'),
          pool.query('SELECT * FROM room_events'),
          pool.query('SELECT * FROM room_audit_logs ORDER BY created_at DESC LIMIT 3000'),
          pool.query('SELECT * FROM room_invites WHERE expires_at > NOW()'),
        ]);

        // Clear ghost seats on cold boot if live occupants Map is empty
        await pool.query('UPDATE room_seats SET user_id = NULL, occupied_at = NULL').catch(() => {});

        store.rooms = rRes.rows.map((row: any) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          description: row.description || '',
          category: (row.category || 'chat') as RoomCategory,
          coverKey: row.cover_key || null,
          coverUrl: row.cover_url || '',
          ownerId: row.owner_id,
          isPublic: row.is_public !== false,
          isLocked: Boolean(row.is_locked),
          pinHash: row.pin_hash || null,
          pinEncrypted: row.pin_encrypted || null,
          isFeatured: Boolean(row.is_featured),
          isHidden: Boolean(row.is_hidden),
          isFrozen: Boolean(row.is_frozen),
          freezeReason: row.freeze_reason || null,
          frozenAt: row.frozen_at ? new Date(row.frozen_at).toISOString() : null,
          isRoomMuted: Boolean(row.is_room_muted),
          chatEnabled: row.chat_enabled !== false,
          chatPaused: Boolean(row.chat_paused),
          micRequestsEnabled: row.mic_requests_enabled !== false,
          queueEnabled: row.queue_enabled !== false,
          invitesEnabled: row.invites_enabled !== false,
          gamesPermission: (row.games_permission || 'moderators') as any,
          musicPermission: (row.music_permission || 'moderators') as any,
          notificationsEnabled: row.notifications_enabled !== false,
          musicState: row.active_music_state && row.active_music_state.trackId ? row.active_music_state : { ...DEFAULT_MUSIC_STATE },
          pinnedMessageId: row.pinned_message_id || null,
          totalGiftsCoins: Number(row.total_gifts_coins || 0),
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
          lastActivityAt: new Date(row.last_activity_at).toISOString(),
        }));

        store.seats = (sRes.rows || []).map((row: any) => ({
          roomId: row.room_id,
          seatNumber: Number(row.seat_number),
          userId: null, // Cleared on boot (no ghost seats without live sockets)
          isLocked: Boolean(row.is_locked),
          isMutedBySelf: true,
          isMutedByMod: Boolean(row.is_muted_by_mod),
          occupiedAt: null,
        }));

        store.moderators = (modRes.rows || []).map((row: any) => ({
          id: row.id,
          roomId: row.room_id,
          userId: row.user_id,
          role: row.role === 'head_admin' ? 'head_admin' : 'moderator',
          permissions: getEffectivePermissions(row.role === 'head_admin' ? 'head_admin' : 'moderator', row.permissions),
          assignedBy: row.assigned_by,
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
        }));

        store.bans = (banRes.rows || []).map((row: any) => ({
          id: row.id,
          roomId: row.room_id,
          userId: row.user_id,
          banType: row.ban_type === 'kick' ? 'kick' : 'ban',
          reason: row.reason || null,
          bannedBy: row.banned_by,
          expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
          createdAt: new Date(row.created_at).toISOString(),
        }));

        store.messages = (msgRes.rows || []).map((row: any) => ({
          id: row.id,
          roomId: row.room_id,
          senderId: row.sender_id || null,
          senderName: row.sender_name || null,
          senderAvatar: row.sender_avatar || null,
          senderRole: row.sender_role || null,
          senderIsVerified: Boolean(row.sender_is_verified),
          senderFrameId: row.sender_frame_id || null,
          msgType: row.msg_type || 'text',
          text: row.text || '',
          metadata: row.metadata || null,
          isPinned: Boolean(row.is_pinned),
          isDeleted: Boolean(row.is_deleted),
          createdAt: new Date(row.created_at).toISOString(),
        }));

        store.favorites = (favRes.rows || []).map((row: any) => ({
          id: row.id,
          roomId: row.room_id,
          userId: row.user_id,
          notificationsEnabled: row.notifications_enabled !== false,
          createdAt: new Date(row.created_at).toISOString(),
        }));

        store.events = (evtRes.rows || []).map((row: any) => ({
          id: row.id,
          roomId: row.room_id,
          title: row.title,
          description: row.description || '',
          startsAt: new Date(row.starts_at).toISOString(),
          createdBy: row.created_by,
          status: row.status || 'scheduled',
          rsvpUserIds: Array.isArray(row.rsvp_user_ids) ? row.rsvp_user_ids : [],
          createdAt: new Date(row.created_at).toISOString(),
          updatedAt: new Date(row.updated_at).toISOString(),
        }));

        store.auditLogs = (audRes.rows || []).map((row: any) => ({
          id: row.id,
          roomId: row.room_id,
          actorId: row.actor_id,
          actorName: row.actor_name || undefined,
          actorRole: row.actor_role || undefined,
          action: row.action,
          targetUserId: row.target_user_id || null,
          targetUserName: row.target_user_name || null,
          details: row.details || null,
          metadata: row.metadata || null,
          createdAt: new Date(row.created_at).toISOString(),
        }));

        store.invites = (invRes.rows || []).map((row: any) => ({
          id: row.id,
          roomId: row.room_id,
          token: row.token,
          createdBy: row.created_by,
          targetUserId: row.target_user_id || null,
          expiresAt: new Date(row.expires_at).toISOString(),
          createdAt: new Date(row.created_at).toISOString(),
        }));

        saveStore();
      } else {
        // Clear any stale seat occupancy from local disk on clean server boot
        for (const s of store.seats) {
          s.userId = null;
          s.occupiedAt = null;
          s.isMutedBySelf = true;
        }
        saveStore();
      }
    } catch (err) {
      console.warn('Rooms Neon hydration warning:', err);
    }
  }

  // Trigger hydration shortly after startup
  setTimeout(() => {
    hydrateFromNeonIfNeeded().catch(() => {});
  }, 1500);

  // Clean expired bans, invites, idempotency cache, and PIN attempt windows periodically
  setInterval(() => {
    const store = loadStore();
    const now = Date.now();
    const prevBans = store.bans.length;
    const prevInvites = store.invites.length;
    store.bans = store.bans.filter((b) => !b.expiresAt || new Date(b.expiresAt).getTime() > now);
    store.invites = store.invites.filter((i) => new Date(i.expiresAt).getTime() > now);

    let idemPruned = false;
    const idemCutoff = now - 24 * 60 * 60 * 1000;
    for (const [k, v] of Object.entries(store.idempotency)) {
      const ts = new Date(v.createdAt || 0).getTime();
      if (!Number.isFinite(ts) || ts < idemCutoff) {
        delete store.idempotency[k];
        idemPruned = true;
      }
    }

    for (const [k, st] of pinAttempts.entries()) {
      if (st.blockedUntil > 0 && st.blockedUntil <= now) {
        pinAttempts.delete(k);
      }
    }

    if (store.bans.length !== prevBans || store.invites.length !== prevInvites || idemPruned) {
      saveStore();
      if (store.bans.length !== prevBans) {
        const pool = deps.getNeonPool();
        if (pool) {
          pool.query('DELETE FROM room_bans WHERE expires_at IS NOT NULL AND expires_at <= NOW()').catch(() => {});
        }
      }
    }
  }, 60_000);

  // Runtime live state (active WS clients, seat presence, queues, games)
  const liveRooms = new Map<string, LiveRoomRuntime>();
  const socketsById = new Map<string, LiveClientSocket>();

  function getLiveRoom(roomId: string): LiveRoomRuntime {
    let rt = liveRooms.get(roomId);
    if (!rt) {
      rt = {
        roomId,
        occupants: new Map(),
        disconnectTimers: new Map(),
        queue: [],
        game: {
          state: createIdleGameState(),
          questions: [],
          scores: new Map(),
          roundTimer: null,
        },
      };
      liveRooms.set(roomId, rt);
    }
    return rt;
  }

  function resolveUserBasic(userId: string): {
    id: string;
    displayId?: string;
    name: string;
    avatar?: string;
    isVerified?: boolean;
    equippedFrameId?: string | null;
    email?: string;
    isAdmin?: boolean;
  } {
    const u = deps.resolveUserRecordByAnyId(userId);
    if (u) {
      const adminEmails = deps.getAdminEmails();
      const isPlatformAdmin = Boolean(u.isAdmin || (u.email && adminEmails.includes(u.email.toLowerCase())));
      return {
        id: u.id,
        displayId: u.displayId,
        name: u.name || 'مستخدم',
        avatar: u.photoUrl || undefined,
        isVerified: Boolean(u.isVerified),
        equippedFrameId: u.equippedFrameId || null,
        email: u.email,
        isAdmin: isPlatformAdmin,
      };
    }
    return { id: userId, name: `عضو ${userId.slice(0, 6)}` };
  }

  function authenticateToken(token: string | null | undefined): {
    user: any;
    isPlatformAdmin: boolean;
    error?: string;
    status?: number;
  } {
    if (!token) {
      return { user: null, isPlatformAdmin: false, error: 'يرجى تسجيل الدخول للمتابعة', status: 401 };
    }
    const clean = token.trim();
    const sess = deps.getStoredSessions().find((s) => s.token === clean || s.refreshToken === clean);
    if (!sess) {
      return { user: null, isPlatformAdmin: false, error: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً', status: 401 };
    }
    const users = deps.getStoredUsers();
    const user =
      users.find(
        (u) =>
          u.id === sess.userId ||
          (sess.displayId && u.displayId === sess.displayId) ||
          (sess.email && u.email?.toLowerCase() === sess.email.toLowerCase())
      ) || deps.resolveUserRecordByAnyId(sess.userId);

    if (!user) {
      return { user: null, isPlatformAdmin: false, error: 'الحساب غير موجود', status: 401 };
    }
    if (user.isBanned) {
      return { user: null, isPlatformAdmin: false, error: 'هذا الحساب محظور', status: 403 };
    }
    if (user.isFrozen && user.freezeExpiresAt && new Date(user.freezeExpiresAt).getTime() > Date.now()) {
      return { user: null, isPlatformAdmin: false, error: 'الحساب مجمّد مؤقتاً', status: 403 };
    }
    const adminEmails = deps.getAdminEmails();
    const isPlatformAdmin = Boolean(sess.isAdmin || user.isAdmin || (user.email && adminEmails.includes(user.email.toLowerCase())));
    return { user, isPlatformAdmin };
  }

  function extractAuthFromReq(req: Request) {
    const authHeader = String(req.headers['authorization'] || '').trim();
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    return authenticateToken(bearer);
  }

  function requireAuth(req: Request, res: Response): { user: any; isPlatformAdmin: boolean } | null {
    const auth = extractAuthFromReq(req);
    if (!auth.user) {
      res.status(auth.status || 401).json({ success: false, message: auth.error || 'غير مصرح' });
      return null;
    }
    return { user: auth.user, isPlatformAdmin: auth.isPlatformAdmin };
  }

  function findRoomByCodeOrId(codeOrId: string): StoredRoomRecord | undefined {
    const clean = String(codeOrId || '').trim();
    if (!clean) return undefined;
    const store = loadStore();
    return store.rooms.find(
      (r) => r.id === clean || r.code.toUpperCase() === clean.toUpperCase()
    );
  }

  function getUserRoomRoleAndPerms(
    room: StoredRoomRecord,
    userId: string,
    isPlatformAdmin = false
  ): { role: RoomRole; permissions: RoomModPermissions } {
    if (room.ownerId === userId) {
      return { role: 'owner', permissions: getEffectivePermissions('owner') };
    }
    const store = loadStore();
    const mod = store.moderators.find((m) => m.roomId === room.id && m.userId === userId);
    if (mod) {
      return {
        role: mod.role,
        permissions: getEffectivePermissions(mod.role, mod.permissions),
      };
    }
    if (isPlatformAdmin) {
      return { role: 'head_admin', permissions: getEffectivePermissions('head_admin') };
    }
    return { role: 'member', permissions: getEffectivePermissions('member') };
  }

  function getActiveBan(roomId: string, userId: string): StoredBanRow | null {
    const store = loadStore();
    const now = Date.now();
    const idx = store.bans.findIndex((b) => b.roomId === roomId && b.userId === userId);
    if (idx === -1) return null;
    const b = store.bans[idx];
    if (b.expiresAt && new Date(b.expiresAt).getTime() <= now) {
      store.bans.splice(idx, 1);
      saveStore();
      const pool = deps.getNeonPool();
      if (pool) pool.query('DELETE FROM room_bans WHERE id = $1', [b.id]).catch(() => {});
      return null;
    }
    return b;
  }

  function getFriendIdSet(userId?: string): Set<string> {
    const set = new Set<string>();
    if (!userId) return set;
    try {
      const fData = deps.getStoredFriendsData();
      const userObj = deps.resolveUserRecordByAnyId(userId);
      const myAliases = new Set([userId, userObj?.id, userObj?.displayId].filter(Boolean));
      for (const f of fData.friends || []) {
        if (myAliases.has(f.userId) && f.friendId) {
          const target = deps.resolveUserRecordByAnyId(f.friendId);
          set.add(f.friendId);
          if (target?.id) set.add(target.id);
        } else if (myAliases.has(f.friendId) && f.userId) {
          const target = deps.resolveUserRecordByAnyId(f.userId);
          set.add(f.userId);
          if (target?.id) set.add(target.id);
        }
      }
    } catch {}
    return set;
  }

  function buildRoomSeatsSnapshot(room: StoredRoomRecord): RoomSeatInfo[] {
    const store = loadStore();
    const rt = getLiveRoom(room.id);
    const seats: RoomSeatInfo[] = [];
    for (let num = 1; num <= ROOM_MAX_SEATS; num++) {
      let row = store.seats.find((s) => s.roomId === room.id && s.seatNumber === num);
      if (!row) {
        row = {
          roomId: room.id,
          seatNumber: num,
          userId: null,
          isLocked: false,
          isMutedBySelf: true,
          isMutedByMod: false,
          occupiedAt: null,
        };
        store.seats.push(row);
      }
      if (row.userId) {
        const occ = rt.occupants.get(row.userId);
        const u = resolveUserBasic(row.userId);
        const { role } = getUserRoomRoleAndPerms(room, row.userId, false);
        seats.push({
          seatNumber: num,
          userId: row.userId,
          displayId: u.displayId || null,
          name: u.name,
          avatar: u.avatar || null,
          isVerified: u.isVerified,
          equippedFrameId: u.equippedFrameId || null,
          role,
          isLocked: row.isLocked,
          isMutedBySelf: row.isMutedBySelf,
          isMutedByMod: row.isMutedByMod,
          isSpeaking: Boolean(occ?.isSpeaking && !row.isMutedBySelf && !row.isMutedByMod && !room.isRoomMuted),
          reconnecting: Boolean(occ?.reconnecting),
          occupiedAt: row.occupiedAt,
        });
      } else {
        seats.push({
          seatNumber: num,
          userId: null,
          isLocked: row.isLocked,
          isMutedBySelf: true,
          isMutedByMod: false,
          isSpeaking: false,
          occupiedAt: null,
        });
      }
    }
    return seats;
  }

  function buildOccupantsSnapshot(room: StoredRoomRecord): RoomOccupantInfo[] {
    const rt = getLiveRoom(room.id);
    const store = loadStore();
    const list: RoomOccupantInfo[] = [];
    for (const [uid, occ] of rt.occupants.entries()) {
      const u = resolveUserBasic(uid);
      const seat = store.seats.find((s) => s.roomId === room.id && s.userId === uid);
      const { role } = getUserRoomRoleAndPerms(room, uid, Boolean(u.isAdmin));
      const isMicOpen = Boolean(seat && !seat.isMutedBySelf && !seat.isMutedByMod && !room.isRoomMuted);
      list.push({
        userId: uid,
        displayId: u.displayId,
        name: u.name,
        avatar: u.avatar,
        isVerified: u.isVerified,
        equippedFrameId: u.equippedFrameId || null,
        role,
        seatNumber: seat ? seat.seatNumber : null,
        isMicOpen,
        isMutedByMod: Boolean(seat?.isMutedByMod),
        isSpeaking: Boolean(occ.isSpeaking && isMicOpen),
        reconnecting: occ.reconnecting,
        joinedAt: occ.joinedAt,
      });
    }
    // Sort: owner first, then seated users, then listeners
    return list.sort((a, b) => {
      if (a.role === 'owner' && b.role !== 'owner') return -1;
      if (b.role === 'owner' && a.role !== 'owner') return 1;
      if (a.seatNumber && !b.seatNumber) return -1;
      if (!a.seatNumber && b.seatNumber) return 1;
      return (a.seatNumber || 99) - (b.seatNumber || 99);
    });
  }

  function buildRoomSummary(
    room: StoredRoomRecord,
    viewerId?: string,
    friendIds?: Set<string>
  ): RoomSummary {
    const store = loadStore();
    const rt = liveRooms.get(room.id);
    const occupantsCount = rt ? rt.occupants.size : 0;
    const occupiedSeatsCount = store.seats.filter((s) => s.roomId === room.id && Boolean(s.userId)).length;
    const owner = resolveUserBasic(room.ownerId);
    const friendsSet = friendIds || getFriendIdSet(viewerId);
    let friendsInsideCount = 0;
    if (rt && friendsSet.size > 0) {
      for (const uid of rt.occupants.keys()) {
        if (friendsSet.has(uid)) friendsInsideCount++;
      }
    }
    const isFavorite = viewerId
      ? store.favorites.some((f) => f.roomId === room.id && f.userId === viewerId)
      : false;

    return {
      id: room.id,
      code: room.code,
      name: room.name,
      description: room.description,
      category: room.category,
      coverUrl: room.coverUrl,
      ownerId: room.ownerId,
      ownerDisplayId: owner.displayId,
      ownerName: owner.name,
      ownerAvatar: owner.avatar,
      ownerIsVerified: owner.isVerified,
      ownerFrameId: owner.equippedFrameId || null,
      isPublic: room.isPublic,
      isLocked: room.isLocked,
      isFeatured: room.isFeatured,
      isHidden: Boolean(room.isHidden),
      isFrozen: Boolean(room.isFrozen),
      freezeReason: room.freezeReason || null,
      frozenAt: room.frozenAt || null,
      isRoomMuted: room.isRoomMuted,
      occupantsCount,
      occupiedSeatsCount,
      maxSeats: ROOM_MAX_SEATS,
      isActive: occupantsCount > 0 || occupiedSeatsCount > 0,
      friendsInsideCount,
      isFavorite,
      isOwnedByMe: Boolean(viewerId && room.ownerId === viewerId),
      totalGiftsCoins: room.totalGiftsCoins || 0,
      createdAt: room.createdAt,
      lastActivityAt: room.lastActivityAt,
    };
  }

  function buildRoomDetail(room: StoredRoomRecord, viewerId: string, isPlatformAdmin = false): RoomDetail {
    const summary = buildRoomSummary(room, viewerId);
    const store = loadStore();
    const { role, permissions } = getUserRoomRoleAndPerms(room, viewerId, isPlatformAdmin);
    const pinnedMessage = room.pinnedMessageId
      ? store.messages.find((m) => m.id === room.pinnedMessageId && m.roomId === room.id && !m.isDeleted) || null
      : null;
    const viewerSeat = store.seats.find((s) => s.roomId === room.id && s.userId === viewerId);

    return {
      ...summary,
      chatEnabled: room.chatEnabled,
      chatPaused: room.chatPaused,
      micRequestsEnabled: room.micRequestsEnabled,
      queueEnabled: room.queueEnabled,
      invitesEnabled: room.invitesEnabled,
      gamesPermission: room.gamesPermission,
      musicPermission: room.musicPermission,
      notificationsEnabled: room.notificationsEnabled,
      pinnedMessageId: room.pinnedMessageId,
      pinnedMessage,
      myRole: role,
      myPermissions: permissions,
      isMutedByMod: Boolean(viewerSeat?.isMutedByMod),
    };
  }

  // Persistence helpers for rooms entities
  async function persistRoomToNeon(room: StoredRoomRecord) {
    const pool = deps.getNeonPool();
    if (!pool) return;
    await pool
      .query(
        `INSERT INTO rooms (
          id, code, name, description, category, cover_key, cover_url, owner_id,
          is_public, is_locked, pin_hash, pin_encrypted, is_featured, is_hidden, is_frozen,
          freeze_reason, frozen_at, is_room_muted,
          chat_enabled, chat_paused, mic_requests_enabled, queue_enabled, invites_enabled,
          games_permission, music_permission, notifications_enabled, active_music_state,
          pinned_message_id, total_gifts_coins, created_at, updated_at, last_activity_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18,
          $19, $20, $21, $22, $23,
          $24, $25, $26, $27::jsonb,
          $28, $29, $30, $31, $32
        ) ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          category = EXCLUDED.category,
          cover_key = EXCLUDED.cover_key,
          cover_url = EXCLUDED.cover_url,
          owner_id = EXCLUDED.owner_id,
          is_public = EXCLUDED.is_public,
          is_locked = EXCLUDED.is_locked,
          pin_hash = EXCLUDED.pin_hash,
          pin_encrypted = EXCLUDED.pin_encrypted,
          is_featured = EXCLUDED.is_featured,
          is_hidden = EXCLUDED.is_hidden,
          is_frozen = EXCLUDED.is_frozen,
          freeze_reason = EXCLUDED.freeze_reason,
          frozen_at = EXCLUDED.frozen_at,
          is_room_muted = EXCLUDED.is_room_muted,
          chat_enabled = EXCLUDED.chat_enabled,
          chat_paused = EXCLUDED.chat_paused,
          mic_requests_enabled = EXCLUDED.mic_requests_enabled,
          queue_enabled = EXCLUDED.queue_enabled,
          invites_enabled = EXCLUDED.invites_enabled,
          games_permission = EXCLUDED.games_permission,
          music_permission = EXCLUDED.music_permission,
          notifications_enabled = EXCLUDED.notifications_enabled,
          active_music_state = EXCLUDED.active_music_state,
          pinned_message_id = EXCLUDED.pinned_message_id,
          total_gifts_coins = EXCLUDED.total_gifts_coins,
          updated_at = EXCLUDED.updated_at,
          last_activity_at = EXCLUDED.last_activity_at`,
        [
          room.id,
          room.code,
          room.name,
          room.description,
          room.category,
          room.coverKey,
          room.coverUrl,
          room.ownerId,
          room.isPublic,
          room.isLocked,
          room.pinHash,
          room.pinEncrypted,
          room.isFeatured,
          Boolean(room.isHidden),
          Boolean(room.isFrozen),
          room.freezeReason || null,
          room.frozenAt || null,
          room.isRoomMuted,
          room.chatEnabled,
          room.chatPaused,
          room.micRequestsEnabled,
          room.queueEnabled,
          room.invitesEnabled,
          room.gamesPermission,
          room.musicPermission,
          room.notificationsEnabled,
          JSON.stringify(room.musicState || DEFAULT_MUSIC_STATE),
          room.pinnedMessageId,
          room.totalGiftsCoins || 0,
          room.createdAt,
          room.updatedAt,
          room.lastActivityAt,
        ]
      )
      .catch(() => {});
  }

  async function persistSeatToNeon(seat: StoredSeatRow) {
    const pool = deps.getNeonPool();
    if (!pool) return;
    await pool
      .query(
        `INSERT INTO room_seats (id, room_id, seat_number, user_id, is_locked, is_muted_by_self, is_muted_by_mod, occupied_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (room_id, seat_number) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          is_locked = EXCLUDED.is_locked,
          is_muted_by_self = EXCLUDED.is_muted_by_self,
          is_muted_by_mod = EXCLUDED.is_muted_by_mod,
          occupied_at = EXCLUDED.occupied_at`,
        [
          `${seat.roomId}-seat-${seat.seatNumber}`,
          seat.roomId,
          seat.seatNumber,
          seat.userId,
          seat.isLocked,
          seat.isMutedBySelf,
          seat.isMutedByMod,
          seat.occupiedAt,
        ]
      )
      .catch(() => {});
  }

  function recordAuditLog(
    room: StoredRoomRecord,
    actor: { id: string; name?: string; role?: string },
    action: string,
    target?: { id?: string | null; name?: string | null },
    details?: string,
    metadata?: Record<string, any>
  ) {
    const entry: RoomAuditLogRecord = {
      id: `raud-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      roomId: room.id,
      actorId: actor.id,
      actorName: actor.name || resolveUserBasic(actor.id).name,
      actorRole: actor.role || 'member',
      action,
      targetUserId: target?.id || null,
      targetUserName: target?.name || null,
      details: details || null,
      metadata: metadata || null,
      createdAt: new Date().toISOString(),
    };
    const store = loadStore();
    store.auditLogs.unshift(entry);
    if (store.auditLogs.length > 5000) store.auditLogs.length = 5000;
    saveStore();
    const pool = deps.getNeonPool();
    if (pool) {
      pool
        .query(
          `INSERT INTO room_audit_logs (id, room_id, actor_id, actor_name, actor_role, action, target_user_id, target_user_name, details, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)`,
          [
            entry.id,
            entry.roomId,
            entry.actorId,
            entry.actorName,
            entry.actorRole,
            entry.action,
            entry.targetUserId,
            entry.targetUserName,
            entry.details,
            entry.metadata ? JSON.stringify(entry.metadata) : null,
            entry.createdAt,
          ]
        )
        .catch(() => {});
    }
    return entry;
  }

  // Broadcast helpers to live WebSocket room clients
  function broadcastToRoom(roomId: string, payload: any, excludeUserId?: string) {
    const msg = JSON.stringify(payload);
    for (const client of socketsById.values()) {
      if (client.roomId === roomId && (!excludeUserId || client.userId !== excludeUserId)) {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(msg);
          } catch {}
        }
      }
    }
  }

  function sendToUserInRoom(roomId: string, userId: string, payload: any) {
    const msg = JSON.stringify(payload);
    for (const client of socketsById.values()) {
      if (client.roomId === roomId && client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(msg);
        } catch {}
      }
    }
  }

  function pushRoomMessage(
    room: StoredRoomRecord,
    params: {
      senderId?: string | null;
      senderName?: string | null;
      senderAvatar?: string | null;
      senderRole?: RoomRole | 'system' | null;
      senderIsVerified?: boolean;
      senderFrameId?: string | null;
      msgType: 'text' | 'system' | 'gift' | 'announcement';
      text: string;
      metadata?: Record<string, any> | null;
    }
  ): RoomMessageRecord {
    const now = new Date().toISOString();
    const record: RoomMessageRecord = {
      id: `rmsg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      roomId: room.id,
      senderId: params.senderId || null,
      senderName: params.senderName || null,
      senderAvatar: params.senderAvatar || null,
      senderRole: params.senderRole || null,
      senderIsVerified: Boolean(params.senderIsVerified),
      senderFrameId: params.senderFrameId || null,
      msgType: params.msgType,
      text: params.text,
      metadata: params.metadata || null,
      isPinned: false,
      isDeleted: false,
      createdAt: now,
    };

    const store = loadStore();
    store.messages.push(record);
    // Keep max 400 messages per room in local store
    const roomMsgs = store.messages.filter((m) => m.roomId === room.id);
    if (roomMsgs.length > 400) {
      const oldestId = roomMsgs[0].id;
      const idx = store.messages.findIndex((m) => m.id === oldestId);
      if (idx >= 0) store.messages.splice(idx, 1);
    }
    room.lastActivityAt = now;
    room.updatedAt = now;
    saveStore();

    const pool = deps.getNeonPool();
    if (pool) {
      pool
        .query(
          `INSERT INTO room_messages (id, room_id, sender_id, sender_name, sender_avatar, sender_role, sender_is_verified, sender_frame_id, msg_type, text, metadata, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12)`,
          [
            record.id,
            record.roomId,
            record.senderId,
            record.senderName,
            record.senderAvatar,
            record.senderRole,
            record.senderIsVerified,
            record.senderFrameId,
            record.msgType,
            record.text,
            record.metadata ? JSON.stringify(record.metadata) : null,
            record.createdAt,
          ]
        )
        .catch(() => {});
    }

    broadcastToRoom(room.id, { type: 'chat:message', message: record });
    return record;
  }

  function broadcastSeatsAndOccupants(room: StoredRoomRecord) {
    const rt = getLiveRoom(room.id);
    broadcastToRoom(room.id, {
      type: 'seats:update',
      seats: buildRoomSeatsSnapshot(room),
      occupants: buildOccupantsSnapshot(room),
      queue: rt.queue,
      isRoomMuted: room.isRoomMuted,
    });
  }

  function broadcastRoomSettings(room: StoredRoomRecord) {
    for (const client of socketsById.values()) {
      if (client.roomId === room.id && client.ws.readyState === WebSocket.OPEN) {
        const u = resolveUserBasic(client.userId);
        try {
          client.ws.send(
            JSON.stringify({
              type: 'room:state',
              room: buildRoomDetail(room, client.userId, Boolean(u.isAdmin)),
            })
          );
        } catch {}
      }
    }
  }

  function vacateUserSeat(room: StoredRoomRecord, userId: string, silent = false): number | null {
    const store = loadStore();
    const seat = store.seats.find((s) => s.roomId === room.id && s.userId === userId);
    if (!seat) return null;
    const prevSeatNum = seat.seatNumber;
    seat.userId = null;
    seat.isMutedBySelf = true;
    seat.occupiedAt = null;
    room.lastActivityAt = new Date().toISOString();
    saveStore();
    persistSeatToNeon(seat);

    const occ = getLiveRoom(room.id).occupants.get(userId);
    if (occ) {
      occ.isSpeaking = false;
      occ.reconnecting = false;
    }

    if (!silent) {
      const u = resolveUserBasic(userId);
      pushRoomMessage(room, {
        senderId: userId,
        senderName: u.name,
        senderRole: 'system',
        msgType: 'system',
        text: `نزل ${u.name} عن المقعد #${prevSeatNum}`,
        metadata: { event: 'leave_seat', userId, seatNumber: prevSeatNum },
      });
    }
    broadcastSeatsAndOccupants(room);
    return prevSeatNum;
  }

  function evictUserFromRoom(room: StoredRoomRecord, targetUserId: string, reasonText: string, banType: 'kick' | 'ban' = 'kick', expiresAt?: string | null) {
    const rt = getLiveRoom(room.id);
    const timer = rt.disconnectTimers.get(targetUserId);
    if (timer) {
      clearTimeout(timer);
      rt.disconnectTimers.delete(targetUserId);
    }
    vacateUserSeat(room, targetUserId, true);
    rt.queue = rt.queue.filter((q) => q.userId !== targetUserId);
    rt.occupants.delete(targetUserId);

    // Send kick notice then terminate WS connections for targetUserId in this room
    for (const [sid, client] of Array.from(socketsById.entries())) {
      if (client.roomId === room.id && client.userId === targetUserId) {
        try {
          client.ws.send(
            JSON.stringify({
              type: 'room:kicked',
              banType,
              reason: reasonText,
              expiresAt: expiresAt || null,
            })
          );
          client.ws.close(4003, reasonText);
        } catch {}
        socketsById.delete(sid);
      }
    }
    broadcastSeatsAndOccupants(room);
  }

  function rejectIfRoomFrozen(room: StoredRoomRecord, res: Response): boolean {
    if (!room.isFrozen) return false;
    res.status(403).json({
      success: false,
      frozen: true,
      freezeReason: room.freezeReason || null,
      frozenAt: room.frozenAt || null,
      message: room.freezeReason
        ? `هذه الغرفة مجمّدة إدارياً: ${room.freezeReason}`
        : 'هذه الغرفة مجمّدة إدارياً من قبل إدارة المنصة ولا يمكن دخولها حالياً',
    });
    return true;
  }

  function freezeRoomLiveState(room: StoredRoomRecord) {
    const freezeMessage = room.freezeReason
      ? `تم تجميد هذه الغرفة إدارياً: ${room.freezeReason}`
      : 'تم تجميد هذه الغرفة إدارياً من قبل إدارة المنصة';
    broadcastToRoom(room.id, {
      type: 'room:frozen',
      reason: room.freezeReason || null,
      frozenAt: room.frozenAt || null,
      message: freezeMessage,
    });
    for (const [sid, client] of Array.from(socketsById.entries())) {
      if (client.roomId === room.id) {
        try {
          client.ws.close(4011, 'Room frozen');
        } catch {}
        socketsById.delete(sid);
      }
    }
    const rt = liveRooms.get(room.id);
    if (rt) {
      for (const t of rt.disconnectTimers.values()) clearTimeout(t);
      rt.disconnectTimers.clear();
      if (rt.game.roundTimer) {
        clearTimeout(rt.game.roundTimer);
        rt.game.roundTimer = null;
      }
      rt.game.state = createIdleGameState();
      rt.queue = [];
      rt.occupants.clear();
    }
    if (room.musicState?.isPlaying) {
      room.musicState = { ...room.musicState, isPlaying: false };
    }
    const store = loadStore();
    for (const s of store.seats) {
      if (s.roomId === room.id && s.userId) {
        s.userId = null;
        s.isMutedBySelf = true;
        s.occupiedAt = null;
        persistSeatToNeon(s);
      }
    }
    saveStore();
  }

  async function permanentlyDeleteRoom(room: StoredRoomRecord) {
    broadcastToRoom(room.id, { type: 'room:deleted', message: 'تم حذف الغرفة نهائياً' });
    for (const [sid, client] of Array.from(socketsById.entries())) {
      if (client.roomId === room.id) {
        try {
          client.ws.close(4010, 'Room deleted');
        } catch {}
        socketsById.delete(sid);
      }
    }
    const rt = liveRooms.get(room.id);
    if (rt) {
      for (const t of rt.disconnectTimers.values()) clearTimeout(t);
      if (rt.game.roundTimer) clearTimeout(rt.game.roundTimer);
      liveRooms.delete(room.id);
    }

    const coverKeyToDelete = room.coverKey;
    const store = loadStore();
    store.rooms = store.rooms.filter((r) => r.id !== room.id);
    store.seats = store.seats.filter((s) => s.roomId !== room.id);
    store.moderators = store.moderators.filter((m) => m.roomId !== room.id);
    store.bans = store.bans.filter((b) => b.roomId !== room.id);
    store.messages = store.messages.filter((m) => m.roomId !== room.id);
    store.favorites = store.favorites.filter((f) => f.roomId !== room.id);
    store.events = store.events.filter((e) => e.roomId !== room.id);
    store.auditLogs = store.auditLogs.filter((l) => l.roomId !== room.id);
    store.invites = store.invites.filter((i) => i.roomId !== room.id);
    saveStore();

    const pool = deps.getNeonPool();
    if (pool) {
      await pool.query('DELETE FROM rooms WHERE id = $1', [room.id]).catch(() => {});
    }
    if (coverKeyToDelete) {
      await deleteRoomCoverObject(coverKeyToDelete).catch(() => {});
    }
  }

  // Mini-game round management
  function startRoundForRoom(room: StoredRoomRecord, rt: LiveRoomRuntime) {
    const gameRt = rt.game;
    if (gameRt.roundTimer) {
      clearTimeout(gameRt.roundTimer);
      gameRt.roundTimer = null;
    }
    const idx = gameRt.state.roundNumber;
    if (idx >= gameRt.questions.length || !gameRt.state.gameType) {
      // Finish game
      const sorted = Array.from(gameRt.scores.entries())
        .map(([uid, score]) => {
          const u = resolveUserBasic(uid);
          return { userId: uid, name: u.name, avatar: u.avatar, score };
        })
        .sort((a, b) => b.score - a.score);
      gameRt.state = {
        ...gameRt.state,
        status: 'finished',
        question: null,
        winnerName: sorted[0]?.name || null,
        leaderboard: sorted,
      };
      broadcastToRoom(room.id, { type: 'game:state', game: gameRt.state });
      pushRoomMessage(room, {
        senderRole: 'system',
        msgType: 'system',
        text: sorted[0]
          ? `🏆 انتهت اللعبة! الفائز هو ${sorted[0].name} برصيد ${sorted[0].score} نقطة!`
          : 'انتهت اللعبة داخل الغرفة!',
        metadata: { event: 'game_finished' },
      });
      return;
    }

    const q = gameRt.questions[idx];
    const now = Date.now();
    const durationSec = gameRt.state.gameType === 'speed_challenge' ? 12 : 16;
    gameRt.state = {
      ...gameRt.state,
      status: 'active',
      roundNumber: idx + 1,
      question: {
        index: idx + 1,
        promptAr: q.promptAr,
        promptEn: q.promptEn,
        optionsAr: q.optionsAr,
        optionsEn: q.optionsEn,
        hintAr: q.hintAr,
        hintEn: q.hintEn,
      },
      roundStartedAtMs: now,
      roundDurationSec: durationSec,
      answeredUserIds: [],
      correctAnswerAr: undefined,
      correctAnswerEn: undefined,
    };
    broadcastToRoom(room.id, { type: 'game:state', game: gameRt.state });

    gameRt.roundTimer = setTimeout(() => {
      revealRoundResult(room, rt);
    }, durationSec * 1000);
  }

  function revealRoundResult(room: StoredRoomRecord, rt: LiveRoomRuntime) {
    const gameRt = rt.game;
    if (gameRt.roundTimer) {
      clearTimeout(gameRt.roundTimer);
      gameRt.roundTimer = null;
    }
    if (gameRt.state.status !== 'active') return;
    const q = gameRt.questions[gameRt.state.roundNumber - 1];
    const sorted = Array.from(gameRt.scores.entries())
      .map(([uid, score]) => {
        const u = resolveUserBasic(uid);
        return { userId: uid, name: u.name, avatar: u.avatar, score };
      })
      .sort((a, b) => b.score - a.score);

    gameRt.state = {
      ...gameRt.state,
      status: 'round_result',
      correctAnswerAr: q?.answerAr,
      correctAnswerEn: q?.answerEn,
      leaderboard: sorted,
    };
    broadcastToRoom(room.id, { type: 'game:state', game: gameRt.state });

    // Advance after 4 seconds
    gameRt.roundTimer = setTimeout(() => {
      startRoundForRoom(room, rt);
    }, 4000);
  }

  // Generate unique SX-XXXXXX fixed Room Code
  function generateUniqueRoomCode(): string {
    const store = loadStore();
    const existing = new Set(store.rooms.map((r) => r.code.toUpperCase()));
    for (let i = 0; i < 40; i++) {
      const code = `SX-${crypto.randomInt(100000, 999999)}`;
      if (!existing.has(code)) return code;
    }
    return `SX-${Date.now().toString().slice(-6)}`;
  }

  // =========================================================================
  // REST API ROUTES
  // =========================================================================

  // 1. Serve room cover image cleanly from S3 or local storage
  app.get('/api/rooms/cover/:roomId/:fileName', async (req: Request, res: Response) => {
    try {
      const roomId = String(req.params.roomId || '').trim();
      const fileName = String(req.params.fileName || '').trim();
      const key = `rooms/${roomId}/${fileName}`;
      if (!isValidRoomCoverKey(key)) {
        return res.status(400).json({ success: false, message: 'مسار الصورة غير صالح' });
      }
      const data = await readRoomCoverFromStorage(key);
      if (!data) {
        return res.status(404).json({ success: false, message: 'الصورة غير موجودة' });
      }
      res.setHeader('Content-Type', data.contentType || 'image/webp');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send(data.buffer);
    } catch {
      return res.status(500).json({ success: false, message: 'تعذر تحميل صورة الغرفة' });
    }
  });

  // 2. ICE/WebRTC Config (STUN + optional TURN from env vars)
  app.get('/api/rooms/rtc-config', (_req: Request, res: Response) => {
    const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ];
    const turnUrl = (process.env.ICE_TURN_URL || '').trim();
    const turnUser = (process.env.ICE_TURN_USERNAME || '').trim();
    const turnPass = (process.env.ICE_TURN_CREDENTIAL || '').trim();
    if (turnUrl) {
      iceServers.push({
        urls: turnUrl,
        ...(turnUser ? { username: turnUser } : {}),
        ...(turnPass ? { credential: turnPass } : {}),
      });
    }
    return res.json({
      success: true,
      iceServers,
      turnConfigured: Boolean(turnUrl),
    });
  });

  // 3. List Rooms + Organized Sections + Direct Search
  app.get('/api/rooms', async (req: Request, res: Response) => {
    await hydrateFromNeonIfNeeded().catch(() => {});
    const auth = extractAuthFromReq(req);
    const viewerId = auth.user?.id as string | undefined;
    const isPlatformAdmin = auth.isPlatformAdmin;

    const q = String(req.query.q || '').trim().toLowerCase();
    const codeQuery = String(req.query.code || '').trim().toUpperCase();
    const sortBy = String(req.query.sort || 'activity').trim(); // 'activity' | 'users' | 'newest'
    const category = String(req.query.category || 'all').trim();

    const store = loadStore();
    const friendIds = getFriendIdSet(viewerId);

    // Filter visible rooms (completely exclude hidden rooms from user-facing UI)
    let filtered = store.rooms.filter((room) => {
      if (room.isHidden) return false;
      const canSeePrivate =
        room.isPublic ||
        isPlatformAdmin ||
        (viewerId && room.ownerId === viewerId) ||
        (viewerId && store.moderators.some((m) => m.roomId === room.id && m.userId === viewerId)) ||
        (codeQuery && room.code.toUpperCase() === codeQuery) ||
        (q && room.code.toLowerCase() === q);
      if (!canSeePrivate) return false;
      if (category !== 'all' && room.category !== category) return false;
      if (codeQuery && room.code.toUpperCase() !== codeQuery) return false;
      if (q) {
        const owner = resolveUserBasic(room.ownerId);
        const matches =
          room.name.toLowerCase().includes(q) ||
          room.code.toLowerCase().includes(q) ||
          (room.description || '').toLowerCase().includes(q) ||
          owner.name.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

    const summaries = filtered.map((r) => buildRoomSummary(r, viewerId, friendIds));

    // Smart Sort
    summaries.sort((a, b) => {
      if (sortBy === 'users') {
        if (b.occupantsCount !== a.occupantsCount) return b.occupantsCount - a.occupantsCount;
        return b.occupiedSeatsCount - a.occupiedSeatsCount;
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // Smart activity score: active users + seats + friends + featured + recent activity
      const score = (x: RoomSummary) =>
        x.occupantsCount * 100 +
        x.occupiedSeatsCount * 25 +
        x.friendsInsideCount * 40 +
        (x.isFeatured ? 60 : 0) +
        new Date(x.lastActivityAt).getTime() / 1e9;
      return score(b) - score(a);
    });

    const nowMs = Date.now();
    const newThresholdMs = 48 * 60 * 60 * 1000;

    const sections = {
      active: summaries.filter((r) => r.isActive),
      friendsInside: summaries.filter((r) => r.friendsInsideCount > 0),
      featured: summaries.filter((r) => r.isFeatured),
      newRooms: summaries.filter((r) => nowMs - new Date(r.createdAt).getTime() <= newThresholdMs),
      favorites: summaries.filter((r) => r.isFavorite),
      owned: summaries.filter((r) => r.isOwnedByMe),
    };

    return res.json({
      success: true,
      createCostCoins: ROOM_CREATE_COST_COINS,
      rooms: summaries,
      sections,
    });
  });

  // 4. Create Room (25,000 Coins atomic & idempotent)
  app.post('/api/rooms', handleCoverUpload, async (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { user, isPlatformAdmin } = auth;

    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim().slice(0, 300);
    const categoryRaw = String(req.body?.category || 'chat').trim() as RoomCategory;
    const allowedCategories: RoomCategory[] = ['chat', 'music', 'games', 'chill', 'culture', 'vip'];
    const category: RoomCategory = allowedCategories.includes(categoryRaw) ? categoryRaw : 'chat';
    const isPublic = req.body?.isPublic !== 'false' && req.body?.isPublic !== false;
    const idempotencyKey = String(req.body?.idempotencyKey || req.headers['idempotency-key'] || '').trim().slice(0, 128);

    if (name.length < 2 || name.length > 60) {
      return res.status(400).json({ success: false, message: 'اسم الغرفة يجب أن يكون بين حرفين و60 حرفاً' });
    }
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'يرجى اختيار صورة للغرفة' });
    }

    // Validate & process cover image BEFORE deducting any balance
    let processedCover: { buffer: Buffer; contentType: 'image/webp' };
    try {
      processedCover = await validateAndProcessRoomCoverBuffer(req.file.buffer);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err?.message || 'صورة الغرفة غير صالحة' });
    }

    return withCoinLock(async () => {
      const store = loadStore();
      const pool = deps.getNeonPool();

      // Check idempotency key (local + Neon)
      if (idempotencyKey) {
        const existingLocal = store.idempotency[idempotencyKey];
        if (existingLocal && existingLocal.userId === user.id && existingLocal.action === 'create_room') {
          return res.json(existingLocal.response);
        }
        if (pool) {
          try {
            const idemRes = await pool.query(
              'SELECT user_id, action, response_json FROM room_idempotency_keys WHERE idempotency_key = $1 LIMIT 1',
              [idempotencyKey]
            );
            if (idemRes.rows?.[0] && idemRes.rows[0].user_id === user.id) {
              return res.json(idemRes.rows[0].response_json);
            }
          } catch {}
        }
      }

      const roomId = `room-${crypto.randomUUID()}`;
      const roomCode = generateUniqueRoomCode();
      let uploadedCoverKey: string | null = null;

      try {
        const uploaded = await uploadRoomCoverObject(roomId, processedCover.buffer);
        uploadedCoverKey = uploaded.key;
      } catch (uploadErr: any) {
        return res.status(500).json({ success: false, message: uploadErr?.message || 'فشل رفع صورة الغرفة' });
      }

      const filePart = path.basename(uploadedCoverKey);
      const coverUrl = `/api/rooms/cover/${encodeURIComponent(roomId)}/${encodeURIComponent(filePart)}`;
      const now = new Date().toISOString();

      const newRoom: StoredRoomRecord = {
        id: roomId,
        code: roomCode,
        name,
        description,
        category,
        coverKey: uploadedCoverKey,
        coverUrl,
        ownerId: user.id,
        isPublic,
        isLocked: !isPublic,
        pinHash: null,
        pinEncrypted: null,
        isFeatured: false,
        isHidden: false,
        isFrozen: false,
        freezeReason: null,
        frozenAt: null,
        isRoomMuted: false,
        chatEnabled: true,
        chatPaused: false,
        micRequestsEnabled: true,
        queueEnabled: true,
        invitesEnabled: true,
        gamesPermission: 'moderators',
        musicPermission: 'moderators',
        notificationsEnabled: true,
        musicState: { ...DEFAULT_MUSIC_STATE },
        pinnedMessageId: null,
        totalGiftsCoins: 0,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };

      const initialSeats: StoredSeatRow[] = Array.from({ length: ROOM_MAX_SEATS }, (_, i) => ({
        roomId,
        seatNumber: i + 1,
        userId: null,
        isLocked: false,
        isMutedBySelf: true,
        isMutedByMod: false,
        occupiedAt: null,
      }));

      let updatedCoinsBalance = 0;

      // Atomic deduction + insert in Neon PostgreSQL if active
      if (pool) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const balRes = await client.query(
            'SELECT coins_balance FROM profiles WHERE id = $1 FOR UPDATE',
            [user.id]
          );
          const neonCoins = Number(balRes.rows?.[0]?.coins_balance ?? user.coinsBalance ?? 0);
          if (neonCoins < ROOM_CREATE_COST_COINS) {
            await client.query('ROLLBACK');
            client.release();
            await deleteRoomCoverObject(uploadedCoverKey).catch(() => {});
            return res.status(400).json({
              success: false,
              insufficientCoins: true,
              coinsBalance: neonCoins,
              requiredCoins: ROOM_CREATE_COST_COINS,
              message: `رصيد الكوينز غير كافٍ (${neonCoins.toLocaleString()} كوينز). إنشاء الغرفة يتطلب ${ROOM_CREATE_COST_COINS.toLocaleString()} كوينز.`,
            });
          }

          const updRes = await client.query(
            'UPDATE profiles SET coins_balance = coins_balance - $1, updated_at = NOW() WHERE id = $2 AND coins_balance >= $1 RETURNING coins_balance',
            [ROOM_CREATE_COST_COINS, user.id]
          );
          if (!updRes.rows?.[0]) {
            await client.query('ROLLBACK');
            client.release();
            await deleteRoomCoverObject(uploadedCoverKey).catch(() => {});
            return res.status(400).json({
              success: false,
              insufficientCoins: true,
              message: 'رصيد الكوينز غير كافٍ لإتمام إنشاء الغرفة',
            });
          }
          updatedCoinsBalance = Number(updRes.rows[0].coins_balance);

          await client.query(
            `INSERT INTO rooms (
              id, code, name, description, category, cover_key, cover_url, owner_id,
              is_public, is_locked, active_music_state, created_at, updated_at, last_activity_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $12, $12)`,
            [
              newRoom.id,
              newRoom.code,
              newRoom.name,
              newRoom.description,
              newRoom.category,
              newRoom.coverKey,
              newRoom.coverUrl,
              newRoom.ownerId,
              newRoom.isPublic,
              newRoom.isLocked,
              JSON.stringify(newRoom.musicState),
              now,
            ]
          );

          for (const s of initialSeats) {
            await client.query(
              `INSERT INTO room_seats (id, room_id, seat_number, user_id, is_locked, is_muted_by_self, is_muted_by_mod)
               VALUES ($1, $2, $3, NULL, FALSE, TRUE, FALSE)`,
              [`${roomId}-seat-${s.seatNumber}`, roomId, s.seatNumber]
            );
          }

          const respPayload = {
            success: true,
            room: buildRoomDetail(newRoom, user.id, isPlatformAdmin),
            coinsBalance: updatedCoinsBalance,
            costDeducted: ROOM_CREATE_COST_COINS,
            message: 'تم إنشاء الغرفة الصوتية بنجاح!',
          };

          if (idempotencyKey) {
            await client.query(
              `INSERT INTO room_idempotency_keys (id, idempotency_key, user_id, action, response_json, created_at)
               VALUES ($1, $2, $3, 'create_room', $4::jsonb, NOW()) ON CONFLICT (idempotency_key) DO NOTHING`,
              [crypto.randomUUID(), idempotencyKey, user.id, JSON.stringify(respPayload)]
            );
          }

          await client.query('COMMIT');
          client.release();

          // Sync JSON users & store
          const users = deps.getStoredUsers();
          const uIdx = users.findIndex((u) => u.id === user.id);
          if (uIdx >= 0) {
            users[uIdx].coinsBalance = updatedCoinsBalance;
            users[uIdx].updatedAt = now;
            deps.saveStoredUsers(users);
          }
        } catch (dbErr: any) {
          await client.query('ROLLBACK').catch(() => {});
          client.release();
          await deleteRoomCoverObject(uploadedCoverKey).catch(() => {});
          return res.status(500).json({ success: false, message: dbErr?.message || 'فشل حفظ الغرفة في قاعدة البيانات' });
        }
      } else {
        // JSON store transaction fallback
        const users = deps.getStoredUsers();
        const uIdx = users.findIndex((u) => u.id === user.id);
        const currentCoins = Number(uIdx >= 0 ? users[uIdx].coinsBalance ?? 0 : user.coinsBalance ?? 0);
        if (currentCoins < ROOM_CREATE_COST_COINS) {
          await deleteRoomCoverObject(uploadedCoverKey).catch(() => {});
          return res.status(400).json({
            success: false,
            insufficientCoins: true,
            coinsBalance: currentCoins,
            requiredCoins: ROOM_CREATE_COST_COINS,
            message: `رصيد الكوينز غير كافٍ (${currentCoins.toLocaleString()} كوينز). إنشاء الغرفة يتطلب ${ROOM_CREATE_COST_COINS.toLocaleString()} كوينز.`,
          });
        }
        updatedCoinsBalance = currentCoins - ROOM_CREATE_COST_COINS;
        if (uIdx >= 0) {
          users[uIdx].coinsBalance = updatedCoinsBalance;
          users[uIdx].updatedAt = now;
          deps.saveStoredUsers(users);
        }
      }

      store.rooms.unshift(newRoom);
      store.seats.push(...initialSeats);
      saveStore();

      recordAuditLog(newRoom, { id: user.id, name: user.name, role: 'owner' }, 'create_room', undefined, `إنشاء الغرفة (${ROOM_CREATE_COST_COINS.toLocaleString()} كوينز)`);
      pushRoomMessage(newRoom, {
        senderId: user.id,
        senderName: user.name,
        senderRole: 'system',
        msgType: 'system',
        text: `🎉 تم إنشاء غرفة "${newRoom.name}" بواسطة ${user.name}! أهلاً بالجميع.`,
      });

      const finalResponse = {
        success: true,
        room: buildRoomDetail(newRoom, user.id, isPlatformAdmin),
        coinsBalance: updatedCoinsBalance,
        costDeducted: ROOM_CREATE_COST_COINS,
        message: 'تم إنشاء الغرفة الصوتية بنجاح!',
      };

      if (idempotencyKey) {
        store.idempotency[idempotencyKey] = {
          userId: user.id,
          action: 'create_room',
          response: finalResponse,
          createdAt: now,
        };
        saveStore();
      }

      // Broadcast updated balance to user's open tabs via SSE
      deps.broadcastChatMessage([user.id, user.displayId, user.email], {
        type: 'balance_update',
        currency: 'coins',
        balance: updatedCoinsBalance,
        userId: user.id,
        displayId: user.displayId,
      });

      return res.status(201).json(finalResponse);
    });
  });

  // 5. Get Single Room Details & Admission Check
  app.get('/api/rooms/:codeOrId', async (req: Request, res: Response) => {
    await hydrateFromNeonIfNeeded().catch(() => {});
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { user, isPlatformAdmin } = auth;

    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) {
      return res.status(404).json({ success: false, message: 'الغرفة غير موجودة أو تم حذفها' });
    }
    if (rejectIfRoomFrozen(room, res)) return;

    const activeBan = getActiveBan(room.id, user.id);
    if (activeBan && !isPlatformAdmin && room.ownerId !== user.id) {
      return res.status(403).json({
        success: false,
        banned: true,
        banType: activeBan.banType,
        reason: activeBan.reason,
        expiresAt: activeBan.expiresAt,
        message:
          activeBan.banType === 'kick'
            ? 'تم طردك مؤقتاً من هذه الغرفة'
            : 'أنت محظور من دخول هذه الغرفة',
      });
    }

    const { role } = getUserRoomRoleAndPerms(room, user.id, isPlatformAdmin);
    const inviteToken = String(req.query.invite || '').trim();
    const store = loadStore();
    const validInvite = inviteToken
      ? store.invites.some(
          (inv) =>
            inv.roomId === room.id &&
            inv.token === inviteToken &&
            new Date(inv.expiresAt).getTime() > Date.now() &&
            (!inv.targetUserId || inv.targetUserId === user.id)
        )
      : false;

    const rt = getLiveRoom(room.id);
    const alreadyInside = rt.occupants.has(user.id);
    const requiresPin = Boolean((room.isLocked || !room.isPublic) && role === 'member' && !isPlatformAdmin && !validInvite && !alreadyInside);

    if (requiresPin) {
      return res.json({
        success: true,
        requiresPin: true,
        hasPinConfigured: Boolean(room.pinHash),
        summary: buildRoomSummary(room, user.id),
      });
    }

    const detail = buildRoomDetail(room, user.id, isPlatformAdmin);
    const seats = buildRoomSeatsSnapshot(room);
    const occupants = buildOccupantsSnapshot(room);
    const messages = store.messages.filter((m) => m.roomId === room.id && !m.isDeleted).slice(-120);
    const events = store.events
      .filter((e) => e.roomId === room.id && e.status !== 'cancelled')
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .map((e) => ({ ...e, createdByName: resolveUserBasic(e.createdBy).name }));

    const moderators: RoomModRecord[] = store.moderators
      .filter((m) => m.roomId === room.id)
      .map((m) => {
        const u = resolveUserBasic(m.userId);
        return {
          userId: m.userId,
          displayId: u.displayId,
          name: u.name,
          avatar: u.avatar,
          isVerified: u.isVerified,
          role: m.role,
          permissions: m.permissions,
          assignedBy: m.assignedBy,
          createdAt: m.createdAt,
        };
      });

    return res.json({
      success: true,
      requiresPin: false,
      room: detail,
      seats,
      occupants,
      queue: rt.queue,
      messages,
      events,
      moderators,
      music: room.musicState || DEFAULT_MUSIC_STATE,
      game: rt.game.state,
    });
  });

  // 6. Verify Room PIN (with rate limiting)
  app.post('/api/rooms/:codeOrId/verify-pin', async (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const { user } = auth;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });
    if (rejectIfRoomFrozen(room, res)) return;

    const activeBan = getActiveBan(room.id, user.id);
    if (activeBan && room.ownerId !== user.id) {
      return res.status(403).json({ success: false, banned: true, message: 'غير مسموح لك بدخول الغرفة' });
    }

    const attemptKey = `${room.id}:${user.id}`;
    const state = pinAttempts.get(attemptKey);
    const now = Date.now();
    if (state && state.blockedUntil > now) {
      const waitSec = Math.ceil((state.blockedUntil - now) / 1000);
      return res.status(429).json({
        success: false,
        message: `تم تجاوز عدد المحاولات المسموحة. يرجى الانتظار ${waitSec} ثانية`,
      });
    }

    const pin = String(req.body?.pin || '').trim();
    if (!pin || pin.length > 32 || !room.pinHash || !verifyRoomPin(pin, room.pinHash)) {
      const nextCount = (state?.count || 0) + 1;
      pinAttempts.set(attemptKey, {
        count: nextCount,
        blockedUntil: nextCount >= 5 ? now + 5 * 60 * 1000 : 0,
      });
      return res.status(403).json({ success: false, message: 'الرمز السري للغرفة غير صحيح' });
    }

    pinAttempts.delete(attemptKey);
    // Issue short-lived entry invite token bound to this user so HTTP+WS admission succeeds seamlessly
    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(now + 10 * 60 * 1000).toISOString();
    const store = loadStore();
    store.invites.push({
      id: crypto.randomUUID(),
      roomId: room.id,
      token,
      createdBy: user.id,
      targetUserId: user.id,
      expiresAt,
      createdAt: new Date(now).toISOString(),
    });
    saveStore();
    return res.json({ success: true, entryToken: token });
  });

  // 7. Get Room PIN (Strictly Owner / Head Admin / Permitted Mod / Platform Admin)
  app.get('/api/rooms/:codeOrId/pin', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });

    const { role, permissions } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
    if (role !== 'owner' && role !== 'head_admin' && !permissions.manageLockPin && !auth.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية عرض الرمز السري للغرفة' });
    }
    return res.json({
      success: true,
      hasPin: Boolean(room.pinHash),
      pin: decryptPin(room.pinEncrypted),
    });
  });

  // 8. Lock / Unlock & PIN management
  app.post('/api/rooms/:codeOrId/lock', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });
    if (rejectIfRoomFrozen(room, res)) return;

    const { role, permissions } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
    if (role !== 'owner' && role !== 'head_admin' && !permissions.manageLockPin && !auth.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية قفل الغرفة أو تعديل الرمز السري' });
    }

    const lock = Boolean(req.body?.isLocked);
    const mode = String(req.body?.pinMode || 'keep'); // 'auto' | 'custom' | 'remove' | 'keep'
    const customPin = String(req.body?.pin || '').trim();

    let generatedPin: string | null = decryptPin(room.pinEncrypted);

    if (mode === 'auto') {
      generatedPin = String(crypto.randomInt(100000, 999999));
      room.pinHash = hashRoomPin(generatedPin);
      room.pinEncrypted = encryptPin(generatedPin);
    } else if (mode === 'custom') {
      if (customPin.length < 4 || customPin.length > 12) {
        return res.status(400).json({ success: false, message: 'الرمز السري يجب أن يكون بين 4 و12 خانة' });
      }
      generatedPin = customPin;
      room.pinHash = hashRoomPin(customPin);
      room.pinEncrypted = encryptPin(customPin);
    } else if (mode === 'remove') {
      generatedPin = null;
      room.pinHash = null;
      room.pinEncrypted = null;
    } else if (lock && !room.pinHash) {
      generatedPin = String(crypto.randomInt(100000, 999999));
      room.pinHash = hashRoomPin(generatedPin);
      room.pinEncrypted = encryptPin(generatedPin);
    }

    room.isLocked = lock;
    room.updatedAt = new Date().toISOString();
    saveStore();
    persistRoomToNeon(room);

    recordAuditLog(room, { id: auth.user.id, name: auth.user.name, role }, lock ? 'lock_room' : 'unlock_room');
    pushRoomMessage(room, {
      senderId: auth.user.id,
      senderName: auth.user.name,
      senderRole: 'system',
      msgType: 'system',
      text: lock ? `🔒 تم قفل الغرفة بواسطة ${auth.user.name}` : `🔓 تم فتح الغرفة للجميع بواسطة ${auth.user.name}`,
    });
    broadcastRoomSettings(room);

    return res.json({
      success: true,
      isLocked: room.isLocked,
      hasPin: Boolean(room.pinHash),
      pin: generatedPin,
    });
  });

  // 9. Create Invite Link (strictly authorized to prevent PIN/lock bypass)
  app.post('/api/rooms/:codeOrId/invite', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });
    if (rejectIfRoomFrozen(room, res)) return;

    const activeBan = getActiveBan(room.id, auth.user.id);
    if (activeBan && !auth.isPlatformAdmin && room.ownerId !== auth.user.id) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بإنشاء دعوة لهذه الغرفة' });
    }

    const { role, permissions } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
    const rt = getLiveRoom(room.id);

    if (room.isLocked || !room.isPublic) {
      const canInviteLocked =
        role === 'owner' ||
        role === 'head_admin' ||
        permissions.manageLockPin ||
        auth.isPlatformAdmin;
      if (!canInviteLocked) {
        return res.status(403).json({
          success: false,
          message: 'الغرفة مقفلة أو خاصة — فقط المالك أو المشرف المخوّل يمكنه إنشاء رابط دعوة',
        });
      }
    } else {
      if (!room.invitesEnabled && role === 'member' && !auth.isPlatformAdmin) {
        return res.status(403).json({ success: false, message: 'الدعوات معطلة حالياً في إعدادات الغرفة' });
      }
      if (role === 'member' && !auth.isPlatformAdmin && !rt.occupants.has(auth.user.id)) {
        return res.status(403).json({ success: false, message: 'يجب التواجد داخل الغرفة لإنشاء دعوة' });
      }
    }

    const targetUserId = req.body?.targetUserId ? String(req.body.targetUserId).trim() : null;
    const token = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    const inviteRow: StoredInviteRow = {
      id: crypto.randomUUID(),
      roomId: room.id,
      token,
      createdBy: auth.user.id,
      targetUserId,
      expiresAt,
      createdAt: new Date(now).toISOString(),
    };
    const store = loadStore();
    store.invites.push(inviteRow);
    saveStore();
    const pool = deps.getNeonPool();
    if (pool) {
      pool
        .query(
          'INSERT INTO room_invites (id, room_id, token, created_by, target_user_id, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [inviteRow.id, inviteRow.roomId, inviteRow.token, inviteRow.createdBy, inviteRow.targetUserId, inviteRow.expiresAt, inviteRow.createdAt]
        )
        .catch(() => {});
    }
    return res.json({ success: true, inviteToken: token, roomCode: room.code, expiresAt });
  });

  // 10. Seats Management (Sit, Leave, Move, Lock/Unlock, Mute/Unmute Self or User, Kick from Seat)
  app.post('/api/rooms/:codeOrId/seats/sit', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });
    if (rejectIfRoomFrozen(room, res)) return;

    const seatNumber = Math.floor(Number(req.body?.seatNumber || 0));
    if (seatNumber < 1 || seatNumber > ROOM_MAX_SEATS) {
      return res.status(400).json({ success: false, message: 'رقم المقعد غير صالح (1-15)' });
    }

    return withRoomLock(room.id, async () => {
      const store = loadStore();
      const rt = getLiveRoom(room.id);
      if (!rt.occupants.has(auth.user.id)) {
        return res.status(400).json({ success: false, message: 'يجب أن تكون متواجداً داخل الغرفة للجلوس على مقعد' });
      }
      if (getActiveBan(room.id, auth.user.id) && room.ownerId !== auth.user.id) {
        return res.status(403).json({ success: false, message: 'غير مصرح لك بالجلوس على المقعد' });
      }

      const alreadySeated = store.seats.find((s) => s.roomId === room.id && s.userId === auth.user.id);
      if (alreadySeated) {
        return res.status(400).json({
          success: false,
          message: `أنت تجلس بالفعل على المقعد #${alreadySeated.seatNumber}. انزل منه أولاً أو انتقل لمقعد آخر`,
        });
      }

      const targetSeat = store.seats.find((s) => s.roomId === room.id && s.seatNumber === seatNumber);
      if (!targetSeat) {
        return res.status(404).json({ success: false, message: 'المقعد غير موجود' });
      }
      if (targetSeat.isLocked) {
        const { role, permissions } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
        if (role !== 'owner' && role !== 'head_admin' && !permissions.manageSeats) {
          return res.status(403).json({ success: false, message: 'هذا المقعد مقفل من قبل الإدارة' });
        }
      }
      if (targetSeat.userId) {
        return res.status(409).json({ success: false, message: 'عذراً، هذا المقعد مشغول بمستخدم آخر' });
      }

      targetSeat.userId = auth.user.id;
      targetSeat.isMutedBySelf = true; // Always muted by default on sit
      targetSeat.occupiedAt = new Date().toISOString();
      rt.queue = rt.queue.filter((q) => q.userId !== auth.user.id);
      room.lastActivityAt = targetSeat.occupiedAt;
      saveStore();
      persistSeatToNeon(targetSeat);

      pushRoomMessage(room, {
        senderId: auth.user.id,
        senderName: auth.user.name,
        senderRole: 'system',
        msgType: 'system',
        text: `🎙️ صعد ${auth.user.name} إلى المقعد #${seatNumber}`,
        metadata: { event: 'sit_seat', userId: auth.user.id, seatNumber },
      });
      broadcastSeatsAndOccupants(room);

      return res.json({ success: true, seatNumber });
    });
  });

  app.post('/api/rooms/:codeOrId/seats/leave', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });

    return withRoomLock(room.id, async () => {
      const prev = vacateUserSeat(room, auth.user.id, false);
      return res.json({ success: true, leftSeatNumber: prev });
    });
  });

  app.post('/api/rooms/:codeOrId/seats/manage', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });
    if (rejectIfRoomFrozen(room, res)) return;

    const action = String(req.body?.action || '').trim(); // 'lock' | 'unlock' | 'evict' | 'move' | 'mute_user' | 'unmute_user' | 'assign_user'
    const seatNumber = req.body?.seatNumber ? Math.floor(Number(req.body.seatNumber)) : 0;
    const targetUserId = req.body?.targetUserId ? String(req.body.targetUserId).trim() : '';

    const { role, permissions } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
    const isMuteAction = action === 'mute_user' || action === 'unmute_user';
    const hasPerm = isMuteAction
      ? role === 'owner' || role === 'head_admin' || permissions.muteUsers || permissions.manageSeats
      : role === 'owner' || role === 'head_admin' || permissions.manageSeats;

    if (!hasPerm && !auth.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية إدارة المقاعد' });
    }

    if (targetUserId && targetUserId !== auth.user.id) {
      const targetIsAdmin = Boolean(resolveUserBasic(targetUserId).isAdmin);
      const targetRoleInfo = getUserRoomRoleAndPerms(room, targetUserId, targetIsAdmin);
      if (getRoleRank(targetRoleInfo.role) >= getRoleRank(role) && !auth.isPlatformAdmin) {
        return res.status(403).json({ success: false, message: 'لا يمكنك تنفيذ هذا الإجراء على شخص برتبة أعلى أو مساوية' });
      }
    }

    return withRoomLock(room.id, async () => {
      const store = loadStore();
      const rt = getLiveRoom(room.id);

      if (action === 'lock' || action === 'unlock') {
        const seat = store.seats.find((s) => s.roomId === room.id && s.seatNumber === seatNumber);
        if (!seat) return res.status(404).json({ success: false, message: 'المقعد غير موجود' });
        seat.isLocked = action === 'lock';
        saveStore();
        persistSeatToNeon(seat);
        recordAuditLog(room, { id: auth.user.id, name: auth.user.name, role }, action === 'lock' ? 'lock_seat' : 'unlock_seat', undefined, `مقعد #${seatNumber}`);
        broadcastSeatsAndOccupants(room);
        return res.json({ success: true });
      }

      if (action === 'evict') {
        const uid = targetUserId || store.seats.find((s) => s.roomId === room.id && s.seatNumber === seatNumber)?.userId || '';
        if (!uid) return res.status(400).json({ success: false, message: 'لا يوجد مستخدم على هذا المقعد' });
        const targetBasic = resolveUserBasic(uid);
        vacateUserSeat(room, uid, false);
        recordAuditLog(room, { id: auth.user.id, name: auth.user.name, role }, 'evict_seat', { id: uid, name: targetBasic.name });
        return res.json({ success: true });
      }

      if (action === 'mute_user' || action === 'unmute_user') {
        if (!targetUserId) return res.status(400).json({ success: false, message: 'يرجى تحديد المستخدم' });
        const seat = store.seats.find((s) => s.roomId === room.id && s.userId === targetUserId);
        if (!seat) return res.status(400).json({ success: false, message: 'المستخدم ليس على مقعد صوتي حالياً' });
        const mute = action === 'mute_user';
        seat.isMutedByMod = mute;
        if (mute) seat.isMutedBySelf = true;
        saveStore();
        persistSeatToNeon(seat);
        const occ = rt.occupants.get(targetUserId);
        if (occ && mute) occ.isSpeaking = false;
        const targetBasic = resolveUserBasic(targetUserId);
        recordAuditLog(room, { id: auth.user.id, name: auth.user.name, role }, mute ? 'mute_user_mic' : 'unmute_user_mic', { id: targetUserId, name: targetBasic.name });
        pushRoomMessage(room, {
          senderRole: 'system',
          msgType: 'system',
          text: mute ? `🔇 تم كتم مايك ${targetBasic.name} بواسطة الإدارة` : `🎙️ تم السماح لـ ${targetBasic.name} باستخدام المايك`,
        });
        broadcastSeatsAndOccupants(room);
        return res.json({ success: true });
      }

      if (action === 'move' || action === 'assign_user') {
        if (!targetUserId || seatNumber < 1 || seatNumber > ROOM_MAX_SEATS) {
          return res.status(400).json({ success: false, message: 'بيانات نقل المقعد غير مكتملة' });
        }
        if (!rt.occupants.has(targetUserId)) {
          return res.status(400).json({ success: false, message: 'المستخدم غير متواجد في الغرفة حالياً' });
        }
        const destSeat = store.seats.find((s) => s.roomId === room.id && s.seatNumber === seatNumber);
        if (!destSeat || destSeat.userId) {
          return res.status(409).json({ success: false, message: 'المقعد الوجهة غير متاح حالياً' });
        }
        const currentSeat = store.seats.find((s) => s.roomId === room.id && s.userId === targetUserId);
        const wasMutedByMod = currentSeat ? currentSeat.isMutedByMod : false;
        if (currentSeat) {
          currentSeat.userId = null;
          currentSeat.isMutedBySelf = true;
          currentSeat.occupiedAt = null;
          persistSeatToNeon(currentSeat);
        }
        destSeat.userId = targetUserId;
        destSeat.isMutedBySelf = true;
        destSeat.isMutedByMod = wasMutedByMod;
        destSeat.occupiedAt = new Date().toISOString();
        rt.queue = rt.queue.filter((q) => q.userId !== targetUserId);
        saveStore();
        persistSeatToNeon(destSeat);
        const targetBasic = resolveUserBasic(targetUserId);
        recordAuditLog(room, { id: auth.user.id, name: auth.user.name, role }, 'move_seat', { id: targetUserId, name: targetBasic.name }, `إلى مقعد #${seatNumber}`);
        pushRoomMessage(room, {
          senderRole: 'system',
          msgType: 'system',
          text: `🪑 انتقل ${targetBasic.name} إلى المقعد #${seatNumber}`,
        });
        broadcastSeatsAndOccupants(room);
        return res.json({ success: true });
      }

      return res.status(400).json({ success: false, message: 'إجراء غير معروف' });
    });
  });

  // 11. Room-Wide Mute (كتم الغرفة بالكامل)
  app.post('/api/rooms/:codeOrId/mute-all', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });
    if (rejectIfRoomFrozen(room, res)) return;

    const { role, permissions } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
    if (role !== 'owner' && role !== 'head_admin' && !permissions.roomMuteAll && !auth.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية كتم الغرفة بالكامل' });
    }

    return withRoomLock(room.id, async () => {
      const mute = Boolean(req.body?.isRoomMuted ?? req.body?.muted);
      room.isRoomMuted = mute;
      room.updatedAt = new Date().toISOString();

      const store = loadStore();
      const rt = getLiveRoom(room.id);
      if (mute) {
        for (const s of store.seats) {
          if (s.roomId === room.id && s.userId) {
            s.isMutedBySelf = true;
            persistSeatToNeon(s);
          }
        }
        for (const occ of rt.occupants.values()) {
          occ.isSpeaking = false;
        }
      }
      saveStore();
      persistRoomToNeon(room);

      recordAuditLog(room, { id: auth.user.id, name: auth.user.name, role }, mute ? 'room_mute_all' : 'room_unmute_all');
      pushRoomMessage(room, {
        senderRole: 'system',
        msgType: 'system',
        text: mute
          ? `🔇 تم تفعيل كتم الغرفة بالكامل بواسطة ${auth.user.name}.`
          : `🔊 تم فك الكتم العام عن الغرفة بواسطة ${auth.user.name}.`,
      });
      broadcastRoomSettings(room);
      broadcastSeatsAndOccupants(room);

      return res.json({ success: true, isRoomMuted: room.isRoomMuted });
    });
  });

  // 12. Mic Queue (Request, Cancel, Accept, Reject)
  app.post('/api/rooms/:codeOrId/queue', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });
    if (rejectIfRoomFrozen(room, res)) return;

    const action = String(req.body?.action || '').trim(); // 'request' | 'cancel' | 'accept' | 'reject'
    const targetUserId = req.body?.targetUserId ? String(req.body.targetUserId).trim() : auth.user.id;

    return withRoomLock(room.id, async () => {
      const rt = getLiveRoom(room.id);
      const store = loadStore();

      if (action === 'request') {
        if (!room.micRequestsEnabled || !room.queueEnabled) {
          return res.status(403).json({ success: false, message: 'طلب المايك معطل حالياً في هذه الغرفة' });
        }
        if (!rt.occupants.has(auth.user.id)) {
          return res.status(400).json({ success: false, message: 'يجب التواجد داخل الغرفة أولاً' });
        }
        if (store.seats.some((s) => s.roomId === room.id && s.userId === auth.user.id)) {
          return res.status(400).json({ success: false, message: 'أنت تجلس بالفعل على مقعد صوتي' });
        }
        if (rt.queue.some((q) => q.userId === auth.user.id)) {
          return res.status(409).json({ success: false, message: 'طلبك مسجل بالفعل في قائمة الانتظار' });
        }
        const u = resolveUserBasic(auth.user.id);
        rt.queue.push({
          userId: auth.user.id,
          displayId: u.displayId,
          name: u.name,
          avatar: u.avatar,
          isVerified: u.isVerified,
          equippedFrameId: u.equippedFrameId || null,
          requestedAt: new Date().toISOString(),
        });
        broadcastSeatsAndOccupants(room);
        return res.json({ success: true, queue: rt.queue });
      }

      if (action === 'cancel') {
        rt.queue = rt.queue.filter((q) => q.userId !== auth.user.id);
        broadcastSeatsAndOccupants(room);
        return res.json({ success: true, queue: rt.queue });
      }

      if (action === 'accept' || action === 'reject') {
        const { role, permissions } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
        if (role !== 'owner' && role !== 'head_admin' && !permissions.acceptMicQueue && !permissions.manageSeats && !auth.isPlatformAdmin) {
          return res.status(403).json({ success: false, message: 'ليس لديك صلاحية إدارة طلبات المايك' });
        }
        rt.queue = rt.queue.filter((q) => q.userId !== targetUserId);
        if (action === 'accept') {
          if (!rt.occupants.has(targetUserId)) {
            broadcastSeatsAndOccupants(room);
            return res.status(400).json({ success: false, message: 'غادر هذا المستخدم الغرفة' });
          }
          const already = store.seats.find((s) => s.roomId === room.id && s.userId === targetUserId);
          if (!already) {
            const freeSeat = store.seats.find((s) => s.roomId === room.id && !s.userId && !s.isLocked);
            if (!freeSeat) {
              broadcastSeatsAndOccupants(room);
              return res.status(409).json({ success: false, message: 'جميع المقاعد المفتوحة مشغولة حالياً' });
            }
            freeSeat.userId = targetUserId;
            freeSeat.isMutedBySelf = true;
            freeSeat.occupiedAt = new Date().toISOString();
            saveStore();
            persistSeatToNeon(freeSeat);
            const targetBasic = resolveUserBasic(targetUserId);
            pushRoomMessage(room, {
              senderRole: 'system',
              msgType: 'system',
              text: `✅ تمت الموافقة على طلب مايك ${targetBasic.name} وصعد للمقعد #${freeSeat.seatNumber}`,
            });
          }
        }
        broadcastSeatsAndOccupants(room);
        return res.json({ success: true, queue: rt.queue });
      }

      return res.status(400).json({ success: false, message: 'إجراء قائمة انتظار غير صالح' });
    });
  });

  // 13. Chat Moderation (Delete, Pin, Pause/Resume, Enable/Disable)
  app.post('/api/rooms/:codeOrId/chat/moderate', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });
    if (rejectIfRoomFrozen(room, res)) return;

    const { role, permissions } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
    const action = String(req.body?.action || '').trim(); // 'delete' | 'pin' | 'unpin' | 'pause' | 'resume'
    const messageId = String(req.body?.messageId || '').trim();
    const store = loadStore();

    if (action === 'delete') {
      const msg = store.messages.find((m) => m.id === messageId && m.roomId === room.id);
      if (!msg) return res.status(404).json({ success: false, message: 'الرسالة غير موجودة' });
      const canDelete = msg.senderId === auth.user.id || role === 'owner' || role === 'head_admin' || permissions.deleteMessages || auth.isPlatformAdmin;
      if (!canDelete) return res.status(403).json({ success: false, message: 'ليس لديك صلاحية حذف هذه الرسالة' });
      msg.isDeleted = true;
      if (room.pinnedMessageId === msg.id) {
        room.pinnedMessageId = null;
        persistRoomToNeon(room);
      }
      saveStore();
      const pool = deps.getNeonPool();
      if (pool) pool.query('UPDATE room_messages SET is_deleted = TRUE WHERE id = $1', [msg.id]).catch(() => {});
      recordAuditLog(room, { id: auth.user.id, name: auth.user.name, role }, 'delete_message', { id: msg.senderId, name: msg.senderName });
      broadcastToRoom(room.id, { type: 'chat:message_deleted', messageId: msg.id });
      broadcastRoomSettings(room);
      return res.json({ success: true });
    }

    if (action === 'pin' || action === 'unpin') {
      if (role !== 'owner' && role !== 'head_admin' && !permissions.pinMessages && !auth.isPlatformAdmin) {
        return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تثبيت الرسائل' });
      }
      if (action === 'unpin') {
        room.pinnedMessageId = null;
      } else {
        const msg = store.messages.find((m) => m.id === messageId && m.roomId === room.id && !m.isDeleted);
        if (!msg) return res.status(404).json({ success: false, message: 'الرسالة غير موجودة' });
        room.pinnedMessageId = msg.id;
      }
      room.updatedAt = new Date().toISOString();
      saveStore();
      persistRoomToNeon(room);
      broadcastRoomSettings(room);
      return res.json({ success: true });
    }

    if (action === 'pause' || action === 'resume') {
      if (role !== 'owner' && role !== 'head_admin' && !permissions.pauseChat && !auth.isPlatformAdmin) {
        return res.status(403).json({ success: false, message: 'ليس لديك صلاحية إيقاف/تفعيل الدردشة' });
      }
      room.chatPaused = action === 'pause';
      room.updatedAt = new Date().toISOString();
      saveStore();
      persistRoomToNeon(room);
      recordAuditLog(room, { id: auth.user.id, name: auth.user.name, role }, action === 'pause' ? 'pause_chat' : 'resume_chat');
      pushRoomMessage(room, {
        senderRole: 'system',
        msgType: 'system',
        text: room.chatPaused
          ? `⏸️ تم إيقاف الدردشة مؤقتاً بواسطة ${auth.user.name}`
          : `▶️ تم إعادة تشغيل الدردشة بواسطة ${auth.user.name}`,
      });
      broadcastRoomSettings(room);
      return res.json({ success: true, chatPaused: room.chatPaused });
    }

    return res.status(400).json({ success: false, message: 'إجراء غير معروف' });
  });

  // 14. In-Room Gifts (Integrated with Coins -> Diamonds, Single/Multi/All Seated/Owner, Idempotent)
  app.post('/api/rooms/:codeOrId/gifts/send', async (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });
    if (rejectIfRoomFrozen(room, res)) return;

    const giftId = String(req.body?.giftId || '').trim();
    const rawQty = Number(req.body?.quantity ?? 1);
    if (!Number.isFinite(rawQty) || rawQty < 1 || rawQty > 100 || !Number.isInteger(rawQty)) {
      return res.status(400).json({ success: false, message: 'كمية الهدية يجب أن تكون عدداً صحيحاً بين 1 و100' });
    }
    const quantity = rawQty;
    const recipientMode = String(req.body?.recipientMode || 'single').trim(); // 'single' | 'selected' | 'all_seated' | 'owner'
    const rawRecipientIds: string[] = Array.isArray(req.body?.recipientIds) ? req.body.recipientIds.slice(0, 50).map(String) : [];
    const idempotencyKey = String(req.body?.idempotencyKey || req.headers['idempotency-key'] || '').trim().slice(0, 128);

    const gift = SOULX_ROOM_GIFTS.find((g) => g.id === giftId);
    if (!gift) {
      return res.status(400).json({ success: false, message: 'الهدية المحددة غير صالحة' });
    }

    const rt = getLiveRoom(room.id);
    if (!rt.occupants.has(auth.user.id)) {
      return res.status(400).json({ success: false, message: 'يجب التواجد داخل الغرفة لإرسال هدية' });
    }

    const store = loadStore();

    return withCoinLock(async () => {
      const pool = deps.getNeonPool();
      if (idempotencyKey) {
        const existingLocal = store.idempotency[idempotencyKey];
        if (existingLocal && existingLocal.userId === auth.user.id && existingLocal.action === 'room_gift') {
          return res.json(existingLocal.response);
        }
        if (pool) {
          try {
            const idemRes = await pool.query(
              'SELECT user_id, response_json FROM room_idempotency_keys WHERE idempotency_key = $1 LIMIT 1',
              [idempotencyKey]
            );
            if (idemRes.rows?.[0] && idemRes.rows[0].user_id === auth.user.id) {
              return res.json(idemRes.rows[0].response_json);
            }
          } catch {}
        }
      }

      // Resolve validated targets inside room
      let targetIds: string[] = [];
      if (recipientMode === 'all_seated') {
        targetIds = store.seats
          .filter((s) => s.roomId === room.id && Boolean(s.userId) && s.userId !== auth.user.id)
          .map((s) => s.userId!) ;
        if (targetIds.length === 0) {
          return res.status(400).json({ success: false, message: 'لا يوجد متحدثون آخرون على المقاعد حالياً' });
        }
      } else if (recipientMode === 'owner') {
        if (room.ownerId === auth.user.id) {
          return res.status(400).json({ success: false, message: 'لا يمكنك إهداء نفسك كمالك للغرفة' });
        }
        targetIds = [room.ownerId];
      } else {
        targetIds = Array.from(new Set(rawRecipientIds.map((x) => x.trim()).filter(Boolean))).filter(
          (tid) => tid !== auth.user.id && (rt.occupants.has(tid) || tid === room.ownerId)
        );
        if (targetIds.length === 0) {
          return res.status(400).json({ success: false, message: 'يرجى تحديد مستلم متواجد داخل الغرفة' });
        }
      }

      targetIds = Array.from(new Set(targetIds)).filter((tid) => Boolean(deps.resolveUserRecordByAnyId(tid)));
      if (targetIds.length === 0) {
        return res.status(400).json({ success: false, message: 'تعذر التحقق من حساب المستلم' });
      }
      const perRecipientCoins = gift.cost * quantity;
      const totalCostCoins = perRecipientCoins * targetIds.length;
      const now = new Date().toISOString();

      let newSenderCoins = 0;
      const users = deps.getStoredUsers();
      const senderIdx = users.findIndex((u) => u.id === auth.user.id);

      if (pool) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const sRes = await client.query('SELECT coins_balance FROM profiles WHERE id = $1 FOR UPDATE', [auth.user.id]);
          const currentCoins = Number(sRes.rows?.[0]?.coins_balance ?? auth.user.coinsBalance ?? 0);
          if (currentCoins < totalCostCoins) {
            await client.query('ROLLBACK');
            client.release();
            return res.status(400).json({
              success: false,
              insufficientCoins: true,
              coinsBalance: currentCoins,
              requiredCoins: totalCostCoins,
              message: `رصيد الكوينز غير كافٍ. التكلفة الإجمالية ${totalCostCoins.toLocaleString()} كوينز`,
            });
          }

          const dedRes = await client.query(
            'UPDATE profiles SET coins_balance = coins_balance - $1, updated_at = NOW() WHERE id = $2 AND coins_balance >= $1 RETURNING coins_balance',
            [totalCostCoins, auth.user.id]
          );
          newSenderCoins = Number(dedRes.rows[0].coins_balance);

          for (const rid of targetIds) {
            const credRes = await client.query(
              'UPDATE profiles SET wallet_balance = COALESCE(wallet_balance, 0) + $1, updated_at = NOW() WHERE id = $2 RETURNING wallet_balance',
              [perRecipientCoins, rid]
            );
            const newDiamonds = Number(credRes.rows?.[0]?.wallet_balance ?? 0);
            const rIdx = users.findIndex((u) => u.id === rid);
            if (rIdx >= 0) {
              users[rIdx].walletBalance = newDiamonds;
              users[rIdx].updatedAt = now;
            }
          }

          if (senderIdx >= 0) {
            users[senderIdx].coinsBalance = newSenderCoins;
            users[senderIdx].updatedAt = now;
          }
          deps.saveStoredUsers(users);

          await client.query(
            `INSERT INTO room_gift_transactions (id, idempotency_key, room_id, sender_id, recipient_ids, gift_id, gift_name, gift_icon, unit_cost, quantity, total_cost, created_at)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12)`,
            [
              crypto.randomUUID(),
              idempotencyKey || null,
              room.id,
              auth.user.id,
              JSON.stringify(targetIds),
              gift.id,
              gift.nameAr,
              gift.icon,
              gift.cost,
              quantity,
              totalCostCoins,
              now,
            ]
          );

          await client.query('COMMIT');
          client.release();
        } catch (dbErr: any) {
          await client.query('ROLLBACK').catch(() => {});
          client.release();
          return res.status(500).json({ success: false, message: dbErr?.message || 'فشل إرسال الهدية' });
        }
      } else {
        const currentCoins = Number(senderIdx >= 0 ? users[senderIdx].coinsBalance ?? 0 : auth.user.coinsBalance ?? 0);
        if (currentCoins < totalCostCoins) {
          return res.status(400).json({
            success: false,
            insufficientCoins: true,
            coinsBalance: currentCoins,
            requiredCoins: totalCostCoins,
            message: `رصيد الكوينز غير كافٍ. التكلفة الإجمالية ${totalCostCoins.toLocaleString()} كوينز`,
          });
        }
        newSenderCoins = currentCoins - totalCostCoins;
        if (senderIdx >= 0) {
          users[senderIdx].coinsBalance = newSenderCoins;
          users[senderIdx].updatedAt = now;
        }
        for (const rid of targetIds) {
          const rIdx = users.findIndex((u) => u.id === rid);
          if (rIdx >= 0) {
            users[rIdx].walletBalance = Number(users[rIdx].walletBalance || 0) + perRecipientCoins;
            users[rIdx].updatedAt = now;
          }
        }
        deps.saveStoredUsers(users);
      }

      // Broadcast SSE balance updates
      deps.broadcastChatMessage([auth.user.id, auth.user.displayId, auth.user.email], {
        type: 'balance_update',
        currency: 'coins',
        balance: newSenderCoins,
        userId: auth.user.id,
        displayId: auth.user.displayId,
      });

      const recipientNames = targetIds.map((rid) => {
        const u = resolveUserBasic(rid);
        const recUserObj = users.find((x) => x.id === rid);
        if (recUserObj) {
          deps.broadcastChatMessage([recUserObj.id, recUserObj.displayId, recUserObj.email], {
            type: 'balance_update',
            currency: 'diamonds',
            balance: recUserObj.walletBalance,
            userId: recUserObj.id,
            displayId: recUserObj.displayId,
          });
        }
        return u.name;
      });

      room.totalGiftsCoins = (room.totalGiftsCoins || 0) + totalCostCoins;
      room.lastActivityAt = now;
      saveStore();
      persistRoomToNeon(room);

      const { role } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
      const recipientsSummary =
        recipientMode === 'all_seated'
          ? `جميع المتحدثين (${targetIds.length})`
          : recipientNames.join('، ');

      const giftPayload = {
        giftId: gift.id,
        giftNameAr: gift.nameAr,
        giftNameEn: gift.nameEn,
        giftIcon: gift.icon,
        unitCost: gift.cost,
        quantity,
        totalCost: totalCostCoins,
        senderId: auth.user.id,
        senderName: auth.user.name,
        senderAvatar: auth.user.photoUrl || null,
        recipientMode,
        recipientIds: targetIds,
        recipientNames,
        recipientsSummary,
      };

      pushRoomMessage(room, {
        senderId: auth.user.id,
        senderName: auth.user.name,
        senderAvatar: auth.user.photoUrl || null,
        senderRole: role,
        senderIsVerified: Boolean(auth.user.isVerified),
        senderFrameId: auth.user.equippedFrameId || null,
        msgType: 'gift',
        text: `أهدى ${auth.user.name} ${gift.icon} ${gift.nameAr} ×${quantity} إلى ${recipientsSummary}`,
        metadata: giftPayload,
      });

      broadcastToRoom(room.id, { type: 'room:gift', gift: giftPayload });

      const finalResponse = {
        success: true,
        senderCoins: newSenderCoins,
        totalCostCoins,
        recipientsCount: targetIds.length,
        gift: giftPayload,
      };

      if (idempotencyKey) {
        store.idempotency[idempotencyKey] = {
          userId: auth.user.id,
          action: 'room_gift',
          response: finalResponse,
          createdAt: now,
        };
        saveStore();
        if (pool) {
          pool
            .query(
              `INSERT INTO room_idempotency_keys (id, idempotency_key, user_id, action, response_json, created_at)
               VALUES ($1, $2, $3, 'room_gift', $4::jsonb, NOW()) ON CONFLICT (idempotency_key) DO NOTHING`,
              [crypto.randomUUID(), idempotencyKey, auth.user.id, JSON.stringify(finalResponse)]
            )
            .catch(() => {});
        }
      }

      return res.json(finalResponse);
    });
  });

  // 15. Moderators & Head Admin Management (with strict role hierarchy & no self-escalation)
  app.post('/api/rooms/:codeOrId/moderators', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });
    if (rejectIfRoomFrozen(room, res)) return;

    const { role: actorRole, permissions: actorPerms } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
    if (actorRole !== 'owner' && actorRole !== 'head_admin' && !auth.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'فقط المالك أو المشرف الرئيسي يمكنه إدارة المشرفين' });
    }

    const action = String(req.body?.action || 'upsert'); // 'upsert' | 'remove'
    const targetUserIdRaw = String(req.body?.targetUserId || '').trim();
    const targetUser = deps.resolveUserRecordByAnyId(targetUserIdRaw);
    const targetUserId = targetUser?.id || targetUserIdRaw;
    if (!targetUserId || targetUserId === room.ownerId) {
      return res.status(400).json({ success: false, message: 'لا يمكن تعديل رتبة مالك الغرفة' });
    }
    if (targetUserId === auth.user.id && !auth.isPlatformAdmin) {
      return res.status(400).json({ success: false, message: 'لا يمكنك تعديل صلاحياتك بنفسك' });
    }

    const store = loadStore();
    if (action === 'remove') {
      const idx = store.moderators.findIndex((m) => m.roomId === room.id && m.userId === targetUserId);
      if (idx === -1) return res.status(404).json({ success: false, message: 'المستخدم ليس مشرفاً في الغرفة' });
      if (actorRole === 'head_admin' && store.moderators[idx].role === 'head_admin' && !auth.isPlatformAdmin) {
        return res.status(403).json({ success: false, message: 'فقط المالك يمكنه إزالة المشرف الرئيسي' });
      }
      store.moderators.splice(idx, 1);
      saveStore();
      const pool = deps.getNeonPool();
      if (pool) pool.query('DELETE FROM room_moderators WHERE room_id = $1 AND user_id = $2', [room.id, targetUserId]).catch(() => {});
      const targetBasic = resolveUserBasic(targetUserId);
      recordAuditLog(room, { id: auth.user.id, name: auth.user.name, role: actorRole }, 'remove_moderator', { id: targetUserId, name: targetBasic.name });
      pushRoomMessage(room, {
        senderRole: 'system',
        msgType: 'system',
        text: `تمت إزالة صلاحية الإشراف عن ${targetBasic.name}`,
      });
      broadcastRoomSettings(room);
      broadcastSeatsAndOccupants(room);
      return res.json({ success: true });
    }

    // Check banned user cannot be promoted
    if (getActiveBan(room.id, targetUserId)) {
      return res.status(400).json({ success: false, message: 'لا يمكن ترقية مستخدم محظور من الغرفة' });
    }

    const requestedRole = req.body?.role === 'head_admin' ? 'head_admin' : 'moderator';
    if (requestedRole === 'head_admin' && actorRole !== 'owner' && !auth.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'فقط مالك الغرفة يمكنه تعيين المشرف الرئيسي' });
    }

    const requestedPerms = getEffectivePermissions(requestedRole, req.body?.permissions);
    // Ensure actor cannot grant permissions higher than their own
    const sanitizedPerms: RoomModPermissions = { ...requestedPerms };
    if (actorRole !== 'owner' && !auth.isPlatformAdmin) {
      (Object.keys(sanitizedPerms) as Array<keyof RoomModPermissions>).forEach((k) => {
        if (!actorPerms[k]) sanitizedPerms[k] = false;
      });
    }

    const now = new Date().toISOString();
    const existing = store.moderators.find((m) => m.roomId === room.id && m.userId === targetUserId);
    if (existing) {
      existing.role = requestedRole;
      existing.permissions = sanitizedPerms;
      existing.updatedAt = now;
    } else {
      store.moderators.push({
        id: crypto.randomUUID(),
        roomId: room.id,
        userId: targetUserId,
        role: requestedRole,
        permissions: sanitizedPerms,
        assignedBy: auth.user.id,
        createdAt: now,
        updatedAt: now,
      });
    }
    saveStore();
    const pool = deps.getNeonPool();
    if (pool) {
      pool
        .query(
          `INSERT INTO room_moderators (id, room_id, user_id, role, permissions, assigned_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $7)
           ON CONFLICT (room_id, user_id) DO UPDATE SET
            role = EXCLUDED.role,
            permissions = EXCLUDED.permissions,
            updated_at = EXCLUDED.updated_at`,
          [crypto.randomUUID(), room.id, targetUserId, requestedRole, JSON.stringify(sanitizedPerms), auth.user.id, now]
        )
        .catch(() => {});
    }

    const targetBasic = resolveUserBasic(targetUserId);
    recordAuditLog(room, { id: auth.user.id, name: auth.user.name, role: actorRole }, 'set_moderator', { id: targetUserId, name: targetBasic.name }, requestedRole);
    pushRoomMessage(room, {
      senderRole: 'system',
      msgType: 'system',
      text: requestedRole === 'head_admin'
        ? `👑 تم تعيين ${targetBasic.name} مشرفاً رئيسياً في الغرفة`
        : `🛡️ تم تعيين ${targetBasic.name} مشرفاً في الغرفة`,
    });
    broadcastRoomSettings(room);
    broadcastSeatsAndOccupants(room);

    return res.json({ success: true });
  });

  // 16. Kick / Ban / Unban / Edit Ban Duration
  app.get('/api/rooms/:codeOrId/bans', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });

    const { role, permissions } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
    if (role !== 'owner' && role !== 'head_admin' && !permissions.banUsers && !permissions.kickUsers && !auth.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'غير مصرح بعرض قائمة المحظورين' });
    }

    const store = loadStore();
    const now = Date.now();
    const list: RoomBanRecord[] = store.bans
      .filter((b) => b.roomId === room.id && (!b.expiresAt || new Date(b.expiresAt).getTime() > now))
      .map((b) => {
        const u = resolveUserBasic(b.userId);
        const by = resolveUserBasic(b.bannedBy);
        return {
          ...b,
          displayId: u.displayId,
          name: u.name,
          avatar: u.avatar,
          bannedByName: by.name,
        };
      });
    return res.json({ success: true, bans: list });
  });

  app.post('/api/rooms/:codeOrId/moderation/ban', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });
    if (rejectIfRoomFrozen(room, res)) return;

    const action = String(req.body?.action || 'ban').trim(); // 'kick' | 'ban' | 'unban' | 'update_duration'
    const targetUserIdRaw = String(req.body?.targetUserId || '').trim();
    const targetUser = deps.resolveUserRecordByAnyId(targetUserIdRaw);
    const targetUserId = targetUser?.id || targetUserIdRaw;
    if (!targetUserId) return res.status(400).json({ success: false, message: 'يرجى تحديد المستخدم' });

    const targetIsAdmin = Boolean(resolveUserBasic(targetUserId).isAdmin);
    const { role: actorRole, permissions } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
    const targetRoleInfo = getUserRoomRoleAndPerms(room, targetUserId, targetIsAdmin);

    if (action === 'kick') {
      if (actorRole !== 'owner' && actorRole !== 'head_admin' && !permissions.kickUsers && !auth.isPlatformAdmin) {
        return res.status(403).json({ success: false, message: 'ليس لديك صلاحية طرد المستخدمين' });
      }
    } else {
      if (actorRole !== 'owner' && actorRole !== 'head_admin' && !permissions.banUsers && !auth.isPlatformAdmin) {
        return res.status(403).json({ success: false, message: 'ليس لديك صلاحية إدارة الحظر' });
      }
    }

    if (targetUserId === room.ownerId || (getRoleRank(targetRoleInfo.role) >= getRoleRank(actorRole) && !auth.isPlatformAdmin)) {
      return res.status(403).json({ success: false, message: 'لا يمكن تطبيق هذا الإجراء على مالك الغرفة أو رتبة مساوية/أعلى' });
    }

    const store = loadStore();
    const pool = deps.getNeonPool();
    const targetBasic = resolveUserBasic(targetUserId);

    if (action === 'unban') {
      store.bans = store.bans.filter((b) => !(b.roomId === room.id && b.userId === targetUserId));
      saveStore();
      if (pool) pool.query('DELETE FROM room_bans WHERE room_id = $1 AND user_id = $2', [room.id, targetUserId]).catch(() => {});
      recordAuditLog(room, { id: auth.user.id, name: auth.user.name, role: actorRole }, 'unban_user', { id: targetUserId, name: targetBasic.name });
      return res.json({ success: true });
    }

    // Duration in minutes: 0 or null = permanent (or instant kick if action === 'kick' && durationMinutes === 0)
    const rawDuration = req.body?.durationMinutes !== undefined && req.body?.durationMinutes !== null
      ? Number(req.body.durationMinutes)
      : 0;
    const durationMinutes = Number.isFinite(rawDuration)
      ? Math.max(0, Math.min(525600, Math.floor(rawDuration)))
      : 0;
    const isPermanent = Boolean(req.body?.isPermanent);
    const reason = String(req.body?.reason || '').trim().slice(0, 200) || null;
    const now = Date.now();
    const expiresAt = isPermanent
      ? null
      : durationMinutes > 0
      ? new Date(now + durationMinutes * 60 * 1000).toISOString()
      : null;

    if (action === 'kick' && durationMinutes === 0 && !isPermanent) {
      // Instant kick (evict now without adding ban block)
      evictUserFromRoom(room, targetUserId, reason || 'تم طردك من الغرفة بواسطة الإدارة', 'kick', null);
      recordAuditLog(room, { id: auth.user.id, name: auth.user.name, role: actorRole }, 'kick_user', { id: targetUserId, name: targetBasic.name }, reason || 'طرد فوري');
      pushRoomMessage(room, {
        senderRole: 'system',
        msgType: 'system',
        text: `🚪 تم طرد ${targetBasic.name} من الغرفة بواسطة ${auth.user.name}`,
      });
      return res.json({ success: true });
    }

    // Remove moderator privileges if banned
    store.moderators = store.moderators.filter((m) => !(m.roomId === room.id && m.userId === targetUserId));
    if (pool) pool.query('DELETE FROM room_moderators WHERE room_id = $1 AND user_id = $2', [room.id, targetUserId]).catch(() => {});

    const banType: 'ban' | 'kick' = action === 'kick' ? 'kick' : 'ban';
    const existing = store.bans.find((b) => b.roomId === room.id && b.userId === targetUserId);
    const createdAtIso = new Date(now).toISOString();
    if (existing) {
      existing.banType = banType;
      existing.reason = reason;
      existing.bannedBy = auth.user.id;
      existing.expiresAt = expiresAt;
      existing.createdAt = createdAtIso;
    } else {
      store.bans.push({
        id: crypto.randomUUID(),
        roomId: room.id,
        userId: targetUserId,
        banType,
        reason,
        bannedBy: auth.user.id,
        expiresAt,
        createdAt: createdAtIso,
      });
    }
    saveStore();
    if (pool) {
      pool
        .query(
          `INSERT INTO room_bans (id, room_id, user_id, ban_type, reason, banned_by, expires_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (room_id, user_id) DO UPDATE SET
            ban_type = EXCLUDED.ban_type,
            reason = EXCLUDED.reason,
            banned_by = EXCLUDED.banned_by,
            expires_at = EXCLUDED.expires_at,
            created_at = EXCLUDED.created_at`,
          [crypto.randomUUID(), room.id, targetUserId, banType, reason, auth.user.id, expiresAt, createdAtIso]
        )
        .catch(() => {});
    }

    if (action !== 'update_duration') {
      evictUserFromRoom(
        room,
        targetUserId,
        reason || (banType === 'kick' ? 'تم طردك مؤقتاً من الغرفة' : 'تم حظرك من هذه الغرفة'),
        banType,
        expiresAt
      );
      pushRoomMessage(room, {
        senderRole: 'system',
        msgType: 'system',
        text: banType === 'kick'
          ? `⏳ تم طرد ${targetBasic.name} مؤقتاً (${durationMinutes} دقيقة)`
          : `⛔ تم حظر ${targetBasic.name} من الغرفة`,
      });
    }
    recordAuditLog(room, { id: auth.user.id, name: auth.user.name, role: actorRole }, action, { id: targetUserId, name: targetBasic.name }, reason || undefined);

    return res.json({ success: true });
  });

  // 17. Room Settings Update & Cover Replacement
  app.patch('/api/rooms/:codeOrId/settings', handleCoverUpload, async (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });
    if (rejectIfRoomFrozen(room, res)) return;

    const { role } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
    if (role !== 'owner' && role !== 'head_admin' && !auth.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'فقط مالك الغرفة أو المشرف الرئيسي يمكنه تعديل الإعدادات' });
    }

    const oldName = room.name;
    if (typeof req.body?.name === 'string') {
      const n = req.body.name.trim();
      if (n.length < 2 || n.length > 60) {
        return res.status(400).json({ success: false, message: 'اسم الغرفة يجب أن يكون بين حرفين و60 حرفاً' });
      }
      room.name = n;
    }
    if (typeof req.body?.description === 'string') room.description = req.body.description.trim().slice(0, 300);
    if (typeof req.body?.category === 'string') {
      const allowed: RoomCategory[] = ['chat', 'music', 'games', 'chill', 'culture', 'vip'];
      if (allowed.includes(req.body.category as RoomCategory)) room.category = req.body.category as RoomCategory;
    }
    if (req.body?.isPublic !== undefined) room.isPublic = req.body.isPublic === true || req.body.isPublic === 'true';
    if (req.body?.chatEnabled !== undefined) room.chatEnabled = req.body.chatEnabled === true || req.body.chatEnabled === 'true';
    if (req.body?.micRequestsEnabled !== undefined) room.micRequestsEnabled = req.body.micRequestsEnabled === true || req.body.micRequestsEnabled === 'true';
    if (req.body?.queueEnabled !== undefined) room.queueEnabled = req.body.queueEnabled === true || req.body.queueEnabled === 'true';
    if (req.body?.invitesEnabled !== undefined) room.invitesEnabled = req.body.invitesEnabled === true || req.body.invitesEnabled === 'true';
    if (req.body?.notificationsEnabled !== undefined) room.notificationsEnabled = req.body.notificationsEnabled === true || req.body.notificationsEnabled === 'true';
    if (req.body?.gamesPermission && ['owner', 'moderators', 'all'].includes(req.body.gamesPermission)) {
      room.gamesPermission = req.body.gamesPermission;
    }
    if (req.body?.musicPermission && ['owner', 'moderators'].includes(req.body.musicPermission)) {
      room.musicPermission = req.body.musicPermission;
    }

    if (req.file?.buffer) {
      try {
        const processed = await validateAndProcessRoomCoverBuffer(req.file.buffer);
        const uploaded = await uploadRoomCoverObject(room.id, processed.buffer);
        const oldKey = room.coverKey;
        room.coverKey = uploaded.key;
        room.coverUrl = `/api/rooms/cover/${encodeURIComponent(room.id)}/${encodeURIComponent(path.basename(uploaded.key))}`;
        if (oldKey) await deleteRoomCoverObject(oldKey).catch(() => {});
      } catch (err: any) {
        return res.status(400).json({ success: false, message: err?.message || 'صورة الغرفة غير صالحة' });
      }
    }

    room.updatedAt = new Date().toISOString();
    saveStore();
    persistRoomToNeon(room);

    recordAuditLog(room, { id: auth.user.id, name: auth.user.name, role }, 'update_settings', undefined, oldName !== room.name ? `تغيير الاسم إلى ${room.name}` : 'تحديث إعدادات الغرفة');
    pushRoomMessage(room, {
      senderRole: 'system',
      msgType: 'system',
      text: `⚙️ قام ${auth.user.name} بتحديث إعدادات الغرفة`,
    });
    broadcastRoomSettings(room);

    return res.json({ success: true, room: buildRoomDetail(room, auth.user.id, auth.isPlatformAdmin) });
  });

  // 18. Platform Admin: Feature / Unfeature Room
  app.patch('/api/rooms/:codeOrId/feature', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    if (!auth.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'هذا الإجراء مخصص لإدارة المنصة فقط' });
    }
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });

    room.isFeatured = Boolean(req.body?.isFeatured);
    room.updatedAt = new Date().toISOString();
    saveStore();
    persistRoomToNeon(room);
    broadcastRoomSettings(room);
    return res.json({ success: true, isFeatured: room.isFeatured });
  });

  // 19. Audit Log (Immutable, Owner & Head Admin & Platform Admin ONLY)
  app.get('/api/rooms/:codeOrId/audit-logs', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });

    const { role } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
    if (role !== 'owner' && role !== 'head_admin' && !auth.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'سجل التدقيق متاح فقط لمالك الغرفة والمشرف الرئيسي' });
    }

    const store = loadStore();
    const logs = store.auditLogs.filter((l) => l.roomId === room.id).slice(0, 200);
    return res.json({ success: true, logs });
  });

  // 20. Favorites / Follow Room
  app.post('/api/rooms/:codeOrId/favorite', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });

    const store = loadStore();
    const pool = deps.getNeonPool();
    const existingIdx = store.favorites.findIndex((f) => f.roomId === room.id && f.userId === auth.user.id);

    let isFavorite = false;
    if (existingIdx >= 0 && req.body?.notificationsEnabled === undefined) {
      const removed = store.favorites.splice(existingIdx, 1)[0];
      if (pool) pool.query('DELETE FROM room_favorites WHERE id = $1', [removed.id]).catch(() => {});
      isFavorite = false;
    } else if (existingIdx >= 0) {
      store.favorites[existingIdx].notificationsEnabled = Boolean(req.body.notificationsEnabled);
      isFavorite = true;
      if (pool) {
        pool
          .query('UPDATE room_favorites SET notifications_enabled = $1 WHERE id = $2', [
            store.favorites[existingIdx].notificationsEnabled,
            store.favorites[existingIdx].id,
          ])
          .catch(() => {});
      }
    } else {
      const row: StoredFavoriteRow = {
        id: crypto.randomUUID(),
        roomId: room.id,
        userId: auth.user.id,
        notificationsEnabled: req.body?.notificationsEnabled !== false,
        createdAt: new Date().toISOString(),
      };
      store.favorites.push(row);
      isFavorite = true;
      if (pool) {
        pool
          .query(
            'INSERT INTO room_favorites (id, room_id, user_id, notifications_enabled, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
            [row.id, row.roomId, row.userId, row.notificationsEnabled, row.createdAt]
          )
          .catch(() => {});
      }
    }
    saveStore();
    return res.json({ success: true, isFavorite });
  });

  // 21. Room Events (Create / Edit / Cancel / RSVP)
  app.post('/api/rooms/:codeOrId/events', (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });
    if (rejectIfRoomFrozen(room, res)) return;

    const action = String(req.body?.action || 'create').trim(); // 'create' | 'cancel' | 'rsvp'
    const store = loadStore();
    const pool = deps.getNeonPool();

    if (action === 'rsvp') {
      const eventId = String(req.body?.eventId || '').trim();
      const evt = store.events.find((e) => e.id === eventId && e.roomId === room.id);
      if (!evt) return res.status(404).json({ success: false, message: 'الحدث غير موجود' });
      const exists = evt.rsvpUserIds.includes(auth.user.id);
      if (exists) {
        evt.rsvpUserIds = evt.rsvpUserIds.filter((id) => id !== auth.user.id);
      } else {
        evt.rsvpUserIds.push(auth.user.id);
      }
      evt.updatedAt = new Date().toISOString();
      saveStore();
      if (pool) {
        pool.query('UPDATE room_events SET rsvp_user_ids = $1::jsonb, updated_at = $2 WHERE id = $3', [JSON.stringify(evt.rsvpUserIds), evt.updatedAt, evt.id]).catch(() => {});
      }
      const eventsList = store.events.filter((e) => e.roomId === room.id && e.status !== 'cancelled');
      broadcastToRoom(room.id, { type: 'events:update', events: eventsList });
      return res.json({ success: true, joined: !exists, events: eventsList });
    }

    const { role, permissions } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
    if (role !== 'owner' && role !== 'head_admin' && !permissions.manageEvents && !auth.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية إدارة أحداث الغرفة' });
    }

    if (action === 'cancel') {
      const eventId = String(req.body?.eventId || '').trim();
      const evt = store.events.find((e) => e.id === eventId && e.roomId === room.id);
      if (!evt) return res.status(404).json({ success: false, message: 'الحدث غير موجود' });
      evt.status = 'cancelled';
      evt.updatedAt = new Date().toISOString();
      saveStore();
      if (pool) pool.query("UPDATE room_events SET status = 'cancelled', updated_at = $1 WHERE id = $2", [evt.updatedAt, evt.id]).catch(() => {});
      const eventsList = store.events.filter((e) => e.roomId === room.id && e.status !== 'cancelled');
      broadcastToRoom(room.id, { type: 'events:update', events: eventsList });
      return res.json({ success: true, events: eventsList });
    }

    const title = String(req.body?.title || '').trim();
    const description = String(req.body?.description || '').trim().slice(0, 300);
    const startsAtStr = String(req.body?.startsAt || '').trim();
    const startsAtMs = new Date(startsAtStr).getTime();
    if (title.length < 2 || !Number.isFinite(startsAtMs)) {
      return res.status(400).json({ success: false, message: 'يرجى إدخال عنوان وموعد صحيح للحدث' });
    }

    const now = new Date().toISOString();
    const evt: StoredEventRow = {
      id: `revt-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
      roomId: room.id,
      title,
      description,
      startsAt: new Date(startsAtMs).toISOString(),
      createdBy: auth.user.id,
      status: 'scheduled',
      rsvpUserIds: [auth.user.id],
      createdAt: now,
      updatedAt: now,
    };
    store.events.push(evt);
    saveStore();
    if (pool) {
      pool
        .query(
          `INSERT INTO room_events (id, room_id, title, description, starts_at, created_by, status, rsvp_user_ids, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $9)`,
          [evt.id, evt.roomId, evt.title, evt.description, evt.startsAt, evt.createdBy, evt.status, JSON.stringify(evt.rsvpUserIds), now]
        )
        .catch(() => {});
    }

    pushRoomMessage(room, {
      senderRole: 'system',
      msgType: 'announcement',
      text: `📅 حدث جديد في الغرفة: "${title}"`,
    });
    const eventsList = store.events.filter((e) => e.roomId === room.id && e.status !== 'cancelled');
    broadcastToRoom(room.id, { type: 'events:update', events: eventsList });

    // Notify room followers when notifications are enabled
    if (room.notificationsEnabled && deps.createAndSaveUserNotification) {
      const followers = store.favorites.filter((f) => f.roomId === room.id && f.notificationsEnabled && f.userId !== auth.user.id);
      for (const fav of followers) {
        const fu = resolveUserBasic(fav.userId);
        deps.createAndSaveUserNotification({
          userId: fav.userId,
          userDisplayId: fu.displayId,
          type: 'admin_message',
          titleAr: `📅 حدث جديد في غرفة ${room.name}`,
          titleEn: `📅 New event in ${room.name}`,
          messageAr: `${title} — احجز مقعدك الآن!`,
          messageEn: `${title} — Join now!`,
          metadata: { roomCode: room.code, eventId: evt.id },
        });
      }
    }

    return res.json({ success: true, event: evt, events: eventsList });
  });

  // 22. Permanently Delete Room (Owner or Platform Admin ONLY)
  app.delete('/api/rooms/:codeOrId', async (req: Request, res: Response) => {
    const auth = requireAuth(req, res);
    if (!auth) return;
    const room = findRoomByCodeOrId(req.params.codeOrId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });

    if (room.ownerId !== auth.user.id && !auth.isPlatformAdmin) {
      return res.status(403).json({ success: false, message: 'فقط مالك الغرفة أو إدارة المنصة يمكنهم حذف الغرفة نهائياً' });
    }

    await permanentlyDeleteRoom(room);
    return res.json({ success: true, message: 'تم حذف الغرفة نهائياً بنجاح' });
  });

  // =========================================================================
  // ADMIN PANEL ROOM MANAGEMENT ROUTES (/api/admin/rooms*)
  // =========================================================================

  // A1. List all rooms for Admin Panel (includes hidden, private, frozen)
  app.get('/api/admin/rooms', deps.verifyAdminAuth, async (_req: Request, res: Response) => {
    await hydrateFromNeonIfNeeded().catch(() => {});
    const store = loadStore();
    const roomsList = store.rooms
      .map((room) => {
        const owner = resolveUserBasic(room.ownerId);
        const rt = liveRooms.get(room.id);
        const occupantsCount = rt ? rt.occupants.size : 0;
        const occupiedSeatsCount = store.seats.filter((s) => s.roomId === room.id && Boolean(s.userId)).length;
        const moderatorsCount = store.moderators.filter((m) => m.roomId === room.id).length;
        const messagesCount = store.messages.filter((m) => m.roomId === room.id && !m.isDeleted).length;
        return {
          id: room.id,
          code: room.code,
          name: room.name,
          description: room.description,
          category: room.category,
          coverUrl: room.coverUrl,
          ownerId: room.ownerId,
          ownerDisplayId: owner.displayId,
          ownerName: owner.name,
          ownerEmail: owner.email,
          ownerAvatar: owner.avatar,
          ownerIsVerified: owner.isVerified,
          isPublic: room.isPublic,
          isLocked: room.isLocked,
          isFeatured: room.isFeatured,
          isHidden: Boolean(room.isHidden),
          isFrozen: Boolean(room.isFrozen),
          freezeReason: room.freezeReason || null,
          frozenAt: room.frozenAt || null,
          isRoomMuted: room.isRoomMuted,
          occupantsCount,
          occupiedSeatsCount,
          maxSeats: ROOM_MAX_SEATS,
          totalGiftsCoins: room.totalGiftsCoins || 0,
          moderatorsCount,
          messagesCount,
          createdAt: room.createdAt,
          lastActivityAt: room.lastActivityAt,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({ success: true, rooms: roomsList });
  });

  // A2. Toggle Room Public / Private
  app.post('/api/admin/rooms/:roomId/privacy', deps.verifyAdminAuth, async (req: Request, res: Response) => {
    await hydrateFromNeonIfNeeded().catch(() => {});
    const room = findRoomByCodeOrId(req.params.roomId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });

    const isPublic = Boolean(req.body?.isPublic);
    room.isPublic = isPublic;
    if (isPublic) {
      if (!room.pinHash) room.isLocked = false;
    } else {
      room.isLocked = true;
    }
    room.updatedAt = new Date().toISOString();
    saveStore();
    await persistRoomToNeon(room);

    recordAuditLog(
      room,
      { id: 'platform_admin', name: 'إدارة المنصة', role: 'admin' },
      isPublic ? 'admin_set_public' : 'admin_set_private',
      undefined,
      isPublic ? 'تحويل الغرفة إلى عامة' : 'تحويل الغرفة إلى خاصة'
    );
    pushRoomMessage(room, {
      senderRole: 'system',
      msgType: 'system',
      text: isPublic
        ? '🌐 تم تحويل الغرفة إلى غرفة عامة بواسطة إدارة المنصة'
        : '🔒 تم تحويل الغرفة إلى غرفة خاصة بواسطة إدارة المنصة',
    });
    broadcastRoomSettings(room);

    return res.json({
      success: true,
      isPublic: room.isPublic,
      isLocked: room.isLocked,
      message: isPublic ? 'تم تحويل الغرفة إلى عامة بنجاح' : 'تم تحويل الغرفة إلى خاصة بنجاح',
    });
  });

  // A3. Toggle Complete Hide From User-Facing Interface
  app.post('/api/admin/rooms/:roomId/hide', deps.verifyAdminAuth, async (req: Request, res: Response) => {
    await hydrateFromNeonIfNeeded().catch(() => {});
    const room = findRoomByCodeOrId(req.params.roomId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });

    const isHidden = Boolean(req.body?.isHidden);
    room.isHidden = isHidden;
    room.updatedAt = new Date().toISOString();
    saveStore();
    await persistRoomToNeon(room);

    recordAuditLog(
      room,
      { id: 'platform_admin', name: 'إدارة المنصة', role: 'admin' },
      isHidden ? 'admin_hide_room' : 'admin_unhide_room',
      undefined,
      isHidden ? 'إخفاء الغرفة بالكامل من الواجهة' : 'إعادة إظهار الغرفة في الواجهة'
    );
    broadcastRoomSettings(room);

    return res.json({
      success: true,
      isHidden: room.isHidden,
      message: isHidden ? 'تم إخفاء الغرفة بالكامل من الواجهة بنجاح' : 'تم إعادة إظهار الغرفة في الواجهة بنجاح',
    });
  });

  // A4. Administrative Freeze / Unfreeze Room
  app.post('/api/admin/rooms/:roomId/freeze', deps.verifyAdminAuth, async (req: Request, res: Response) => {
    await hydrateFromNeonIfNeeded().catch(() => {});
    const room = findRoomByCodeOrId(req.params.roomId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });

    const isFrozen = Boolean(req.body?.isFrozen);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '';
    const now = new Date().toISOString();

    room.isFrozen = isFrozen;
    room.freezeReason = isFrozen ? (reason || null) : null;
    room.frozenAt = isFrozen ? now : null;
    room.updatedAt = now;

    if (isFrozen) {
      freezeRoomLiveState(room);
    } else {
      saveStore();
    }
    await persistRoomToNeon(room);

    recordAuditLog(
      room,
      { id: 'platform_admin', name: 'إدارة المنصة', role: 'admin' },
      isFrozen ? 'admin_freeze_room' : 'admin_unfreeze_room',
      undefined,
      isFrozen ? (reason ? `تجميد إداري: ${reason}` : 'تجميد إداري للغرفة') : 'فك التجميد الإداري عن الغرفة'
    );

    return res.json({
      success: true,
      isFrozen: room.isFrozen,
      freezeReason: room.freezeReason,
      frozenAt: room.frozenAt,
      message: isFrozen ? 'تم تجميد الغرفة إدارياً وإخراج المتواجدين بنجاح' : 'تم فك التجميد الإداري عن الغرفة بنجاح',
    });
  });

  // A5. Change Primary Admin (Room Owner)
  app.post('/api/admin/rooms/:roomId/owner', deps.verifyAdminAuth, async (req: Request, res: Response) => {
    await hydrateFromNeonIfNeeded().catch(() => {});
    const room = findRoomByCodeOrId(req.params.roomId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });

    const identifier = String(req.body?.newOwnerIdentifier || '').trim();
    const keepPreviousAsHeadAdmin = Boolean(req.body?.keepPreviousAsHeadAdmin);
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد المستخدم الجديد كأدمن أساسي للغرفة' });
    }

    const users = deps.getStoredUsers();
    const lower = identifier.toLowerCase();
    const targetUser =
      deps.resolveUserRecordByAnyId(identifier) ||
      users.find(
        (u) =>
          u.id === identifier ||
          (u.displayId && u.displayId.toLowerCase() === lower) ||
          (u.email && u.email.toLowerCase() === lower)
      );

    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'تعذر العثور على المستخدم المحدد' });
    }
    if (targetUser.isBanned) {
      return res.status(400).json({ success: false, message: 'لا يمكن تعيين مستخدم محظور كأدمن أساسي للغرفة' });
    }
    if (targetUser.id === room.ownerId) {
      return res.status(400).json({ success: false, message: 'هذا المستخدم هو بالفعل الأدمن الأساسي للغرفة' });
    }

    return withRoomLock(room.id, async () => {
      const store = loadStore();
      const pool = deps.getNeonPool();
      const previousOwnerId = room.ownerId;
      const now = new Date().toISOString();

      room.ownerId = targetUser.id;
      room.updatedAt = now;

      // Remove any moderator row or active ban for the new primary owner
      store.moderators = store.moderators.filter((m) => !(m.roomId === room.id && m.userId === targetUser.id));
      store.bans = store.bans.filter((b) => !(b.roomId === room.id && b.userId === targetUser.id));
      if (pool) {
        await pool.query('DELETE FROM room_moderators WHERE room_id = $1 AND user_id = $2', [room.id, targetUser.id]).catch(() => {});
        await pool.query('DELETE FROM room_bans WHERE room_id = $1 AND user_id = $2', [room.id, targetUser.id]).catch(() => {});
      }

      if (keepPreviousAsHeadAdmin && previousOwnerId && previousOwnerId !== targetUser.id) {
        const prevModIdx = store.moderators.findIndex((m) => m.roomId === room.id && m.userId === previousOwnerId);
        const headPerms = getEffectivePermissions('head_admin');
        if (prevModIdx >= 0) {
          store.moderators[prevModIdx].role = 'head_admin';
          store.moderators[prevModIdx].permissions = headPerms;
          store.moderators[prevModIdx].updatedAt = now;
        } else {
          store.moderators.push({
            id: crypto.randomUUID(),
            roomId: room.id,
            userId: previousOwnerId,
            role: 'head_admin',
            permissions: headPerms,
            assignedBy: targetUser.id,
            createdAt: now,
            updatedAt: now,
          });
        }
        if (pool) {
          await pool
            .query(
              `INSERT INTO room_moderators (id, room_id, user_id, role, permissions, assigned_by, created_at, updated_at)
               VALUES ($1, $2, $3, 'head_admin', $4::jsonb, $5, $6, $6)
               ON CONFLICT (room_id, user_id) DO UPDATE SET
                role = 'head_admin',
                permissions = EXCLUDED.permissions,
                updated_at = EXCLUDED.updated_at`,
              [crypto.randomUUID(), room.id, previousOwnerId, JSON.stringify(headPerms), targetUser.id, now]
            )
            .catch(() => {});
        }
      }

      saveStore();
      await persistRoomToNeon(room);

      const newOwnerBasic = resolveUserBasic(targetUser.id);
      recordAuditLog(
        room,
        { id: 'platform_admin', name: 'إدارة المنصة', role: 'admin' },
        'admin_change_owner',
        { id: targetUser.id, name: newOwnerBasic.name },
        keepPreviousAsHeadAdmin ? 'نقل ملكية الغرفة مع إبقاء السابق كمشرف رئيسي' : 'نقل ملكية الغرفة بالكامل'
      );
      pushRoomMessage(room, {
        senderRole: 'system',
        msgType: 'system',
        text: `👑 تم تعيين ${newOwnerBasic.name} كأدمن أساسي للغرفة بواسطة إدارة المنصة`,
      });
      broadcastRoomSettings(room);
      broadcastSeatsAndOccupants(room);

      return res.json({
        success: true,
        ownerId: room.ownerId,
        ownerName: newOwnerBasic.name,
        ownerDisplayId: newOwnerBasic.displayId,
        message: `تم تغيير الأدمن الأساسي للغرفة إلى ${newOwnerBasic.name} بنجاح`,
      });
    });
  });

  // A6. Permanently Delete Room from Admin Panel
  app.delete('/api/admin/rooms/:roomId', deps.verifyAdminAuth, async (req: Request, res: Response) => {
    await hydrateFromNeonIfNeeded().catch(() => {});
    const room = findRoomByCodeOrId(req.params.roomId);
    if (!room) return res.status(404).json({ success: false, message: 'الغرفة غير موجودة' });

    await permanentlyDeleteRoom(room);
    return res.json({ success: true, message: 'تم حذف الغرفة نهائياً بنجاح' });
  });

  // =========================================================================
  // WEBSOCKET SERVER (/ws/rooms) — Authoritative Real-Time Voice Signaling, Chat, Music & Games
  // =========================================================================
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request: IncomingMessage, socket, head) => {
    try {
      const reqUrl = new URL(request.url || '/', 'http://localhost');
      if (reqUrl.pathname !== '/ws/rooms') return;

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, reqUrl);
      });
    } catch {
      socket.destroy();
    }
  });

  // Heartbeat every 25s
  const heartbeatInterval = setInterval(() => {
    for (const [sid, client] of Array.from(socketsById.entries())) {
      if (!client.isAlive) {
        try {
          client.ws.terminate();
        } catch {}
        handleSocketDisconnect(client);
        socketsById.delete(sid);
        continue;
      }
      client.isAlive = false;
      try {
        client.ws.ping();
      } catch {}
    }
  }, 25_000);

  function handleSocketDisconnect(client: LiveClientSocket) {
    const room = findRoomByCodeOrId(client.roomId);
    const rt = liveRooms.get(client.roomId);
    if (!rt) return;
    const occ = rt.occupants.get(client.userId);
    if (!occ) return;
    occ.sockets.delete(client.socketId);

    if (occ.sockets.size === 0) {
      // User has no remaining active sockets for this room — start 25s grace period
      const store = loadStore();
      const seat = room ? store.seats.find((s) => s.roomId === room.id && s.userId === client.userId) : undefined;
      if (seat && room) {
        occ.reconnecting = true;
        occ.isSpeaking = false;
        broadcastSeatsAndOccupants(room);

        const existingTimer = rt.disconnectTimers.get(client.userId);
        if (existingTimer) clearTimeout(existingTimer);

        const timer = setTimeout(() => {
          rt.disconnectTimers.delete(client.userId);
          const currentOcc = rt.occupants.get(client.userId);
          if (currentOcc && currentOcc.sockets.size === 0) {
            vacateUserSeat(room, client.userId, false);
            rt.occupants.delete(client.userId);
            rt.queue = rt.queue.filter((q) => q.userId !== client.userId);
            broadcastSeatsAndOccupants(room);
          }
        }, ROOM_RECONNECT_GRACE_MS);
        rt.disconnectTimers.set(client.userId, timer);
      } else {
        // Listener not seated — clean up immediately
        rt.occupants.delete(client.userId);
        rt.queue = rt.queue.filter((q) => q.userId !== client.userId);
        if (room) broadcastSeatsAndOccupants(room);
      }
    }
  }

  wss.on('connection', async (ws: WebSocket, _req: IncomingMessage, reqUrl: URL) => {
    await hydrateFromNeonIfNeeded().catch(() => {});

    const token = reqUrl.searchParams.get('token') || '';
    const roomCodeOrId = reqUrl.searchParams.get('roomId') || '';
    const inviteToken = reqUrl.searchParams.get('invite') || '';

    const auth = authenticateToken(token);
    if (!auth.user) {
      ws.send(JSON.stringify({ type: 'error', code: 'UNAUTHORIZED', message: auth.error || 'غير مصرح' }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    const room = findRoomByCodeOrId(roomCodeOrId);
    if (!room) {
      ws.send(JSON.stringify({ type: 'error', code: 'NOT_FOUND', message: 'الغرفة غير موجودة' }));
      ws.close(4004, 'Not found');
      return;
    }

    if (room.isFrozen) {
      ws.send(
        JSON.stringify({
          type: 'room:frozen',
          reason: room.freezeReason || null,
          frozenAt: room.frozenAt || null,
          message: room.freezeReason
            ? `هذه الغرفة مجمّدة إدارياً: ${room.freezeReason}`
            : 'هذه الغرفة مجمّدة إدارياً من قبل إدارة المنصة',
        })
      );
      ws.close(4011, 'Room frozen');
      return;
    }

    const activeBan = getActiveBan(room.id, auth.user.id);
    if (activeBan && !auth.isPlatformAdmin && room.ownerId !== auth.user.id) {
      ws.send(
        JSON.stringify({
          type: 'room:kicked',
          banType: activeBan.banType,
          reason: activeBan.reason || 'غير مسموح لك بدخول الغرفة',
          expiresAt: activeBan.expiresAt,
        })
      );
      ws.close(4003, 'Banned');
      return;
    }

    const { role, permissions } = getUserRoomRoleAndPerms(room, auth.user.id, auth.isPlatformAdmin);
    const store = loadStore();
    const validInvite = inviteToken
      ? store.invites.some(
          (inv) =>
            inv.roomId === room.id &&
            inv.token === inviteToken &&
            new Date(inv.expiresAt).getTime() > Date.now() &&
            (!inv.targetUserId || inv.targetUserId === auth.user.id)
        )
      : false;

    const rt = getLiveRoom(room.id);
    const alreadyInRoom = rt.occupants.has(auth.user.id);
    if ((room.isLocked || !room.isPublic) && role === 'member' && !auth.isPlatformAdmin && !validInvite && !alreadyInRoom) {
      ws.send(JSON.stringify({ type: 'error', code: 'PIN_REQUIRED', message: 'الغرفة مقفلة وتتطلب الرمز السري' }));
      ws.close(4002, 'PIN Required');
      return;
    }

    const socketId = crypto.randomUUID();
    const clientRecord: LiveClientSocket = {
      ws,
      userId: auth.user.id,
      roomId: room.id,
      socketId,
      isAlive: true,
    };
    socketsById.set(socketId, clientRecord);

    // Clear any pending disconnect grace timer if user reconnected!
    const pendingGrace = rt.disconnectTimers.get(auth.user.id);
    if (pendingGrace) {
      clearTimeout(pendingGrace);
      rt.disconnectTimers.delete(auth.user.id);
    }

    let isFreshJoin = false;
    let occ = rt.occupants.get(auth.user.id);
    if (!occ) {
      isFreshJoin = true;
      occ = {
        userId: auth.user.id,
        joinedAt: new Date().toISOString(),
        isSpeaking: false,
        reconnecting: false,
        sockets: new Set([socketId]),
        lastSpeakEmitMs: 0,
        recentChatTimestamps: [],
        lastChatText: '',
        lastChatAtMs: 0,
      };
      rt.occupants.set(auth.user.id, occ);
    } else {
      occ.sockets.add(socketId);
      occ.reconnecting = false;
    }

    ws.on('pong', () => {
      clientRecord.isAlive = true;
    });

    // Send initial authoritative room snapshot
    const messages = store.messages.filter((m) => m.roomId === room.id && !m.isDeleted).slice(-120);
    const events = store.events.filter((e) => e.roomId === room.id && e.status !== 'cancelled');

    ws.send(
      JSON.stringify({
        type: 'room:snapshot',
        room: buildRoomDetail(room, auth.user.id, auth.isPlatformAdmin),
        seats: buildRoomSeatsSnapshot(room),
        occupants: buildOccupantsSnapshot(room),
        queue: rt.queue,
        messages,
        events,
        music: room.musicState || DEFAULT_MUSIC_STATE,
        game: rt.game.state,
      })
    );

    if (isFreshJoin) {
      pushRoomMessage(room, {
        senderId: auth.user.id,
        senderName: auth.user.name,
        senderRole: 'system',
        msgType: 'system',
        text: `👋 انضم ${auth.user.name} إلى الغرفة`,
      });
    }
    broadcastSeatsAndOccupants(room);

    ws.on('message', async (raw) => {
      let data: any;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (!data || typeof data.type !== 'string') return;

      const currentAuth = authenticateToken(token);
      if (!currentAuth.user) {
        ws.close(4001, 'Session expired');
        return;
      }
      const user = currentAuth.user;
      const latestRoom = findRoomByCodeOrId(room.id);
      if (!latestRoom) {
        ws.close(4004, 'Room deleted');
        return;
      }
      if (latestRoom.isFrozen) {
        ws.send(
          JSON.stringify({
            type: 'room:frozen',
            reason: latestRoom.freezeReason || null,
            frozenAt: latestRoom.frozenAt || null,
            message: latestRoom.freezeReason
              ? `هذه الغرفة مجمّدة إدارياً: ${latestRoom.freezeReason}`
              : 'هذه الغرفة مجمّدة إدارياً من قبل إدارة المنصة',
          })
        );
        ws.close(4011, 'Room frozen');
        return;
      }
      const currentBan = getActiveBan(room.id, user.id);
      if (currentBan && !currentAuth.isPlatformAdmin && room.ownerId !== user.id) {
        ws.send(JSON.stringify({
          type: 'room:kicked',
          banType: currentBan.banType,
          reason: currentBan.reason || 'غير مسموح لك بالبقاء في الغرفة',
          expiresAt: currentBan.expiresAt,
        }));
        ws.close(4003, 'Banned');
        return;
      }
      if (!rt.occupants.has(user.id)) {
        ws.close(4003, 'Not an occupant');
        return;
      }
      const { role: curRole, permissions: curPerms } = getUserRoomRoleAndPerms(room, user.id, currentAuth.isPlatformAdmin);

      switch (data.type) {
        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
          break;
        }

        case 'mic:toggle': {
          const desiredOpen = Boolean(data.isOpen);
          await withRoomLock(room.id, async () => {
            const seat = store.seats.find((s) => s.roomId === room.id && s.userId === user.id);
            if (!seat) {
              ws.send(JSON.stringify({ type: 'error', message: 'يجب الجلوس على مقعد صوتي أولاً' }));
              return;
            }
            if (desiredOpen && room.isRoomMuted) {
              ws.send(JSON.stringify({ type: 'error', message: 'الغرفة مكتومة بالكامل حالياً من الإدارة' }));
              return;
            }
            if (desiredOpen && seat.isMutedByMod) {
              ws.send(JSON.stringify({ type: 'error', message: 'تم كتم المايك الخاص بك من الإدارة' }));
              return;
            }
            seat.isMutedBySelf = !desiredOpen;
            if (!desiredOpen && occ) occ.isSpeaking = false;
            saveStore();
            persistSeatToNeon(seat);
            broadcastSeatsAndOccupants(room);
          });
          break;
        }

        case 'mic:speaking': {
          const speaking = Boolean(data.isSpeaking);
          const seat = store.seats.find((s) => s.roomId === room.id && s.userId === user.id);
          const allowedSpeak = Boolean(seat && !seat.isMutedBySelf && !seat.isMutedByMod && !room.isRoomMuted);
          if (!occ) break;
          const nowMs = Date.now();
          if (nowMs - occ.lastSpeakEmitMs < 80) break;
          occ.lastSpeakEmitMs = nowMs;
          const nextSpeak = allowedSpeak ? speaking : false;
          if (occ.isSpeaking !== nextSpeak) {
            occ.isSpeaking = nextSpeak;
            broadcastToRoom(room.id, {
              type: 'mic:speaking',
              userId: user.id,
              seatNumber: seat?.seatNumber || null,
              isSpeaking: nextSpeak,
            });
          }
          break;
        }

        case 'rtc:offer':
        case 'rtc:answer':
        case 'rtc:ice-candidate': {
          const targetUserId = String(data.targetUserId || '').trim();
          if (!targetUserId || targetUserId === user.id || !rt.occupants.has(targetUserId)) break;
          sendToUserInRoom(room.id, targetUserId, {
            type: data.type,
            fromUserId: user.id,
            sdp: data.sdp,
            candidate: data.candidate,
          });
          break;
        }

        case 'chat:send': {
          const text = String(data.text || '').trim();
          if (!text) break;
          if (text.length > 600) {
            ws.send(JSON.stringify({ type: 'error', message: 'الرسالة طويلة جداً (الحد الأقصى 600 حرف)' }));
            break;
          }
          if (!room.chatEnabled && curRole === 'member') {
            ws.send(JSON.stringify({ type: 'error', message: 'الدردشة مغلقة في إعدادات الغرفة' }));
            break;
          }
          if (room.chatPaused && curRole === 'member') {
            ws.send(JSON.stringify({ type: 'error', message: 'الدردشة متوقفة مؤقتاً من الإدارة' }));
            break;
          }
          if (!occ) break;
          const nowMs = Date.now();
          occ.recentChatTimestamps = occ.recentChatTimestamps.filter((ts) => nowMs - ts < 5000);
          if (occ.recentChatTimestamps.length >= 5) {
            ws.send(JSON.stringify({ type: 'error', message: 'يرجى التمهل قليلاً قبل إرسال رسالة أخرى' }));
            break;
          }
          if (occ.lastChatText === text && nowMs - occ.lastChatAtMs < 3000) {
            ws.send(JSON.stringify({ type: 'error', message: 'تم تجاهل الرسالة المكررة' }));
            break;
          }
          occ.recentChatTimestamps.push(nowMs);
          occ.lastChatText = text;
          occ.lastChatAtMs = nowMs;

          pushRoomMessage(room, {
            senderId: user.id,
            senderName: user.name,
            senderAvatar: user.photoUrl || null,
            senderRole: curRole,
            senderIsVerified: Boolean(user.isVerified),
            senderFrameId: user.equippedFrameId || null,
            msgType: 'text',
            text,
          });
          break;
        }

        case 'music:control': {
          const canControlMusic =
            curRole === 'owner' ||
            curRole === 'head_admin' ||
            (room.musicPermission === 'moderators' && curPerms.manageMusic) ||
            currentAuth.isPlatformAdmin;
          if (!canControlMusic) {
            ws.send(JSON.stringify({ type: 'error', message: 'ليس لديك صلاحية التحكم بموسيقى الغرفة' }));
            break;
          }

          const subAction = String(data.action || '').trim(); // 'play' | 'pause' | 'next' | 'select' | 'stop'
          const curMusic = room.musicState || { ...DEFAULT_MUSIC_STATE };
          const curIdx = Math.max(0, ROOM_MUSIC_PLAYLIST.findIndex((t) => t.id === curMusic.trackId));
          const nowMs = Date.now();
          let nextState: RoomMusicState = { ...curMusic };
          let trackChanged = false;

          if (subAction === 'select') {
            const track = ROOM_MUSIC_PLAYLIST.find((t) => t.id === data.trackId) || ROOM_MUSIC_PLAYLIST[0];
            trackChanged = track.id !== curMusic.trackId;
            nextState = {
              isPlaying: true,
              trackId: track.id,
              trackTitleAr: track.titleAr,
              trackTitleEn: track.titleEn,
              artist: track.artist,
              startedAtMs: nowMs,
              offsetSec: 0,
              controlledBy: user.id,
              controlledByName: user.name,
            };
          } else if (subAction === 'next') {
            const nextTrack = ROOM_MUSIC_PLAYLIST[(curIdx + 1) % ROOM_MUSIC_PLAYLIST.length];
            trackChanged = true;
            nextState = {
              isPlaying: true,
              trackId: nextTrack.id,
              trackTitleAr: nextTrack.titleAr,
              trackTitleEn: nextTrack.titleEn,
              artist: nextTrack.artist,
              startedAtMs: nowMs,
              offsetSec: 0,
              controlledBy: user.id,
              controlledByName: user.name,
            };
          } else if (subAction === 'play') {
            const track = ROOM_MUSIC_PLAYLIST[curIdx] || ROOM_MUSIC_PLAYLIST[0];
            nextState = {
              ...curMusic,
              trackId: track.id,
              trackTitleAr: track.titleAr,
              trackTitleEn: track.titleEn,
              artist: track.artist,
              isPlaying: true,
              startedAtMs: nowMs,
              controlledBy: user.id,
              controlledByName: user.name,
            };
          } else if (subAction === 'pause') {
            const elapsedSec = curMusic.isPlaying ? Math.max(0, (nowMs - curMusic.startedAtMs) / 1000) : 0;
            const trackDur = ROOM_MUSIC_PLAYLIST[curIdx]?.durationSec || 180;
            nextState = {
              ...curMusic,
              isPlaying: false,
              offsetSec: (curMusic.offsetSec + elapsedSec) % trackDur,
              startedAtMs: nowMs,
              controlledBy: user.id,
              controlledByName: user.name,
            };
          } else if (subAction === 'stop') {
            nextState = {
              ...curMusic,
              isPlaying: false,
              offsetSec: 0,
              startedAtMs: nowMs,
              controlledBy: user.id,
              controlledByName: user.name,
            };
          }

          room.musicState = nextState;
          room.updatedAt = new Date().toISOString();
          saveStore();
          persistRoomToNeon(room);
          broadcastToRoom(room.id, { type: 'music:state', music: nextState });
          if (trackChanged || (subAction === 'play' && !curMusic.isPlaying)) {
            pushRoomMessage(room, {
              senderRole: 'system',
              msgType: 'system',
              text: `🎵 تم تشغيل: ${nextState.trackTitleAr} — ${nextState.artist || 'SOUL-X'}`,
            });
          }
          break;
        }

        case 'game:action': {
          const subAction = String(data.action || '').trim(); // 'start' | 'answer' | 'next' | 'end'
          if (subAction === 'answer') {
            const gameRt = rt.game;
            if (gameRt.state.status !== 'active' || !gameRt.state.question) break;
            if (gameRt.state.answeredUserIds.includes(user.id)) break; // One answer per round per user

            const rawAns = String(data.answer || '').trim().toLowerCase();
            if (!rawAns) break;
            const q = gameRt.questions[gameRt.state.roundNumber - 1];
            if (!q) break;

            const isCorrect = q.acceptedAnswers.some((acc) => acc.toLowerCase() === rawAns);
            gameRt.state.answeredUserIds.push(user.id);

            if (isCorrect) {
              const elapsedSec = Math.max(0, (Date.now() - gameRt.state.roundStartedAtMs) / 1000);
              const speedBonus = Math.max(5, Math.round((gameRt.state.roundDurationSec - elapsedSec) * 2));
              const pts = 10 + speedBonus;
              gameRt.scores.set(user.id, (gameRt.scores.get(user.id) || 0) + pts);

              const sorted = Array.from(gameRt.scores.entries())
                .map(([uid, score]) => {
                  const u = resolveUserBasic(uid);
                  return { userId: uid, name: u.name, avatar: u.avatar, score };
                })
                .sort((a, b) => b.score - a.score);
              gameRt.state.leaderboard = sorted;

              // Speed challenge ends round immediately upon first correct answer
              if (gameRt.state.gameType === 'speed_challenge') {
                revealRoundResult(room, rt);
                break;
              }
            }
            broadcastToRoom(room.id, { type: 'game:state', game: gameRt.state });
            break;
          }

          // Host permissions check
          const canManageGames =
            room.gamesPermission === 'all' ||
            curRole === 'owner' ||
            curRole === 'head_admin' ||
            (room.gamesPermission === 'moderators' && curPerms.manageGames) ||
            currentAuth.isPlatformAdmin;
          if (!canManageGames) {
            ws.send(JSON.stringify({ type: 'error', message: 'ليس لديك صلاحية إدارة الألعاب داخل الغرفة' }));
            break;
          }

          if (subAction === 'start') {
            const gType = String(data.gameType || 'quiz') as RoomMiniGameType;
            const bank = ROOM_GAMES_BANK[gType];
            if (!bank) break;
            const shuffled = [...bank].sort(() => Math.random() - 0.5).slice(0, 4);
            rt.game.questions = shuffled;
            rt.game.scores = new Map();
            rt.game.state = {
              status: 'active',
              gameType: gType,
              gameId: `rgame-${Date.now()}`,
              startedBy: user.id,
              startedByName: user.name,
              roundNumber: 0,
              totalRounds: shuffled.length,
              question: null,
              roundStartedAtMs: Date.now(),
              roundDurationSec: 15,
              answeredUserIds: [],
              winnerName: null,
              leaderboard: [],
            };
            const gameNames: Record<RoomMiniGameType, string> = {
              quiz: 'أسئلة عامة',
              true_false: 'صح أو خطأ',
              word_guess: 'تخمين الكلمة',
              who_am_i: 'من أنا؟',
              speed_challenge: 'تحدي سرعة الإجابة',
            };
            pushRoomMessage(room, {
              senderRole: 'system',
              msgType: 'system',
              text: `🎮 بدأت لعبة "${gameNames[gType]}" بقيادة ${user.name}!`,
            });
            startRoundForRoom(room, rt);
          } else if (subAction === 'next') {
            revealRoundResult(room, rt);
          } else if (subAction === 'end') {
            if (rt.game.roundTimer) {
              clearTimeout(rt.game.roundTimer);
              rt.game.roundTimer = null;
            }
            rt.game.state = createIdleGameState();
            broadcastToRoom(room.id, { type: 'game:state', game: rt.game.state });
          }
          break;
        }

        case 'room:leave': {
          const seatRemoved = vacateUserSeat(room, user.id, false);
          rt.queue = rt.queue.filter((q) => q.userId !== user.id);
          rt.occupants.delete(user.id);
          const pendingTimer = rt.disconnectTimers.get(user.id);
          if (pendingTimer) {
            clearTimeout(pendingTimer);
            rt.disconnectTimers.delete(user.id);
          }
          if (!seatRemoved) {
            pushRoomMessage(room, {
              senderRole: 'system',
              msgType: 'system',
              text: `غادر ${user.name} الغرفة`,
            });
          }
          broadcastSeatsAndOccupants(room);
          ws.close(1000, 'Left room');
          socketsById.delete(socketId);
          break;
        }
      }
    });

    ws.on('close', () => {
      if (socketsById.has(socketId)) {
        socketsById.delete(socketId);
        handleSocketDisconnect(clientRecord);
      }
    });
  });

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });
}
