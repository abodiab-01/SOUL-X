import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const AVATARS_BUCKET = (process.env.S3_AVATARS_BUCKET || 'profilepic').trim() || 'profilepic';
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_AVATAR_DIMENSION = 512;
const LOCAL_AVATARS_ROOT = path.resolve(process.cwd(), 'data', 'avatars');

export type AllowedAvatarFormat = 'jpeg' | 'png' | 'webp';

function getS3EnvConfig() {
  const endpoint = (process.env.AWS_ENDPOINT_URL_S3 || '').trim().replace(/\/+$/, '');
  const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
  const region = (process.env.AWS_REGION || 'auto').trim() || 'auto';
  return { endpoint, accessKeyId, secretAccessKey, region };
}

export function isS3Configured(): boolean {
  const { endpoint, accessKeyId, secretAccessKey } = getS3EnvConfig();
  return Boolean(endpoint && accessKeyId && secretAccessKey);
}

function resolveLocalAvatarPath(key: string): string {
  if (!isValidAvatarKey(key)) {
    throw new Error('مسار الصورة غير صالح');
  }
  const resolved = path.resolve(LOCAL_AVATARS_ROOT, key);
  const rootPrefix = LOCAL_AVATARS_ROOT.endsWith(path.sep)
    ? LOCAL_AVATARS_ROOT
    : LOCAL_AVATARS_ROOT + path.sep;
  if (!resolved.startsWith(rootPrefix)) {
    throw new Error('مسار الصورة خارج نطاق التخزين المسموح');
  }
  return resolved;
}

let cachedClient: S3Client | null = null;
let cachedConfigSig = '';

export function getS3Client(): S3Client {
  const { endpoint, accessKeyId, secretAccessKey, region } = getS3EnvConfig();
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'خدمة تخزين الصور السحابية غير مهيأة حالياً (مفاتيح Neon Object Storage مفقودة في متغيرات البيئة).'
    );
  }

  const sig = `${endpoint}|${region}|${accessKeyId}`;
  if (cachedClient && cachedConfigSig === sig) {
    return cachedClient;
  }

  const isStandardAws = endpoint.includes('.amazonaws.com') && !endpoint.includes('custom');
  cachedClient = new S3Client({
    region,
    endpoint,
    forcePathStyle: !isStandardAws,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
  cachedConfigSig = sig;
  return cachedClient;
}

/**
 * Validates actual image binary signature (magic bytes), ignoring filename extension or client MIME header.
 */
export function detectImageFormatFromMagicBytes(buf: Buffer): AllowedAvatarFormat | null {
  if (!Buffer.isBuffer(buf) || buf.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'png';
  }

  // WebP: "RIFF" (0..3) and "WEBP" (8..11)
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }

  return null;
}

/**
 * Strict key format validator preventing directory traversal and confining access to `avatars/{userId}/{file}`.
 */
export function isValidAvatarKey(key?: string | null): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.includes('..') || trimmed.includes('\\') || trimmed.startsWith('/')) {
    return false;
  }
  return /^avatars\/[a-zA-Z0-9_-]{1,128}\/[a-zA-Z0-9._-]{4,128}\.(webp|jpg|jpeg|png)$/i.test(
    trimmed
  );
}

export function isAvatarKeyOwnedByUser(key: string, allowedUserIdentifiers: Array<string | undefined | null>): boolean {
  if (!isValidAvatarKey(key)) return false;
  const parts = key.split('/');
  const keyFolder = parts[1];
  if (!keyFolder) return false;

  const cleanIds = allowedUserIdentifiers
    .filter(Boolean)
    .map((id) => sanitizeUserIdForKey(String(id)))
    .filter(Boolean);

  return cleanIds.includes(keyFolder);
}

export function sanitizeUserIdForKey(userId: string): string {
  const safe = String(userId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
  return safe.slice(0, 128);
}

/**
 * Builds a unique private object key without using the original user filename.
 */
export function buildUniqueAvatarKey(userId: string): string {
  const safeUserId = sanitizeUserIdForKey(userId);
  if (!safeUserId) {
    throw new Error('معرّف المستخدم غير صالح لإنشاء مسار الصورة');
  }
  const uniquePart = `${Date.now()}-${crypto.randomUUID()}`;
  return `avatars/${safeUserId}/${uniquePart}.webp`;
}

/**
 * Validates size, real file signature, decodes safely, strips EXIF/metadata,
 * enforces a strict 1:1 square aspect ratio (max 512x512 without upscaling),
 * and converts/compresses to WebP.
 */
export async function validateAndProcessAvatarBuffer(rawBuffer: Buffer): Promise<{
  buffer: Buffer;
  contentType: 'image/webp';
  width: number;
  height: number;
}> {
  if (!Buffer.isBuffer(rawBuffer) || rawBuffer.length === 0) {
    throw new Error('ملف الصورة فارغ أو غير صالح');
  }

  if (rawBuffer.length > MAX_AVATAR_BYTES) {
    throw new Error('حجم الصورة يتجاوز الحد الأقصى المسموح به (5 ميجابايت)');
  }

  const magicFormat = detectImageFormatFromMagicBytes(rawBuffer);
  if (!magicFormat) {
    throw new Error('صيغة الملف غير مدعومة. يُسمح فقط بصور JPEG و PNG و WebP الحقيقية');
  }

  try {
    const pipeline = sharp(rawBuffer, {
      animated: false,
      limitInputPixels: 40_000_000,
    });

    const meta = await pipeline.metadata();
    if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
      throw new Error('محتوى الملف ليس صورة صالحة بصيغة JPEG أو PNG أو WebP');
    }
    if (!meta.width || !meta.height || meta.width < 1 || meta.height < 1) {
      throw new Error('أبعاد الصورة غير صالحة');
    }

    const rotatedDimensionsSwap = Boolean(meta.orientation && meta.orientation >= 5 && meta.orientation <= 8);
    const orientedWidth = rotatedDimensionsSwap ? meta.height : meta.width;
    const orientedHeight = rotatedDimensionsSwap ? meta.width : meta.height;
    const squareSide = Math.max(1, Math.min(orientedWidth, orientedHeight, MAX_AVATAR_DIMENSION));

    const processed = await sharp(rawBuffer, {
      animated: false,
      limitInputPixels: 40_000_000,
    })
      .rotate()
      .resize(squareSide, squareSide, {
        fit: 'cover',
        position: 'center',
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (!processed.data || processed.data.length === 0) {
      throw new Error('فشل معالجة وضغط الصورة');
    }

    return {
      buffer: processed.data,
      contentType: 'image/webp',
      width: processed.info.width || squareSide,
      height: processed.info.height || squareSide,
    };
  } catch (err: any) {
    if (err?.message && (err.message.includes('صيغة') || err.message.includes('أبعاد') || err.message.includes('حجم'))) {
      throw err;
    }
    throw new Error('الملف المرفوع تالف أو ليس صورة صالحة');
  }
}

/**
 * Uploads processed WebP avatar to Private Neon Object Storage bucket `profilepic` when configured,
 * or persists it safely inside `data/avatars/{key}` when S3 env vars are not configured.
 */
export async function uploadAvatarObject(
  userId: string,
  webpBuffer: Buffer
): Promise<{ key: string; storage: 's3' | 'local' }> {
  const key = buildUniqueAvatarKey(userId);

  if (isS3Configured()) {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: AVATARS_BUCKET,
        Key: key,
        Body: webpBuffer,
        ContentType: 'image/webp',
        CacheControl: 'private, max-age=300',
      })
    );
    return { key, storage: 's3' };
  }

  const targetPath = resolveLocalAvatarPath(key);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, webpBuffer);
  return { key, storage: 'local' };
}

/**
 * Deletes an avatar object by key from Neon Object Storage and/or persistent local storage.
 */
export async function deleteAvatarObject(key: string): Promise<void> {
  if (!isValidAvatarKey(key)) {
    throw new Error('مسار الصورة غير صالح للحذف');
  }

  if (isS3Configured()) {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: AVATARS_BUCKET,
        Key: key,
      })
    );
  }

  try {
    const localPath = resolveLocalAvatarPath(key);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  } catch {}
}

/**
 * Generates a short-lived pre-signed URL for accessing a private avatar object (server-side only).
 */
export async function getSignedAvatarUrl(
  key: string,
  expiresInSeconds = 300
): Promise<string> {
  if (!isValidAvatarKey(key)) {
    throw new Error('مسار الصورة غير صالح');
  }
  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: AVATARS_BUCKET,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Checks whether an object exists in S3 or persistent local avatar storage.
 */
export async function avatarObjectExists(key: string): Promise<boolean> {
  if (!isValidAvatarKey(key)) return false;

  if (isS3Configured()) {
    try {
      const client = getS3Client();
      await client.send(
        new HeadObjectCommand({
          Bucket: AVATARS_BUCKET,
          Key: key,
        })
      );
      return true;
    } catch {
      // Fall through to local file check
    }
  }

  try {
    const localPath = resolveLocalAvatarPath(key);
    return fs.existsSync(localPath);
  } catch {
    return false;
  }
}

/**
 * Reads an avatar object from Private Neon Object Storage or persistent local storage
 * so the backend can stream private image bytes safely without leaking S3 credentials.
 */
export async function readAvatarObjectFromStorage(key: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  if (!isValidAvatarKey(key)) {
    return null;
  }

  if (isS3Configured()) {
    try {
      const client = getS3Client();
      const res = await client.send(
        new GetObjectCommand({
          Bucket: AVATARS_BUCKET,
          Key: key,
        })
      );
      if (res.Body) {
        const chunks: Uint8Array[] = [];
        for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
        return {
          buffer: Buffer.concat(chunks),
          contentType: res.ContentType || 'image/webp',
        };
      }
    } catch {
      // Fallback to local storage if present
    }
  }

  try {
    const localPath = resolveLocalAvatarPath(key);
    if (!fs.existsSync(localPath)) return null;
    const buffer = fs.readFileSync(localPath);
    if (!buffer || buffer.length === 0) return null;
    return {
      buffer,
      contentType: 'image/webp',
    };
  } catch {
    return null;
  }
}

// ==========================================
// SOUL-X Rooms Cover Image Storage Helpers
// ==========================================
export const MAX_ROOM_COVER_BYTES = 5 * 1024 * 1024; // 5MB
const LOCAL_ROOM_IMAGES_ROOT = path.resolve(process.cwd(), 'data', 'room_images');

export function isValidRoomCoverKey(key?: string | null): boolean {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.includes('..') || trimmed.includes('\\') || trimmed.startsWith('/')) {
    return false;
  }
  return /^rooms\/[a-zA-Z0-9_-]{1,128}\/[a-zA-Z0-9._-]{4,128}\.webp$/i.test(trimmed);
}

function resolveLocalRoomImagePath(key: string): string {
  if (!isValidRoomCoverKey(key)) {
    throw new Error('مسار صورة الغرفة غير صالح');
  }
  const resolved = path.resolve(LOCAL_ROOM_IMAGES_ROOT, key);
  const rootPrefix = LOCAL_ROOM_IMAGES_ROOT.endsWith(path.sep)
    ? LOCAL_ROOM_IMAGES_ROOT
    : LOCAL_ROOM_IMAGES_ROOT + path.sep;
  if (!resolved.startsWith(rootPrefix)) {
    throw new Error('مسار صورة الغرفة خارج نطاق التخزين المسموح');
  }
  return resolved;
}

export function buildUniqueRoomCoverKey(roomId: string): string {
  const safeRoomId = sanitizeUserIdForKey(roomId);
  if (!safeRoomId) {
    throw new Error('معرّف الغرفة غير صالح');
  }
  return `rooms/${safeRoomId}/${Date.now()}-${crypto.randomUUID()}.webp`;
}

export async function validateAndProcessRoomCoverBuffer(rawBuffer: Buffer): Promise<{
  buffer: Buffer;
  contentType: 'image/webp';
  width: number;
  height: number;
}> {
  if (!Buffer.isBuffer(rawBuffer) || rawBuffer.length === 0) {
    throw new Error('صورة الغرفة فارغة أو غير صالحة');
  }
  if (rawBuffer.length > MAX_ROOM_COVER_BYTES) {
    throw new Error('حجم صورة الغرفة يتجاوز الحد الأقصى المسموح به (5 ميجابايت)');
  }
  const magic = detectImageFormatFromMagicBytes(rawBuffer);
  if (!magic) {
    throw new Error('صيغة صورة الغرفة غير مدعومة. يُسمح فقط بصور JPEG و PNG و WebP الحقيقية');
  }

  try {
    const meta = await sharp(rawBuffer, { animated: false, limitInputPixels: 40_000_000 }).metadata();
    if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
      throw new Error('محتوى الملف ليس صورة صالحة');
    }
    if (!meta.width || !meta.height || meta.width < 1 || meta.height < 1) {
      throw new Error('أبعاد صورة الغرفة غير صالحة');
    }

    const processed = await sharp(rawBuffer, { animated: false, limitInputPixels: 40_000_000 })
      .rotate()
      .resize(960, 540, { fit: 'cover', position: 'center', withoutEnlargement: true })
      .webp({ quality: 84, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (!processed.data || processed.data.length === 0) {
      throw new Error('فشل معالجة صورة الغرفة');
    }

    return {
      buffer: processed.data,
      contentType: 'image/webp',
      width: processed.info.width || 960,
      height: processed.info.height || 540,
    };
  } catch (err: any) {
    if (err?.message && (err.message.includes('صيغة') || err.message.includes('أبعاد') || err.message.includes('حجم'))) {
      throw err;
    }
    throw new Error('ملف صورة الغرفة تالف أو غير صالح');
  }
}

export async function uploadRoomCoverObject(
  roomId: string,
  webpBuffer: Buffer
): Promise<{ key: string; storage: 's3' | 'local' }> {
  const key = buildUniqueRoomCoverKey(roomId);
  if (isS3Configured()) {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: AVATARS_BUCKET,
        Key: key,
        Body: webpBuffer,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=300',
      })
    );
    return { key, storage: 's3' };
  }

  const targetPath = resolveLocalRoomImagePath(key);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, webpBuffer);
  return { key, storage: 'local' };
}

export async function readRoomCoverFromStorage(key: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  if (!isValidRoomCoverKey(key)) return null;

  if (isS3Configured()) {
    try {
      const client = getS3Client();
      const res = await client.send(
        new GetObjectCommand({
          Bucket: AVATARS_BUCKET,
          Key: key,
        })
      );
      if (res.Body) {
        const chunks: Uint8Array[] = [];
        for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
        return { buffer: Buffer.concat(chunks), contentType: res.ContentType || 'image/webp' };
      }
    } catch {}
  }

  try {
    const localPath = resolveLocalRoomImagePath(key);
    if (!fs.existsSync(localPath)) return null;
    const buffer = fs.readFileSync(localPath);
    if (!buffer || buffer.length === 0) return null;
    return { buffer, contentType: 'image/webp' };
  } catch {
    return null;
  }
}

export async function deleteRoomCoverObject(key: string): Promise<void> {
  if (!isValidRoomCoverKey(key)) return;
  if (isS3Configured()) {
    try {
      const client = getS3Client();
      await client.send(new DeleteObjectCommand({ Bucket: AVATARS_BUCKET, Key: key }));
    } catch {}
  }
  try {
    const localPath = resolveLocalRoomImagePath(key);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  } catch {}
}

export async function deleteAllRoomImagesForRoom(roomId: string, coverKey?: string | null): Promise<void> {
  if (coverKey) {
    await deleteRoomCoverObject(coverKey).catch(() => {});
  }
  const safeRoomId = sanitizeUserIdForKey(roomId);
  if (!safeRoomId) return;

  if (isS3Configured()) {
    try {
      const client = getS3Client();
      const prefix = `rooms/${safeRoomId}/`;
      const listed = await client.send(
        new ListObjectsV2Command({
          Bucket: AVATARS_BUCKET,
          Prefix: prefix,
        })
      );
      if (Array.isArray(listed.Contents)) {
        for (const item of listed.Contents) {
          if (item.Key) {
            await client
              .send(new DeleteObjectCommand({ Bucket: AVATARS_BUCKET, Key: item.Key }))
              .catch(() => {});
          }
        }
      }
    } catch {}
  }

  try {
    const roomDir = path.resolve(LOCAL_ROOM_IMAGES_ROOT, 'rooms', safeRoomId);
    const rootPrefix = LOCAL_ROOM_IMAGES_ROOT.endsWith(path.sep)
      ? LOCAL_ROOM_IMAGES_ROOT
      : LOCAL_ROOM_IMAGES_ROOT + path.sep;
    if (roomDir.startsWith(rootPrefix) && fs.existsSync(roomDir)) {
      fs.rmSync(roomDir, { recursive: true, force: true });
    }
  } catch {}
}

