import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { execSync } from 'child_process';
import WebSocket from 'ws';
import sharp from 'sharp';
import { Pool } from 'pg';

const BASE = 'http://127.0.0.1:3000';
const WS_BASE = 'ws://127.0.0.1:3000';
const STATE_FILE = path.resolve(process.cwd(), '.audit_state.json');
const USERS_FILE = path.resolve(process.cwd(), 'data/users.json');
const SESSIONS_FILE = path.resolve(process.cwd(), 'data/sessions.json');
const ROOMS_FILE = path.resolve(process.cwd(), 'data/rooms_data.json');

interface TestUser {
  id: string;
  displayId: string;
  email: string;
  name: string;
  token: string;
  password: string;
}

function getServerStats(): { pid: number | null; rssMb: number; cpuPct: number; vszMb: number } {
  try {
    const out = execSync("ps -eo pid,pcpu,rss,vsz,args | grep -E 'node .*server\\.ts' | grep -v grep | sort -k3 -nr | head -n 1", {
      encoding: 'utf-8',
    }).trim();
    if (!out) return { pid: null, rssMb: 0, cpuPct: 0, vszMb: 0 };
    const parts = out.split(/\s+/);
    const pid = Number(parts[0]) || null;
    const cpuPct = Number(parts[1]) || 0;
    const rssKb = Number(parts[2]) || 0;
    const vszKb = Number(parts[3]) || 0;
    return {
      pid,
      rssMb: Math.round((rssKb / 1024) * 10) / 10,
      cpuPct,
      vszMb: Math.round((vszKb / 1024) * 10) / 10,
    };
  } catch {
    return { pid: null, rssMb: 0, cpuPct: 0, vszMb: 0 };
  }
}

async function apiJson(pathname: string, opts: { method?: string; token?: string; body?: any } = {}) {
  const headers: Record<string, string> = {};
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${pathname}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  let json: any = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, headers: res.headers, json };
}

async function createCoverFormData(fields: Record<string, string>, imgBuf: Buffer, fileName = 'cover.png', mime = 'image/png') {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  fd.append('cover', new Blob([new Uint8Array(imgBuf)], { type: mime }), fileName);
  return fd;
}

async function registerUser(tag: string, initialCoins = 0): Promise<TestUser> {
  const rnd = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const email = `audit_${tag}_${rnd}@audit.local`;
  const password = `Pass_${rnd}!`;
  const name = `Audit_${tag}`;
  const res = await apiJson('/api/auth/register', {
    method: 'POST',
    body: {
      email,
      name,
      password,
      birthDate: '1996-05-15',
      gender: 'male',
      country: 'SA',
    },
  });
  assert.strictEqual(res.status, 200, `Register failed for ${tag}: ${JSON.stringify(res.json)}`);
  const userId = res.json.user.id;
  const displayId = res.json.user.displayId;
  const token = res.json.token;

  if (initialCoins > 0) {
    const dep = await apiJson('/api/wallet/deposit-coins', {
      method: 'POST',
      body: { userId, coinsAmount: initialCoins },
    });
    assert.strictEqual(dep.status, 200, `Coin deposit failed for ${tag}: ${JSON.stringify(dep.json)}`);
  }

  return { id: userId, displayId, email, name, token, password };
}

async function getUserBalances(userId: string): Promise<{ coins: number; diamonds: number }> {
  const res = await apiJson(`/api/wallet/balance?userId=${encodeURIComponent(userId)}`);
  assert.strictEqual(res.status, 200, `Wallet balance fetch failed for ${userId}`);
  return {
    coins: Number(res.json?.coinsBalance ?? res.json?.coins ?? 0),
    diamonds: Number(res.json?.walletBalance ?? res.json?.balance ?? 0),
  };
}

function connectWs(
  roomCode: string,
  token: string,
  invite?: string
): Promise<{ ws: WebSocket; snapshot: any; messages: any[]; closeInfo: Promise<{ code: number; reason: string }> }> {
  return new Promise((resolve, reject) => {
    const q = new URLSearchParams({ roomId: roomCode, token });
    if (invite) q.set('invite', invite);
    const ws = new WebSocket(`${WS_BASE}/ws/rooms?${q.toString()}`);
    const messages: any[] = [];
    let resolved = false;
    let closeResolve!: (v: { code: number; reason: string }) => void;
    const closeInfo = new Promise<{ code: number; reason: string }>((r) => {
      closeResolve = r;
    });

    const timeout = setTimeout(() => {
      if (!resolved) reject(new Error(`WS timeout connecting to ${roomCode}`));
    }, 8000);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        messages.push({ ...msg, _rxAt: performance.now() });
        if (!resolved && msg.type === 'room:snapshot') {
          resolved = true;
          clearTimeout(timeout);
          resolve({ ws, snapshot: msg, messages, closeInfo });
        }
      } catch {}
    });

    ws.on('close', (code, buf) => {
      closeResolve({ code, reason: buf.toString() });
      if (!resolved) {
        clearTimeout(timeout);
        reject(new Error(`WS closed early with ${code}: ${buf.toString()}`));
      }
    });

    ws.on('error', (err) => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  });
}

async function cleanNeonTestRows(removeUserIds: Set<string>) {
  const cfgPath = path.resolve(process.cwd(), 'data/neon_config.json');
  if (!fs.existsSync(cfgPath)) return;
  let connStr = '';
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    connStr = cfg?.connectionString || cfg?.databaseUrl || '';
  } catch {}
  if (!connStr) return;
  const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  try {
    const ids = Array.from(removeUserIds);
    const profRes = await pool.query(
      "SELECT id FROM profiles WHERE LOWER(email) LIKE '%@audit.local' OR LOWER(email) LIKE '%@test.soulx'"
    );
    for (const r of profRes.rows || []) {
      if (r.id && !ids.includes(r.id)) ids.push(r.id);
    }
    if (ids.length > 0) {
      await pool.query('DELETE FROM rooms WHERE owner_id = ANY($1::text[])', [ids]).catch(() => {});
      await pool.query('DELETE FROM room_idempotency_keys WHERE user_id = ANY($1::text[])', [ids]).catch(() => {});
      await pool.query('DELETE FROM profiles WHERE id = ANY($1::text[])', [ids]).catch(() => {});
    }
  } catch {
  } finally {
    await pool.end().catch(() => {});
  }
}

async function cleanupOldAuditArtifacts() {
  const auditIds = new Set<string>();
  if (fs.existsSync(USERS_FILE)) {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    users
      .filter((u: any) => {
        const em = String(u.email || '').toLowerCase();
        return em.endsWith('@audit.local') || em.endsWith('@test.soulx');
      })
      .forEach((u: any) => auditIds.add(u.id));
    if (auditIds.size > 0) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users.filter((u: any) => !auditIds.has(u.id)), null, 2), 'utf-8');
      if (fs.existsSync(SESSIONS_FILE)) {
        const s = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
        if (Array.isArray(s)) {
          fs.writeFileSync(SESSIONS_FILE, JSON.stringify(s.filter((x: any) => !auditIds.has(x.userId)), null, 2), 'utf-8');
        }
      }
    }
  }
  if (fs.existsSync(ROOMS_FILE)) {
    const rStore = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf-8'));
    const removeRoomIds = new Set<string>(
      (rStore.rooms || [])
        .filter((r: any) => auditIds.has(r.ownerId) || String(r.name || '').includes('الاختبارية') || String(r.name || '').includes('غرفة التدقيق') || String(r.name || '').includes('غرفة ضغط') || String(r.name || '').includes('غرفة اختبار'))
        .map((r: any) => r.id)
    );
    if (removeRoomIds.size > 0 || auditIds.size > 0) {
      rStore.rooms = (rStore.rooms || []).filter((r: any) => !removeRoomIds.has(r.id));
      rStore.seats = (rStore.seats || []).filter((s: any) => !removeRoomIds.has(s.roomId));
      rStore.moderators = (rStore.moderators || []).filter((m: any) => !removeRoomIds.has(m.roomId));
      rStore.bans = (rStore.bans || []).filter((b: any) => !removeRoomIds.has(b.roomId));
      rStore.messages = (rStore.messages || []).filter((m: any) => !removeRoomIds.has(m.roomId));
      rStore.favorites = (rStore.favorites || []).filter((f: any) => !removeRoomIds.has(f.roomId));
      rStore.events = (rStore.events || []).filter((e: any) => !removeRoomIds.has(e.roomId));
      rStore.auditLogs = (rStore.auditLogs || []).filter((a: any) => !removeRoomIds.has(a.roomId));
      rStore.invites = (rStore.invites || []).filter((i: any) => !removeRoomIds.has(i.roomId));
      fs.writeFileSync(ROOMS_FILE, JSON.stringify(rStore, null, 2), 'utf-8');
    }
  }
  await cleanNeonTestRows(auditIds);
}

async function runPhase1() {
  await cleanupOldAuditArtifacts();
  console.log('=== PHASE 1: SOUL-X ROOMS COMPREHENSIVE AUDIT & STRESS BENCHMARK ===');
  const results: Record<string, any> = {};
  const createdUsers: TestUser[] = [];
  const createdRoomCodes: string[] = [];

  const validPng = await sharp({
    create: { width: 320, height: 240, channels: 3, background: { r: 120, g: 40, b: 220 } },
  })
    .png()
    .toBuffer();

  // 0. Baseline existing SOUL-X non-regression smoke check
  const settingsRes = await apiJson('/api/app/settings');
  const rtcRes = await apiJson('/api/rooms/rtc-config');
  results.nonRegressionBaseline = {
    appSettingsStatus: settingsRes.status,
    rtcConfigStatus: rtcRes.status,
    rtcTurnConfigured: rtcRes.json?.turnConfigured,
    iceServersCount: rtcRes.json?.iceServers?.length || 0,
  };
  assert.strictEqual(settingsRes.status, 200);
  assert.strictEqual(rtcRes.status, 200);

  // Register core test actors
  const owner = await registerUser('owner', 80000);
  const headAdmin = await registerUser('head', 10000);
  const mod = await registerUser('mod', 10000);
  const member = await registerUser('member', 10000);
  const member2 = await registerUser('member2', 5000);
  const bannedUser = await registerUser('banned', 1000);
  const poorUser = await registerUser('poor', 10000);
  createdUsers.push(owner, headAdmin, mod, member, member2, bannedUser, poorUser);

  // Verify existing wallet endpoint still works for newly registered owner
  const walletCheck = await apiJson(`/api/wallet/balance?userId=${encodeURIComponent(owner.id)}`, {
    token: owner.token,
  });
  assert.strictEqual(walletCheck.status, 200);

  // 1. AuthN checks (public listing returns summaries; create/detail/WS require auth)
  const unauthCreate = await apiJson('/api/rooms', { method: 'POST', body: { name: 'NoAuth' } });
  assert.strictEqual(unauthCreate.status, 401);
  const badTokenRooms = await apiJson('/api/rooms/SX-000000', { token: 'invalid-jwt-token-xyz' });
  assert.strictEqual(badTokenRooms.status, 401);

  let wsUnauthCode = 0;
  await new Promise<void>((res) => {
    const w = new WebSocket(`${WS_BASE}/ws/rooms?roomId=SX-000000`);
    w.on('close', (c) => {
      wsUnauthCode = c;
      res();
    });
  });
  assert.strictEqual(wsUnauthCode, 4001);
  results.authnChecks = { unauthCreateHttp: 401, invalidTokenDetailHttp: 401, unauthWsClose: wsUnauthCode };

  // 2. Cover upload abuse & Insufficient Coins & Idempotent Room Creation (5 parallel requests)
  const poorFd = await createCoverFormData({ name: 'Poor Room', category: 'chat' }, validPng);
  const poorCreate = await fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${poorUser.token}` },
    body: poorFd,
  });
  assert.strictEqual(poorCreate.status, 400);

  const fakeImgFd = await createCoverFormData({ name: 'Fake Img Room', category: 'chat' }, Buffer.from('not-an-image-bytes'), 'bad.png', 'image/png');
  const fakeImgRes = await fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${owner.token}` },
    body: fakeImgFd,
  });
  assert.strictEqual(fakeImgRes.status, 400);

  const bigBuf = Buffer.alloc(5 * 1024 * 1024 + 512, 0x41);
  const bigFd = await createCoverFormData({ name: 'Big Img Room', category: 'chat' }, bigBuf, 'big.png', 'image/png');
  const bigRes = await fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${owner.token}` },
    body: bigFd,
  });
  assert.strictEqual(bigRes.status, 413, `Expected 413 for >5MB cover, got ${bigRes.status}`);

  const idemCreateKey = `audit_create_${Date.now()}`;
  const parallelCreate = await Promise.all(
    Array.from({ length: 5 }, async () => {
      const fd = await createCoverFormData(
        { name: 'غرفة التدقيق الرئيسية', description: 'اختبار التزامن والأمان', category: 'chat', isPublic: 'true', idempotencyKey: idemCreateKey },
        validPng
      );
      const r = await fetch(`${BASE}/api/rooms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner.token}` },
        body: fd,
      });
      return { status: r.status, body: await r.json() };
    })
  );
  assert(
    parallelCreate.every((x) => (x.status === 200 || x.status === 201) && x.body.success),
    `Unexpected parallel create result: ${JSON.stringify(parallelCreate.map((x) => ({ status: x.status, ok: x.body?.success, msg: x.body?.message })))}`
  );
  const uniqueRoomIds = new Set(parallelCreate.map((x) => x.body.room.id));
  assert.strictEqual(uniqueRoomIds.size, 1, 'Parallel idempotent create produced multiple rooms!');
  const ownerAfterCreate = await getUserBalances(owner.id);
  assert.strictEqual(ownerAfterCreate.coins, 55000, `Expected 55000 coins after single 25000 deduction, got ${ownerAfterCreate.coins}`);
  const roomA = parallelCreate[0].body.room;
  createdRoomCodes.push(roomA.code);

  // Path traversal + cover security headers
  const travRes = await fetch(`${BASE}/api/rooms/cover/..%2f..%2fetc/passwd`);
  assert(travRes.status === 400 || travRes.status === 404, `Expected 400/404 for path traversal, got ${travRes.status}`);
  const coverFetch = await fetch(`${BASE}${roomA.coverUrl}`);
  assert.strictEqual(coverFetch.status, 200);
  assert.strictEqual(coverFetch.headers.get('x-content-type-options'), 'nosniff');
  assert(String(coverFetch.headers.get('content-security-policy') || '').includes("default-src 'none'"));

  results.creationAndCover = {
    insufficientCoinsStatus: poorCreate.status,
    invalidImageStatus: fakeImgRes.status,
    oversizedCoverStatus: bigRes.status,
    parallelIdempotentRoomsCreated: uniqueRoomIds.size,
    ownerCoinsAfter5ParallelCreates: ownerAfterCreate.coins,
    pathTraversalStatus: travRes.status,
    coverNosniffHeader: coverFetch.headers.get('x-content-type-options'),
    coverCspHeader: coverFetch.headers.get('content-security-policy'),
  };

  // 3. Permissions, Role Hierarchy & Lock/PIN/Invite Bypass PoC
  // Member tries unauthorized endpoints -> all 403
  const memAttempts = await Promise.all([
    apiJson(`/api/rooms/${roomA.code}/lock`, { method: 'POST', token: member.token, body: { isLocked: true, pinMode: 'custom', pin: '1234' } }),
    apiJson(`/api/rooms/${roomA.code}/pin`, { token: member.token }),
    apiJson(`/api/rooms/${roomA.code}/moderators`, { method: 'POST', token: member.token, body: { action: 'upsert', targetUserId: member.id, role: 'moderator' } }),
    apiJson(`/api/rooms/${roomA.code}/moderation/ban`, { method: 'POST', token: member.token, body: { action: 'kick', targetUserId: member2.id } }),
    apiJson(`/api/rooms/${roomA.code}/mute-all`, { method: 'POST', token: member.token, body: { isRoomMuted: true } }),
    apiJson(`/api/rooms/${roomA.code}/audit-logs`, { token: member.token }),
    apiJson(`/api/rooms/${roomA.code}`, { method: 'DELETE', token: member.token }),
  ]);
  assert(memAttempts.every((r) => r.status === 403), `Expected all 403 for member attempts, got ${memAttempts.map((x) => x.status)}`);

  // Owner locks room with custom PIN "4829"
  const lockRes = await apiJson(`/api/rooms/${roomA.code}/lock`, {
    method: 'POST',
    token: owner.token,
    body: { isLocked: true, pinMode: 'custom', pin: '4829' },
  });
  assert.strictEqual(lockRes.status, 200);

  // CRITICAL PoC: Outsider member tries to forge an invite token to bypass locked room PIN!
  const outsiderInviteAttempt = await apiJson(`/api/rooms/${roomA.code}/invite`, {
    method: 'POST',
    token: member.token,
    body: {},
  });
  assert.strictEqual(outsiderInviteAttempt.status, 403, `Invite PIN bypass STILL possible! Status: ${outsiderInviteAttempt.status}`);

  // Banned user tries invite even after room unlocked later
  const preBanRes = await apiJson(`/api/rooms/${roomA.code}/moderation/ban`, {
    method: 'POST',
    token: owner.token,
    body: { action: 'ban', targetUserId: bannedUser.id, durationMinutes: 0, isPermanent: true, reason: 'اختبار الحظر' },
  });
  assert.strictEqual(preBanRes.status, 200);
  const bannedInviteAttempt = await apiJson(`/api/rooms/${roomA.code}/invite`, {
    method: 'POST',
    token: bannedUser.token,
    body: {},
  });
  assert.strictEqual(bannedInviteAttempt.status, 403);

  // Wrong PIN brute force lockout (5 wrong -> 403, 6th -> 429) + oversized PIN check
  const overPin = await apiJson(`/api/rooms/${roomA.code}/verify-pin`, {
    method: 'POST',
    token: member2.token,
    body: { pin: '1'.repeat(64) },
  });
  assert.strictEqual(overPin.status, 403);
  const pinStatuses: number[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await apiJson(`/api/rooms/${roomA.code}/verify-pin`, {
      method: 'POST',
      token: member2.token,
      body: { pin: `999${i}` },
    });
    pinStatuses.push(r.status);
  }
  assert.strictEqual(pinStatuses[4], 429, `Expected 429 on 6th PIN attempt, got ${pinStatuses.join(',')}`);

  // Correct PIN verification by member -> returns entryToken -> WS connect succeeds
  const okPin = await apiJson(`/api/rooms/${roomA.code}/verify-pin`, {
    method: 'POST',
    token: member.token,
    body: { pin: '4829' },
  });
  assert.strictEqual(okPin.status, 200);
  assert(okPin.json.entryToken);

  // Unlock room for remaining role/seat tests
  await apiJson(`/api/rooms/${roomA.code}/lock`, {
    method: 'POST',
    token: owner.token,
    body: { isLocked: false, pinMode: 'keep' },
  });

  // Appoint headAdmin & scoped moderator (manageSeats only)
  const addHead = await apiJson(`/api/rooms/${roomA.code}/moderators`, {
    method: 'POST',
    token: owner.token,
    body: { action: 'upsert', targetUserId: headAdmin.id, role: 'head_admin' },
  });
  assert.strictEqual(addHead.status, 200);

  const addMod = await apiJson(`/api/rooms/${roomA.code}/moderators`, {
    method: 'POST',
    token: owner.token,
    body: {
      action: 'upsert',
      targetUserId: mod.id,
      role: 'moderator',
      permissions: { manageSeats: true, kickUsers: false, banUsers: false, manageLockPin: false, roomMuteAll: false },
    },
  });
  assert.strictEqual(addMod.status, 200);

  // Scoped mod tries ban/lock/moderators/mute-all -> 403; tries evict/mute owner -> 403
  const modDenied = await Promise.all([
    apiJson(`/api/rooms/${roomA.code}/moderation/ban`, { method: 'POST', token: mod.token, body: { action: 'ban', targetUserId: member.id } }),
    apiJson(`/api/rooms/${roomA.code}/lock`, { method: 'POST', token: mod.token, body: { isLocked: true } }),
    apiJson(`/api/rooms/${roomA.code}/moderators`, { method: 'POST', token: mod.token, body: { action: 'upsert', targetUserId: member.id, role: 'moderator' } }),
    apiJson(`/api/rooms/${roomA.code}/mute-all`, { method: 'POST', token: mod.token, body: { isRoomMuted: true } }),
    apiJson(`/api/rooms/${roomA.code}/seats/manage`, { method: 'POST', token: mod.token, body: { action: 'mute_user', targetUserId: owner.id } }),
  ]);
  assert(modDenied.every((x) => x.status === 403), `Scoped mod bypass detected: ${modDenied.map((x) => x.status)}`);

  // Head admin tries removing owner -> 400/403; tries promoting self -> 400
  const headDeniedOwner = await apiJson(`/api/rooms/${roomA.code}/moderators`, {
    method: 'POST',
    token: headAdmin.token,
    body: { action: 'remove', targetUserId: owner.id },
  });
  const headSelfMod = await apiJson(`/api/rooms/${roomA.code}/moderators`, {
    method: 'POST',
    token: headAdmin.token,
    body: { action: 'upsert', targetUserId: headAdmin.id, role: 'head_admin' },
  });
  assert(headDeniedOwner.status === 400 || headDeniedOwner.status === 403);
  assert(headSelfMod.status === 400 || headSelfMod.status === 403);

  results.permissionsAndSecurity = {
    memberDeniedAll7: true,
    lockedRoomOutsiderInviteBypassBlocked: outsiderInviteAttempt.status,
    bannedInviteBlocked: bannedInviteAttempt.status,
    pinRateLimit429Triggered: true,
    pinVerifiedEntrySucceeded: true,
    scopedModEscalationsBlocked: true,
    headAdminOwnerProtection: [headDeniedOwner.status, headSelfMod.status],
  };

  // 4. Connect 5 users to roomA and test Concurrent Seat Booking Race on Seat #1
  const wsOwner = await connectWs(roomA.code, owner.token);
  const wsHead = await connectWs(roomA.code, headAdmin.token);
  const wsMod = await connectWs(roomA.code, mod.token);
  const wsMem1 = await connectWs(roomA.code, member.token);
  const wsMem2 = await connectWs(roomA.code, member2.token);

  const raceSeats = await Promise.all(
    [owner, headAdmin, mod, member, member2].map((u) =>
      apiJson(`/api/rooms/${roomA.code}/seats/sit`, {
        method: 'POST',
        token: u.token,
        body: { seatNumber: 1 },
      })
    )
  );
  const seatWinners = raceSeats.filter((r) => r.status === 200);
  const seatConflicts = raceSeats.filter((r) => r.status === 409);
  assert.strictEqual(seatWinners.length, 1, `Expected 1 winner in seat race, got ${seatWinners.length}`);
  assert.strictEqual(seatConflicts.length, 4, `Expected 4 conflicts (409), got ${seatConflicts.length}`);

  // Seat member & member2 on seats 2 & 3 for gifts
  await apiJson(`/api/rooms/${roomA.code}/seats/leave`, { method: 'POST', token: owner.token, body: {} });
  await apiJson(`/api/rooms/${roomA.code}/seats/leave`, { method: 'POST', token: headAdmin.token, body: {} });
  await apiJson(`/api/rooms/${roomA.code}/seats/leave`, { method: 'POST', token: mod.token, body: {} });
  await apiJson(`/api/rooms/${roomA.code}/seats/leave`, { method: 'POST', token: member.token, body: {} });
  await apiJson(`/api/rooms/${roomA.code}/seats/leave`, { method: 'POST', token: member2.token, body: {} });

  await apiJson(`/api/rooms/${roomA.code}/seats/sit`, { method: 'POST', token: member.token, body: { seatNumber: 2 } });
  await apiJson(`/api/rooms/${roomA.code}/seats/sit`, { method: 'POST', token: member2.token, body: { seatNumber: 3 } });

  results.seatRace = {
    concurrentAttempts: 5,
    winners: seatWinners.length,
    conflicts409: seatConflicts.length,
  };

  // 5. Gifts: Validation, Single + Idempotency Parallel Race + Group `all_seated` + Coins/Diamonds Exact Accounting
  const badQty1 = await apiJson(`/api/rooms/${roomA.code}/gifts/send`, {
    method: 'POST',
    token: owner.token,
    body: { giftId: 'rose', quantity: -1, recipientMode: 'single', recipientIds: [member.id] },
  });
  const badQty2 = await apiJson(`/api/rooms/${roomA.code}/gifts/send`, {
    method: 'POST',
    token: owner.token,
    body: { giftId: 'rose', quantity: 1.5, recipientMode: 'single', recipientIds: [member.id] },
  });
  assert.strictEqual(badQty1.status, 400);
  assert.strictEqual(badQty2.status, 400);

  const giftIdem = `audit_gift_${Date.now()}`;
  const ownerBeforeGift = (await getUserBalances(owner.id)).coins;
  const mem1BeforeGift = (await getUserBalances(member.id)).diamonds;
  const parallelGifts = await Promise.all(
    Array.from({ length: 5 }, () =>
      apiJson(`/api/rooms/${roomA.code}/gifts/send`, {
        method: 'POST',
        token: owner.token,
        body: {
          giftId: 'crown', // 250 coins
          quantity: 1,
          recipientMode: 'single',
          recipientIds: [member.id],
          idempotencyKey: giftIdem,
        },
      })
    )
  );
  assert(parallelGifts.every((x) => x.status === 200 && x.json.success));
  const ownerAfterSingleGift = (await getUserBalances(owner.id)).coins;
  const mem1AfterSingleGift = (await getUserBalances(member.id)).diamonds;
  assert.strictEqual(ownerBeforeGift - ownerAfterSingleGift, 250, 'Single gift double-deducted under idempotency race!');
  assert.strictEqual(mem1AfterSingleGift - mem1BeforeGift, 250, 'Single gift diamonds mismatch!');

  // Group gift `all_seated` (member + member2 on seats 2 & 3 -> 2 recipients * 250 * qty 2 = 1000)
  const mem2BeforeGroup = (await getUserBalances(member2.id)).diamonds;
  const groupGiftRes = await apiJson(`/api/rooms/${roomA.code}/gifts/send`, {
    method: 'POST',
    token: owner.token,
    body: {
      giftId: 'crown',
      quantity: 2,
      recipientMode: 'all_seated',
      idempotencyKey: `audit_group_${Date.now()}`,
    },
  });
  assert.strictEqual(groupGiftRes.status, 200);
  const ownerAfterGroup = (await getUserBalances(owner.id)).coins;
  const mem1AfterGroup = (await getUserBalances(member.id)).diamonds;
  const mem2AfterGroup = (await getUserBalances(member2.id)).diamonds;
  assert.strictEqual(ownerAfterSingleGift - ownerAfterGroup, 1000);
  assert.strictEqual(mem1AfterGroup - mem1AfterSingleGift, 500);
  assert.strictEqual(mem2AfterGroup - mem2BeforeGroup, 500);

  results.giftsAudit = {
    invalidQtyRejected: [badQty1.status, badQty2.status],
    parallelIdempotentGiftDeductedCoins: ownerBeforeGift - ownerAfterSingleGift,
    parallelIdempotentGiftCreditedDiamonds: mem1AfterSingleGift - mem1BeforeGift,
    groupGiftDeductedCoins: ownerAfterSingleGift - ownerAfterGroup,
    groupGiftEachRecipientDiamonds: 500,
  };

  // 6. Mid-Session Ban Eviction + Timed Ban + Unban
  const banMidRes = await apiJson(`/api/rooms/${roomA.code}/moderation/ban`, {
    method: 'POST',
    token: owner.token,
    body: { action: 'ban', targetUserId: member2.id, durationMinutes: 5, reason: 'اختبار الطرد الفوري' },
  });
  assert.strictEqual(banMidRes.status, 200);
  const mem2Closed = await wsMem2.closeInfo;
  assert.strictEqual(mem2Closed.code, 4003);
  const mem2RejoinDenied = await apiJson(`/api/rooms/${roomA.code}`);
  assert(mem2RejoinDenied.status === 200 || mem2RejoinDenied.status === 401);
  const mem2Reenter = await apiJson(`/api/rooms/${roomA.code}`, { token: member2.token });
  assert.strictEqual(mem2Reenter.status, 403);

  const unbanRes = await apiJson(`/api/rooms/${roomA.code}/moderation/ban`, {
    method: 'POST',
    token: owner.token,
    body: { action: 'unban', targetUserId: member2.id },
  });
  assert.strictEqual(unbanRes.status, 200);
  const mem2UnbannedEnter = await apiJson(`/api/rooms/${roomA.code}`, { token: member2.token });
  assert.strictEqual(mem2UnbannedEnter.status, 200);

  // 7. Reconnect Grace Period Test (member seated on #2 terminates WS abruptly -> reconnecting: true -> reconnects -> reconnecting: false & keeps seat #2)
  wsMem1.ws.terminate();
  await new Promise((r) => setTimeout(r, 400));
  const duringGraceSnap = await apiJson(`/api/rooms/${roomA.code}`, { token: owner.token });
  const graceOcc = duringGraceSnap.json.occupants?.find((o: any) => o.userId === member.id);
  const graceSeat = duringGraceSnap.json.seats?.find((s: any) => s.seatNumber === 2);
  assert.strictEqual(graceOcc?.reconnecting, true, 'Expected reconnecting=true during disconnect grace period');
  assert.strictEqual(graceSeat?.userId, member.id, 'Expected seat #2 preserved during disconnect grace period');

  const wsMem1Reconn = await connectWs(roomA.code, member.token);
  const afterReconnSeat = wsMem1Reconn.snapshot.seats.find((s: any) => s.seatNumber === 2);
  const afterReconnOcc = wsMem1Reconn.snapshot.occupants.find((o: any) => o.userId === member.id);
  assert.strictEqual(afterReconnOcc?.reconnecting, false);
  assert.strictEqual(afterReconnSeat?.userId, member.id);

  results.moderationAndReconnect = {
    midSessionBanWsClose: mem2Closed.code,
    bannedHttpDenied: mem2Reenter.status,
    unbanRestoredHttp: mem2UnbannedEnter.status,
    gracePeriodSeatPreserved: true,
    reconnectRestoredState: true,
  };

  // Close roomA sockets cleanly before stress benchmark
  wsOwner.ws.send(JSON.stringify({ type: 'room:leave' }));
  wsHead.ws.send(JSON.stringify({ type: 'room:leave' }));
  wsMod.ws.send(JSON.stringify({ type: 'room:leave' }));
  wsMem1Reconn.ws.send(JSON.stringify({ type: 'room:leave' }));
  await new Promise((r) => setTimeout(r, 200));

  // 8. 15 Active Mic Seats + 15 Extra Listeners (30 Concurrent WS Clients) Stress + Resource Benchmark
  const roomStressFd = await createCoverFormData({ name: 'غرفة ضغط 15 مايك', category: 'music', isPublic: 'true' }, validPng);
  const roomStressCreate = await fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${owner.token}` },
    body: roomStressFd,
  });
  const roomStress = (await roomStressCreate.json()).room;
  createdRoomCodes.push(roomStress.code);

  // Register 26 more temporary users so we have 30 distinct users total (owner, headAdmin, mod, member + 26 = 30)
  const stressUsers: TestUser[] = [owner, headAdmin, mod, member];
  for (let i = 0; i < 26; i++) {
    const u = await registerUser(`stress_${i + 1}`, 0);
    createdUsers.push(u);
    stressUsers.push(u);
  }

  const statsBefore = getServerStats();
  const tConnStart = performance.now();
  const stressConns = await Promise.all(stressUsers.map((u) => connectWs(roomStress.code, u.token)));
  const connSetupMs = Math.round((performance.now() - tConnStart) * 10) / 10;

  // Seat first 15 users on seats 1..15 and unmute their mics + emit mic:speaking
  const tSeatStart = performance.now();
  await Promise.all(
    stressUsers.slice(0, 15).map((u, idx) =>
      apiJson(`/api/rooms/${roomStress.code}/seats/sit`, {
        method: 'POST',
        token: u.token,
        body: { seatNumber: idx + 1 },
      })
    )
  );
  const seat15Ms = Math.round((performance.now() - tSeatStart) * 10) / 10;

  for (let i = 0; i < 15; i++) {
    stressConns[i].ws.send(JSON.stringify({ type: 'mic:toggle', isOpen: true }));
    stressConns[i].ws.send(JSON.stringify({ type: 'mic:speaking', isSpeaking: true }));
  }

  // Test chat, mini-game, music broadcast fanout across all 30 connected clients
  const chatMarker = `STRESS_CHAT_${Date.now()}`;
  const tChatSend = performance.now();
  stressConns[0].ws.send(JSON.stringify({ type: 'chat:send', text: chatMarker }));

  const chatLatencies = await Promise.all(
    stressConns.map(
      (c) =>
        new Promise<number>((resolve) => {
          const check = () => {
            const hit = c.messages.find((m) => m.type === 'chat:message' && m.message?.text === chatMarker);
            if (hit) return resolve(hit._rxAt - tChatSend);
            setTimeout(check, 5);
          };
          check();
        })
    )
  );
  chatLatencies.sort((a, b) => a - b);
  const p50LatencyMs = Math.round(chatLatencies[Math.floor(chatLatencies.length * 0.5)] * 10) / 10;
  const p95LatencyMs = Math.round(chatLatencies[Math.floor(chatLatencies.length * 0.95)] * 10) / 10;
  const maxLatencyMs = Math.round(chatLatencies[chatLatencies.length - 1] * 10) / 10;

  // Test music:control & game:action start + answer fanout
  const tMediaStart = performance.now();
  stressConns[0].ws.send(JSON.stringify({ type: 'music:control', action: 'play' }));
  stressConns[0].ws.send(JSON.stringify({ type: 'game:action', action: 'start', gameType: 'quiz' }));

  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const mOk = stressConns.every((c) => c.messages.some((m) => m.type === 'music:state' && m.music?.isPlaying));
    const gOk = stressConns.every((c) => c.messages.some((m) => m.type === 'game:state' && m.game?.status === 'active'));
    if (mOk && gOk) break;
    await new Promise((r) => setTimeout(r, 25));
  }
  const mediaFanoutMs = Math.round((performance.now() - tMediaStart) * 10) / 10;
  const statsPeak = getServerStats();

  // Verify all 30 clients received music:state & game:state
  const musicCount = stressConns.filter((c) => c.messages.some((m) => m.type === 'music:state' && m.music?.isPlaying)).length;
  const gameCount = stressConns.filter((c) => c.messages.some((m) => m.type === 'game:state' && m.game?.status === 'active')).length;
  const gotMusicAll = musicCount === 30;
  const gotGameAll = gameCount === 30;
  assert(gotMusicAll, `Only ${musicCount}/30 clients received music:state broadcast (errs=${JSON.stringify(stressConns[0].messages.filter((m) => m.type === 'error'))})`);
  assert(gotGameAll, `Only ${gameCount}/30 clients received game:state broadcast`);

  // Stop game + disconnect all 30 stress clients cleanly
  stressConns[0].ws.send(JSON.stringify({ type: 'game:action', action: 'end' }));
  stressConns[0].ws.send(JSON.stringify({ type: 'music:control', action: 'stop' }));
  for (const c of stressConns) {
    c.ws.send(JSON.stringify({ type: 'room:leave' }));
    c.ws.close(1000, 'stress done');
  }
  await new Promise((r) => setTimeout(r, 400));
  const statsAfter = getServerStats();

  results.stress15Mics30Clients = {
    totalClients: 30,
    activeMics: 15,
    extraListeners: 15,
    ws30ConnectMs: connSetupMs,
    seat15ClaimMs: seat15Ms,
    chatBroadcastFanoutMs: { p50: p50LatencyMs, p95: p95LatencyMs, max: maxLatencyMs },
    musicSyncDeliveredToAll30: gotMusicAll,
    gameSyncDeliveredToAll30: gotGameAll,
    serverMemoryRssMb: { before: statsBefore.rssMb, peak: statsPeak.rssMb, afterDisconnect: statsAfter.rssMb },
    serverCpuPct: { before: statsBefore.cpuPct, peak: statsPeak.cpuPct, after: statsAfter.cpuPct },
  };

  // 9. Create persistent room with Cover, Lock+PIN, Ban, Favorite, Event, Chat Message for Server Restart Test
  const persistFd = await createCoverFormData(
    { name: 'غرفة اختبار الاستمرارية', description: 'التحقق من البقاء بعد إعادة تشغيل الخادم', category: 'culture', isPublic: 'true' },
    validPng
  );
  const persistCreate = await fetch(`${BASE}/api/rooms`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${owner.token}` },
    body: persistFd,
  });
  const roomPersist = (await persistCreate.json()).room;
  createdRoomCodes.push(roomPersist.code);

  await apiJson(`/api/rooms/${roomPersist.code}/lock`, {
    method: 'POST',
    token: owner.token,
    body: { isLocked: true, pinMode: 'custom', pin: '7391' },
  });
  await apiJson(`/api/rooms/${roomPersist.code}/favorite`, {
    method: 'POST',
    token: member.token,
    body: { isFavorite: true },
  });
  await apiJson(`/api/rooms/${roomPersist.code}/events`, {
    method: 'POST',
    token: owner.token,
    body: { action: 'create', title: 'أمسية ثقافية', startsAt: new Date(Date.now() + 3600_000).toISOString() },
  });
  await apiJson(`/api/rooms/${roomPersist.code}/moderation/ban`, {
    method: 'POST',
    token: owner.token,
    body: { action: 'ban', targetUserId: bannedUser.id, durationMinutes: 0, isPermanent: true, reason: 'حظر دائم قبل الإعادة' },
  });
  const wsPersist = await connectWs(roomPersist.code, owner.token);
  wsPersist.ws.send(JSON.stringify({ type: 'chat:send', text: 'رسالة محفوظة قبل إعادة التشغيل' }));
  // Occupy seat 4 as owner WITHOUT room:leave so we also verify ghost seats are cleared cleanly upon restart!
  await apiJson(`/api/rooms/${roomPersist.code}/seats/sit`, { method: 'POST', token: owner.token, body: { seatNumber: 4 } });
  await new Promise((r) => setTimeout(r, 200));

  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify(
      {
        results,
        createdUserIds: createdUsers.map((u) => u.id),
        createdRoomCodes,
        persistRoom: {
          id: roomPersist.id,
          code: roomPersist.code,
          coverUrl: roomPersist.coverUrl,
        },
        ownerToken: owner.token,
        memberToken: member.token,
        bannedUserToken: bannedUser.token,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(JSON.stringify({ phase: 1, status: 'READY_FOR_RESTART', results }, null, 2));
}

async function runPhase2() {
  console.log('=== PHASE 2: POST-RESTART PERSISTENCE VERIFICATION, RESOURCE BENCHMARK & FULL CLEANUP ===');
  assert(fs.existsSync(STATE_FILE), 'Missing .audit_state.json from Phase 1');
  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  const { persistRoom, ownerToken, memberToken, bannedUserToken, createdUserIds, createdRoomCodes, results } = state;
  const roomACode = createdRoomCodes[0];
  const roomStressCode = createdRoomCodes[1];

  // Lookup or restore temporary @audit.local sessions for createdUserIds (in case of container snapshot mismatch on sessions.json)
  const allUsers: any[] = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')) : [];
  let allSessions: any[] = fs.existsSync(SESSIONS_FILE) ? JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8')) : [];
  const tokenByUserId = new Map<string, string>();
  for (const s of allSessions) {
    if (s.userId && s.token && createdUserIds.includes(s.userId) && !tokenByUserId.has(s.userId)) {
      tokenByUserId.set(s.userId, s.token);
    }
  }
  const ownerId = createdUserIds[0];
  const headAdminId = createdUserIds[1];
  const modId = createdUserIds[2];
  const memberId = createdUserIds[3];
  const member2Id = createdUserIds[4];
  const bannedId = createdUserIds[5];

  const presetTokens: Record<string, string> = {
    [ownerId]: ownerToken,
    [memberId]: memberToken,
    [bannedId]: bannedUserToken,
  };
  let sessionsDirty = false;
  const nowIso = new Date().toISOString();
  const expIso = new Date(Date.now() + 24 * 3600_000).toISOString();
  const refExpIso = new Date(Date.now() + 30 * 24 * 3600_000).toISOString();
  for (const uid of createdUserIds) {
    const desiredToken = presetTokens[uid] || tokenByUserId.get(uid) || `sx_at_audit_resumed_${uid.replace(/-/g, '')}`;
    if (!allSessions.some((s) => s.token === desiredToken)) {
      const u = allUsers.find((x) => x.id === uid);
      if (u) {
        allSessions.push({
          token: desiredToken,
          refreshToken: `sx_rt_audit_resumed_${uid.replace(/-/g, '')}`,
          expiresAt: expIso,
          refreshExpiresAt: refExpIso,
          userId: u.id,
          displayId: u.displayId,
          email: u.email,
          name: u.name,
          isAdmin: false,
          createdAt: nowIso,
          lastActiveAt: nowIso,
        });
        sessionsDirty = true;
      }
    }
    tokenByUserId.set(uid, desiredToken);
  }
  if (sessionsDirty) {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(allSessions, null, 2), 'utf-8');
  }
  const headToken = tokenByUserId.get(headAdminId) || '';
  const modToken = tokenByUserId.get(modId) || '';

  // 1. Verify persistent room (SX-280943) survived restart
  const detail = await apiJson(`/api/rooms/${persistRoom.code}`, { token: ownerToken });
  assert.strictEqual(detail.status, 200, 'Persistent room missing after server restart!');
  assert.strictEqual(detail.json.room.name, 'غرفة اختبار الاستمرارية');
  assert.strictEqual(detail.json.room.category, 'culture');
  assert.strictEqual(detail.json.room.isLocked, true);
  assert.strictEqual(detail.json.room.isPublic, true);
  assert.strictEqual(detail.json.room.chatEnabled, true);
  assert.strictEqual(detail.json.room.myRole, 'owner');

  // Verify no duplicate seats and 0 ghost seats on persistRoom
  const persistSeats: any[] = detail.json.seats || [];
  assert.strictEqual(persistSeats.length, 15);
  assert.strictEqual(new Set(persistSeats.map((s) => s.seatNumber)).size, 15);
  const occupiedAfterRestart = persistSeats.filter((s) => Boolean(s.userId));
  assert.strictEqual(occupiedAfterRestart.length, 0, `Expected 0 ghost seats after restart, found ${occupiedAfterRestart.length}`);

  // Verify cover image returns 200
  const coverRes = await fetch(`${BASE}${persistRoom.coverUrl}`);
  assert.strictEqual(coverRes.status, 200, 'Room cover image missing after restart!');

  // Verify PIN survived restart
  const pinVerify = await apiJson(`/api/rooms/${persistRoom.code}/verify-pin`, {
    method: 'POST',
    token: memberToken,
    body: { pin: '7391' },
  });
  assert.strictEqual(pinVerify.status, 200);

  // Verify chat message, favorite, event, ban survived restart
  const memberView = await apiJson(`/api/rooms/${persistRoom.code}?invite=${encodeURIComponent(pinVerify.json.entryToken)}`, { token: memberToken });
  assert.strictEqual(memberView.status, 200);
  assert.strictEqual(memberView.json.room.isFavorite, true);
  assert(memberView.json.events.some((e: any) => e.title === 'أمسية ثقافية'));
  assert(memberView.json.messages.some((m: any) => m.text === 'رسالة محفوظة قبل إعادة التشغيل'));

  const bannedEnter = await apiJson(`/api/rooms/${persistRoom.code}`, { token: bannedUserToken });
  assert.strictEqual(bannedEnter.status, 403);

  // 2. Verify roomA (SX-812003) roles, permissions, totalGiftsCoins, auditLogs & exact wallet balances survived restart!
  const roomADetail = await apiJson(`/api/rooms/${roomACode}`, { token: ownerToken });
  assert.strictEqual(roomADetail.status, 200);
  assert.strictEqual(roomADetail.json.room.totalGiftsCoins, 1250, `Expected totalGiftsCoins=1250, got ${roomADetail.json.room.totalGiftsCoins}`);
  const headView = await apiJson(`/api/rooms/${roomACode}`, { token: headToken });
  assert.strictEqual(headView.json.room.myRole, 'head_admin');
  const modView = await apiJson(`/api/rooms/${roomACode}`, { token: modToken });
  assert.strictEqual(modView.json.room.myRole, 'moderator');
  assert.strictEqual(modView.json.room.myPermissions?.manageSeats, true);
  assert.strictEqual(modView.json.room.myPermissions?.banUsers, false);

  const auditLogsRes = await apiJson(`/api/rooms/${roomACode}/audit-logs`, { token: ownerToken });
  assert.strictEqual(auditLogsRes.status, 200);
  assert((auditLogsRes.json.logs || []).length >= 5, 'Expected audit logs to persist after restart');

  const ownerBalAfterRestart = await getUserBalances(ownerId);
  const mem1BalAfterRestart = await getUserBalances(memberId);
  const mem2BalAfterRestart = await getUserBalances(member2Id);
  // Owner started with 80,000, created 3 rooms (-75,000), sent 250 + 1,000 gifts (-1,250) => exact 3,750 coins!
  assert.strictEqual(ownerBalAfterRestart.coins, 3750, `Owner balance mismatch after restart: ${ownerBalAfterRestart.coins}`);
  assert.strictEqual(mem1BalAfterRestart.diamonds, 750, `Member1 diamonds mismatch after restart: ${mem1BalAfterRestart.diamonds}`);
  assert.strictEqual(mem2BalAfterRestart.diamonds, 500, `Member2 diamonds mismatch after restart: ${mem2BalAfterRestart.diamonds}`);

  results.postRestartPersistence = {
    roomSurvived: true,
    settingsSurvived: true,
    coverServed200: true,
    pinSurvived: true,
    favoriteSurvived: true,
    eventSurvived: true,
    chatMessageSurvived: true,
    banSurvived: true,
    rolesAndScopedPermsSurvived: true,
    auditLogsSurvivedCount: auditLogsRes.json.logs.length,
    totalGiftsCoinsSurvived: roomADetail.json.room.totalGiftsCoins,
    walletBalancesExactAfterRestart: {
      ownerCoins: ownerBalAfterRestart.coins,
      member1Diamonds: mem1BalAfterRestart.diamonds,
      member2Diamonds: mem2BalAfterRestart.diamonds,
    },
    uniqueSeatsCount: persistSeats.length,
    ghostSeatsCount: occupiedAfterRestart.length,
  };

  // 3. Re-measure 30-Client / 15-Mic Stress + Real Server PID RSS/CPU + Network Bytes on roomStress
  const benchUserIds = createdUserIds.filter((uid: string) => uid !== bannedId && tokenByUserId.has(uid)).slice(0, 30);
  assert.strictEqual(benchUserIds.length, 30, `Expected 30 bench users, got ${benchUserIds.length}`);

  let totalRxBytes = 0;
  let totalTxBytes = 0;
  const connectMeasured = async (uid: string) => {
    const tok = tokenByUserId.get(uid)!;
    const conn = await connectWs(roomStressCode, tok);
    conn.ws.on('message', (raw) => {
      totalRxBytes += Buffer.byteLength(raw.toString());
    });
    const origSend = conn.ws.send.bind(conn.ws);
    (conn.ws as any).send = (payload: any, ...rest: any[]) => {
      totalTxBytes += Buffer.byteLength(String(payload));
      return origSend(payload, ...rest);
    };
    return conn;
  };

  const statsBefore = getServerStats();
  const tConnStart = performance.now();
  const benchConns = await Promise.all(benchUserIds.map((uid: string) => connectMeasured(uid)));
  const ws30ConnectMs = Math.round((performance.now() - tConnStart) * 10) / 10;

  const tSeatStart = performance.now();
  await Promise.all(
    benchUserIds.slice(0, 15).map((uid: string, idx: number) =>
      apiJson(`/api/rooms/${roomStressCode}/seats/sit`, {
        method: 'POST',
        token: tokenByUserId.get(uid)!,
        body: { seatNumber: idx + 1 },
      })
    )
  );
  const seat15ClaimMs = Math.round((performance.now() - tSeatStart) * 10) / 10;

  for (let i = 0; i < 15; i++) {
    benchConns[i].ws.send(JSON.stringify({ type: 'mic:toggle', isOpen: true }));
    benchConns[i].ws.send(JSON.stringify({ type: 'mic:speaking', isSpeaking: true }));
  }

  const marker = `BENCH_CHAT_${Date.now()}`;
  const tChatSend = performance.now();
  benchConns[0].ws.send(JSON.stringify({ type: 'chat:send', text: marker }));
  const chatLats = await Promise.all(
    benchConns.map(
      (c) =>
        new Promise<number>((resolve) => {
          const check = () => {
            const hit = c.messages.find((m) => m.type === 'chat:message' && m.message?.text === marker);
            if (hit) return resolve(hit._rxAt - tChatSend);
            setTimeout(check, 5);
          };
          check();
        })
    )
  );
  chatLats.sort((a, b) => a - b);

  benchConns[0].ws.send(JSON.stringify({ type: 'music:control', action: 'play' }));
  benchConns[0].ws.send(JSON.stringify({ type: 'game:action', action: 'start', gameType: 'quiz' }));
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const mOk = benchConns.every((c) => c.messages.some((m) => m.type === 'music:state' && m.music?.isPlaying));
    const gOk = benchConns.every((c) => c.messages.some((m) => m.type === 'game:state' && m.game?.status === 'active'));
    if (mOk && gOk) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  const statsPeak = getServerStats();

  benchConns[0].ws.send(JSON.stringify({ type: 'game:action', action: 'end' }));
  benchConns[0].ws.send(JSON.stringify({ type: 'music:control', action: 'stop' }));
  for (const c of benchConns) {
    c.ws.send(JSON.stringify({ type: 'room:leave' }));
    c.ws.close(1000, 'bench done');
  }
  await new Promise((r) => setTimeout(r, 500));
  const statsAfter = getServerStats();

  results.accurateServerBenchmark = {
    serverPid: statsPeak.pid,
    totalClients: 30,
    activeMics: 15,
    extraListeners: 15,
    ws30ConnectMs,
    seat15ClaimMs,
    chatBroadcastFanoutMs: {
      p50: Math.round(chatLats[Math.floor(chatLats.length * 0.5)] * 10) / 10,
      p95: Math.round(chatLats[Math.floor(chatLats.length * 0.95)] * 10) / 10,
      max: Math.round(chatLats[chatLats.length - 1] * 10) / 10,
    },
    wsNetworkTrafficBytes: { txBytes: totalTxBytes, rxBytes: totalRxBytes, totalKb: Math.round(((totalTxBytes + totalRxBytes) / 1024) * 10) / 10 },
    serverMemoryRssMb: { before: statsBefore.rssMb, peak: statsPeak.rssMb, afterDisconnect: statsAfter.rssMb },
    serverCpuPct: { before: statsBefore.cpuPct, peak: statsPeak.cpuPct, after: statsAfter.cpuPct },
  };

  // 4. Existing SOUL-X non-regression smoke check post-restart
  const appSettingsAfter = await apiJson('/api/app/settings');
  const authVerifyAfter = await apiJson('/api/auth/verify', { token: ownerToken });
  results.nonRegressionAfterRestart = {
    appSettingsStatus: appSettingsAfter.status,
    authVerifyStatus: authVerifyAfter.status,
  };
  assert.strictEqual(appSettingsAfter.status, 200);
  assert.strictEqual(authVerifyAfter.status, 200);

  // 5. Clean up all audit test rooms via DELETE /api/rooms/:code
  for (const code of createdRoomCodes) {
    await apiJson(`/api/rooms/${code}`, { method: 'DELETE', token: ownerToken });
  }

  // Also clean any leftover e2e_* or audit_* test users, sessions, and any stale E2E rooms in rooms_data.json
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  const removeUserIds = new Set<string>(createdUserIds);
  for (const u of users) {
    const email = String(u.email || '').toLowerCase();
    if (email.endsWith('@test.soulx') || email.endsWith('@audit.local')) {
      removeUserIds.add(u.id);
    }
  }
  const cleanUsers = users.filter((u: any) => !removeUserIds.has(u.id));
  fs.writeFileSync(USERS_FILE, JSON.stringify(cleanUsers, null, 2), 'utf-8');

  if (fs.existsSync(SESSIONS_FILE)) {
    const sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
    const cleanSessions = Array.isArray(sessions) ? sessions.filter((s: any) => !removeUserIds.has(s.userId)) : sessions;
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(cleanSessions, null, 2), 'utf-8');
  }

  if (fs.existsSync(ROOMS_FILE)) {
    const rStore = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf-8'));
    const testRoomIds = new Set<string>(
      (rStore.rooms || [])
        .filter((r: any) =>
          removeUserIds.has(r.ownerId) ||
          String(r.name || '').includes('الاختبارية') ||
          String(r.name || '').includes('غرفة التدقيق') ||
          String(r.name || '').includes('غرفة ضغط') ||
          String(r.name || '').includes('غرفة اختبار')
        )
        .map((r: any) => r.id)
    );
    for (const rid of testRoomIds) {
      const dirPath = path.resolve(process.cwd(), 'data/room_images/rooms', rid);
      if (fs.existsSync(dirPath)) fs.rmSync(dirPath, { recursive: true, force: true });
    }
    rStore.rooms = (rStore.rooms || []).filter((r: any) => !testRoomIds.has(r.id));
    rStore.seats = (rStore.seats || []).filter((s: any) => !testRoomIds.has(s.roomId));
    rStore.moderators = (rStore.moderators || []).filter((m: any) => !testRoomIds.has(m.roomId));
    rStore.bans = (rStore.bans || []).filter((b: any) => !testRoomIds.has(b.roomId));
    rStore.messages = (rStore.messages || []).filter((m: any) => !testRoomIds.has(m.roomId));
    rStore.favorites = (rStore.favorites || []).filter((f: any) => !testRoomIds.has(f.roomId));
    rStore.events = (rStore.events || []).filter((e: any) => !testRoomIds.has(e.roomId));
    rStore.auditLogs = (rStore.auditLogs || []).filter((a: any) => !testRoomIds.has(a.roomId));
    rStore.invites = (rStore.invites || []).filter((i: any) => !testRoomIds.has(i.roomId));
    // Clean test/e2e idempotency entries
    const nextIdem: Record<string, any> = {};
    for (const [k, v] of Object.entries<any>(rStore.idempotency || {})) {
      if (!removeUserIds.has(v?.userId) && !String(k).startsWith('audit_') && !String(k).startsWith('idem_create_') && !String(k).startsWith('gift_')) {
        nextIdem[k] = v;
      }
    }
    rStore.idempotency = nextIdem;
    fs.writeFileSync(ROOMS_FILE, JSON.stringify(rStore, null, 2), 'utf-8');
  }

  await cleanNeonTestRows(removeUserIds);

  // Check cover directory cleanliness
  const coverDir = path.resolve(process.cwd(), 'data/room_images/rooms');
  const remainingCovers = fs.existsSync(coverDir) ? fs.readdirSync(coverDir) : [];

  console.log(JSON.stringify({
    phase: 2,
    status: 'ALL_PASSED_AND_CLEANED',
    remainingTestRooms: JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf-8')).rooms.length,
    remainingUsersCount: cleanUsers.length,
    remainingCoverFolders: remainingCovers.length,
    results,
  }, null, 2));
}

const phase = process.argv.includes('--phase=2') ? 2 : 1;
(phase === 2 ? runPhase2() : runPhase1()).catch((err) => {
  console.error('AUDIT FAILED:', err);
  process.exit(1);
});
