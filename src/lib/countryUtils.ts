import { WORLD_COUNTRIES } from '../data/countries';
import { Language } from '../types';

/**
 * Unified Country Formatter:
 * Ensures the user's country is displayed consistently in the user's selected app language (ar / en),
 * resolving Arabic or English input to the official unified name set during account registration.
 */
export function formatCountryUnified(
  countryRaw: string | undefined | null,
  lang: Language = 'ar'
): string {
  if (!countryRaw || !countryRaw.trim()) {
    return lang === 'ar' ? 'المملكة العربية السعودية' : 'Saudi Arabia';
  }

  const rawTrimmed = countryRaw.trim();
  const cleaned = rawTrimmed.toLowerCase();

  // 1. Direct match by Arabic name, English name, or ISO code
  const exactMatch = WORLD_COUNTRIES.find((c) => {
    return (
      c.nameAr.toLowerCase() === cleaned ||
      c.nameEn.toLowerCase() === cleaned ||
      c.code.toLowerCase() === cleaned
    );
  });

  if (exactMatch) {
    return lang === 'ar' ? exactMatch.nameAr : exactMatch.nameEn;
  }

  // 2. Substring match for common variants (e.g. "سوريا" matches "الجمهورية العربية السورية")
  const partialMatch = WORLD_COUNTRIES.find((c) => {
    if (rawTrimmed.length >= 3) {
      if (c.nameAr.includes(rawTrimmed) || rawTrimmed.includes(c.nameAr)) return true;
      if (c.nameEn.toLowerCase().includes(cleaned) || cleaned.includes(c.nameEn.toLowerCase())) return true;
    }
    return false;
  });

  if (partialMatch) {
    return lang === 'ar' ? partialMatch.nameAr : partialMatch.nameEn;
  }

  // 3. Fallback to original registered country string
  return rawTrimmed;
}
