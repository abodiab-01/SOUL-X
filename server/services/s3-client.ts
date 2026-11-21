import crypto from 'crypto';
import sharp from 'sharp';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const AVATARS_BUCKET = (process.env.S3_AVATARS_BUCKET || 'profilepic').trim() || 'profilepic';
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_AVATAR_DIMENSION = 512;

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
 * resizes down to max 512x512 when needed, and converts/compresses to WebP.
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
      limitInputPixels: 25_000_000,
    });

    const meta = await pipeline.metadata();
    if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
      throw new Error('محتوى الملف ليس صورة صالحة بصيغة JPEG أو PNG أو WebP');
    }
    if (!meta.width || !meta.height || meta.width < 1 || meta.height < 1) {
      throw new Error('أبعاد الصورة غير صالحة');
    }

    const processed = await sharp(rawBuffer, {
      animated: false,
      limitInputPixels: 25_000_000,
    })
      .rotate()
      .resize(MAX_AVATAR_DIMENSION, MAX_AVATAR_DIMENSION, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (!processed.data || processed.data.length === 0) {
      throw new Error('فشل معالجة وضغط الصورة');
    }

    return {
      buffer: processed.data,
      contentType: 'image/webp',
      width: processed.info.width || MAX_AVATAR_DIMENSION,
      height: processed.info.height || MAX_AVATAR_DIMENSION,
    };
  } catch (err: any) {
    if (err?.message && (err.message.includes('صيغة') || err.message.includes('أبعاد') || err.message.includes('حجم'))) {
      throw err;
    }
    throw new Error('الملف المرفوع تالف أو ليس صورة صالحة');
  }
}

/**
 * Uploads processed WebP avatar to Private Neon Object Storage bucket `profilepic`.
 */
export async function uploadAvatarObject(
  userId: string,
  webpBuffer: Buffer
): Promise<{ key: string }> {
  const client = getS3Client();
  const key = buildUniqueAvatarKey(userId);

  await client.send(
    new PutObjectCommand({
      Bucket: AVATARS_BUCKET,
      Key: key,
      Body: webpBuffer,
      ContentType: 'image/webp',
      CacheControl: 'private, max-age=300',
    })
  );

  return { key };
}

/**
 * Deletes an avatar object by key from Neon Object Storage.
 */
export async function deleteAvatarObject(key: string): Promise<void> {
  if (!isValidAvatarKey(key)) {
    throw new Error('مسار الصورة غير صالح للحذف');
  }
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: AVATARS_BUCKET,
      Key: key,
    })
  );
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
 * Checks whether an object exists in the private bucket.
 */
export async function avatarObjectExists(key: string): Promise<boolean> {
  if (!isValidAvatarKey(key) || !isS3Configured()) return false;
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
    return false;
  }
}

/**
 * Reads an avatar object from Private Neon Object Storage using the S3 Client (or temporary signed URL)
 * so the backend can stream private image bytes safely without leaking S3 credentials or endpoints to the browser.
 */
export async function readAvatarObjectFromStorage(key: string): Promise<{
  buffer: Buffer;
  contentType: string;
} | null> {
  if (!isValidAvatarKey(key)) {
    return null;
  }
  try {
    const client = getS3Client();
    const res = await client.send(
      new GetObjectCommand({
        Bucket: AVATARS_BUCKET,
        Key: key,
      })
    );
    if (!res.Body) return null;
    const chunks: Uint8Array[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return {
      buffer: Buffer.concat(chunks),
      contentType: res.ContentType || 'image/webp',
    };
  } catch {
    return null;
  }
}
