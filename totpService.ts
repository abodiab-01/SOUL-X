import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encodes a buffer into a standard Base32 string (RFC 4648) without padding
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Decodes a Base32 string into a Buffer
 */
export function base32Decode(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/**
 * Generates a random Base32 secret for Google Authenticator (default 20 bytes -> 32 base32 chars)
 */
export function generateTotpSecret(bytesCount = 20): string {
  const randomBytes = crypto.randomBytes(bytesCount);
  return base32Encode(randomBytes);
}

/**
 * Generates single-use backup recovery codes formatted as XXXX-XXXX
 */
export function generateBackupCodes(count = 8): string[] {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const buf = crypto.randomBytes(8);
    let code = '';
    for (let j = 0; j < 8; j++) {
      code += chars[buf[j] % chars.length];
    }
    codes.push(`${code.substring(0, 4)}-${code.substring(4, 8)}`);
  }
  return codes;
}

/**
 * Generates 6-digit TOTP code (RFC 6238) for a given timestamp
 */
export function generateTOTP(secret: string, time = Date.now()): string {
  const key = base32Decode(secret);
  const epoch = Math.floor(time / 1000);
  const counter = Math.floor(epoch / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));

  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const token = binary % 1000000;
  return token.toString().padStart(6, '0');
}

/**
 * Verifies a 6-digit TOTP code with time drift window (default ±1 step: ±30 seconds)
 */
export function verifyTOTP(token: string, secret: string, window = 1): boolean {
  if (!token || !secret) return false;
  const cleanToken = token.trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanToken)) return false;

  const currentTime = Date.now();
  for (let errorStep = -window; errorStep <= window; errorStep++) {
    const checkTime = currentTime + errorStep * 30 * 1000;
    const generated = generateTOTP(secret, checkTime);
    if (generated === cleanToken) {
      return true;
    }
  }
  return false;
}

/**
 * Generates the otpauth:// URI that Google Authenticator scans via QR code
 */
export function generateTotpUri(label: string, issuer: string, secret: string): string {
  const encIssuer = encodeURIComponent(issuer);
  const encLabel = encodeURIComponent(label);
  return `otpauth://totp/${encIssuer}:${encLabel}?secret=${secret}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`;
}
