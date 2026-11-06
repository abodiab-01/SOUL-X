import { Language } from '../types';

/**
 * Universal Time (UTC) & Browser Local Time utilities.
 * 
 * - Backend and databases store and exchange timestamps strictly in Universal Time (UTC) ISO strings.
 * - This module ensures all UTC timestamps are translated and rendered according to the
 *   user's local browser timezone and preferred language (Arabic/English).
 */

/**
 * Returns the user's browser local time zone identifier (e.g. "Asia/Riyadh", "Africa/Cairo", "America/New_York").
 */
export function getUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Returns the browser's current UTC offset formatted as GMT+X or GMT-X (e.g. "GMT+3", "GMT+5:30").
 */
export function getUserTimeZoneOffset(): string {
  try {
    const offsetMinutes = -new Date().getTimezoneOffset();
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(offsetMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    if (minutes === 0) {
      return `GMT${sign}${hours}`;
    }
    return `GMT${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
  } catch {
    return 'GMT+0';
  }
}

/**
 * Safely parses any input (ISO UTC string, number, Date) into a valid Date object.
 * Standardizes ISO strings without explicit timezone offsets as UTC.
 */
export function parseUtcDate(input?: string | number | Date | null): Date | null {
  if (!input) return null;

  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // If it looks like a pure numeric timestamp (millis or seconds)
    if (/^\d{10,13}$/.test(trimmed)) {
      const num = Number(trimmed);
      const d = new Date(trimmed.length === 10 ? num * 1000 : num);
      if (!isNaN(d.getTime())) return d;
    }

    // If it's an ISO string without 'Z' and without offset (e.g., "2026-11-03T16:22:45")
    // Treat as UTC by appending 'Z'
    let isoString = trimmed;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(isoString)) {
      isoString += 'Z';
    }

    const parsed = new Date(isoString);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    // Legacy date format fallback
    const legacy = new Date(trimmed);
    if (!isNaN(legacy.getTime())) {
      return legacy;
    }
  }

  return null;
}

/**
 * Translates a UTC timestamp to the user's browser local time (e.g. "10:30 ص" or "10:30 AM").
 */
export function formatLocalTime(
  input?: string | number | Date | null,
  lang: Language = 'ar'
): string {
  const date = parseUtcDate(input);
  if (!date) {
    // If the input was already a pre-formatted string (e.g. legacy fallback), return it
    if (typeof input === 'string' && input.trim()) return input;
    return lang === 'ar' ? 'الآن' : 'Now';
  }

  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  try {
    return date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

/**
 * Translates a UTC timestamp to the user's browser local date (e.g. "3 نوفمبر 2026" or "Nov 3, 2026").
 */
export function formatLocalDate(
  input?: string | number | Date | null,
  lang: Language = 'ar'
): string {
  const date = parseUtcDate(input);
  if (!date) {
    if (typeof input === 'string' && input.trim()) return input;
    return lang === 'ar' ? 'اليوم' : 'Today';
  }

  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  try {
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * Translates a UTC timestamp to the user's browser local Date & Time (e.g. "3 نوفمبر 2026، 10:30 ص").
 */
export function formatLocalDateTime(
  input?: string | number | Date | null,
  lang: Language = 'ar'
): string {
  const date = parseUtcDate(input);
  if (!date) {
    if (typeof input === 'string' && input.trim()) return input;
    return lang === 'ar' ? 'الآن' : 'Now';
  }

  const locale = lang === 'ar' ? 'ar-SA' : 'en-US';
  try {
    return date.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return date.toLocaleString();
  }
}

/**
 * Smart relative or local time formatter for chats & conversation lists:
 * - If today in browser's local time: "10:30 ص"
 * - If yesterday in browser's local time: "أمس 10:30 ص"
 * - If within the last 6 days: Day name + time ("الأحد 10:30 ص")
 * - If older: Short date ("03/11/2026")
 */
export function formatRelativeChatTime(
  input?: string | number | Date | null,
  lang: Language = 'ar'
): string {
  const date = parseUtcDate(input);
  if (!date) {
    if (typeof input === 'string' && input.trim()) return input;
    return lang === 'ar' ? 'الآن' : 'Now';
  }

  const now = new Date();
  const isAr = lang === 'ar';
  const locale = isAr ? 'ar-SA' : 'en-US';

  // Check if same calendar day in user's browser local time
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return formatLocalTime(date, lang);
  }

  // Check yesterday in browser local time
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();

  const timeStr = formatLocalTime(date, lang);

  if (isYesterday) {
    return isAr ? `أمس ${timeStr}` : `Yesterday ${timeStr}`;
  }

  // Check within 6 days
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays >= 0 && diffDays < 6) {
    try {
      const dayName = date.toLocaleDateString(locale, { weekday: 'short' });
      return `${dayName} ${timeStr}`;
    } catch {
      return timeStr;
    }
  }

  // Older: short date format
  try {
    return date.toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return date.toLocaleDateString();
  }
}

/**
 * Formats a Date or timestamp as standardized UTC string (e.g. "16:22:45 UTC")
 */
export function formatUtcTime(input?: string | number | Date | null): string {
  const date = parseUtcDate(input) || new Date();
  const hours = date.getUTCHours().toString().padStart(2, '0');
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const seconds = date.getUTCSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds} UTC`;
}

/**
 * Formats date and time strictly with English numerals (0-9)
 * e.g. "2026-11-05 04:40 PM"
 */
export function formatEnglishDateTime(input?: string | number | Date | null): string {
  const date = parseUtcDate(input) || new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  let hours = date.getHours();
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${year}-${month}-${day} ${pad(hours)}:${minutes}:${seconds} ${ampm}`;
}
