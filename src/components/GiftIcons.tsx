import React, { useId } from 'react';

interface GiftSvgIconProps {
  giftId?: string | null;
  className?: string;
}

/**
 * Custom crisp SVG artwork for every gift in SOULX_GIFTS + default gift box.
 * Uses unique per-instance gradient IDs to prevent SVG <defs> collisions.
 */
export const GiftSvgIcon: React.FC<GiftSvgIconProps> = ({
  giftId = 'default',
  className = 'w-8 h-8',
}) => {
  const rawUid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (giftId || 'default').toLowerCase();
  const gid = (name: string) => `gx-${rawUid}-${name}`;

  switch (id) {
    // 1. وردة روحية (Soul Rose)
    case 'rose':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('r1')} x1="18" y1="8" x2="46" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="55%" stopColor="#E11D48" />
              <stop offset="100%" stopColor="#9F1239" />
            </linearGradient>
            <linearGradient id={gid('r2')} x1="30" y1="34" x2="34" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#22C55E" />
              <stop offset="100%" stopColor="#15803D" />
            </linearGradient>
          </defs>
          <path d="M32 34V57" stroke={`url(#${gid('r2')})`} strokeWidth="4" strokeLinecap="round" />
          <path d="M32 45C24 45 19 40 19 36C25 36 30 39 32 45Z" fill="#22C55E" />
          <path d="M32 49C40 49 45 44 45 40C39 40 34 43 32 49Z" fill="#16A34A" />
          <path
            d="M21 20C21 12 26 8 32 8C38 8 43 12 43 20C47 21 48 27 44 32C40 37 36 38 32 38C28 38 24 37 20 32C16 27 17 21 21 20Z"
            fill={`url(#${gid('r1')})`}
          />
          <path d="M25 18C25 14 28 11 32 11C36 11 39 14 39 18C39 22 36 25 32 25C28 25 25 22 25 18Z" fill="#FDA4AF" fillOpacity="0.45" />
          <path d="M27 17C29 15 35 15 37 18C35 21 29 21 27 17Z" fill="#FFE4E6" fillOpacity="0.6" />
          <path d="M26 35L32 39L38 35L34 38H30L26 35Z" fill="#16A34A" />
        </svg>
      );

    // 2. قهوة فاخرة (Luxury Coffee)
    case 'coffee':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('c1')} x1="14" y1="24" x2="48" y2="52" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
          </defs>
          <path d="M23 18C21 14 25 11 23 7" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
          <path d="M32 17C30 13 34 10 32 6" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" />
          <path d="M41 18C39 14 43 11 41 7" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
          <ellipse cx="32" cy="52" rx="22" ry="5" fill="#D97706" fillOpacity="0.3" />
          <path d="M45 28H50C53.3 28 56 30.7 56 34C56 37.3 53.3 40 50 40H45" stroke="#D97706" strokeWidth="4" strokeLinecap="round" />
          <path d="M15 24H47V37C47 45.8 39.8 52 31 52C22.2 52 15 45.8 15 37V24Z" fill={`url(#${gid('c1')})`} />
          <ellipse cx="31" cy="24" rx="16" ry="4.5" fill="#FEF3C7" />
          <ellipse cx="31" cy="24.5" rx="12.5" ry="3" fill="#78350F" />
          <path d="M22 33C24 31 28 31 30 33" stroke="#FEF3C7" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        </svg>
      );

    // 3. ماسة نقية (Pure Diamond)
    case 'diamond':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('d1')} x1="8" y1="12" x2="56" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#67E8F9" />
              <stop offset="50%" stopColor="#06B6D4" />
              <stop offset="100%" stopColor="#2563EB" />
            </linearGradient>
          </defs>
          <polygon points="18,12 46,12 58,26 32,56 6,26" fill={`url(#${gid('d1')})`} />
          <polygon points="18,12 46,12 41,26 23,26" fill="#CFFAFE" fillOpacity="0.65" />
          <polygon points="6,26 23,26 32,56" fill="#0891B2" fillOpacity="0.65" />
          <polygon points="58,26 41,26 32,56" fill="#1D4ED8" fillOpacity="0.55" />
          <polygon points="23,26 41,26 32,56" fill="#67E8F9" fillOpacity="0.45" />
          <path d="M18 12L23 26L32 12L41 26L46 12" stroke="#ECFEFF" strokeWidth="1.4" strokeOpacity="0.8" />
        </svg>
      );

    // 4. قلب متوهج (Glowing Heart)
    case 'heart':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('h1')} x1="12" y1="12" x2="52" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F472B6" />
              <stop offset="50%" stopColor="#EC4899" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>
          </defs>
          <path
            d="M32 54C32 54 8 39.5 8 22.5C8 14.8 14 9 21.5 9C26.2 9 30.1 11.4 32 14.8C33.9 11.4 37.8 9 42.5 9C50 9 56 14.8 56 22.5C56 39.5 32 54 32 54Z"
            fill={`url(#${gid('h1')})`}
          />
          <path
            d="M17 18C17 14.8 19.6 13 22.5 13"
            stroke="#FCE7F3"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.85"
          />
          <path d="M48 10L49.5 13.5L53 15L49.5 16.5L48 20L46.5 16.5L43 15L46.5 13.5L48 10Z" fill="#FDE047" />
        </svg>
      );

    // 5. باقة زهور (Flower Bouquet)
    case 'bouquet':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('b1')} x1="20" y1="30" x2="44" y2="58" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F472B6" />
              <stop offset="100%" stopColor="#DB2777" />
            </linearGradient>
          </defs>
          <path d="M18 28L32 58L46 28H18Z" fill={`url(#${gid('b1')})`} />
          <path d="M22 28L32 54L42 28H22Z" fill="#FBCFE8" fillOpacity="0.35" />
          <circle cx="21" cy="21" r="7" fill="#FB7185" />
          <circle cx="21" cy="21" r="2.8" fill="#FEF08A" />
          <circle cx="43" cy="21" r="7" fill="#C084FC" />
          <circle cx="43" cy="21" r="2.8" fill="#FEF08A" />
          <circle cx="32" cy="15" r="8" fill="#F43F5E" />
          <circle cx="32" cy="15" r="3" fill="#FDE047" />
          <circle cx="32" cy="26" r="6.5" fill="#FBBF24" />
          <circle cx="32" cy="26" r="2.5" fill="#FFFBEB" />
          <rect x="27" y="42" width="10" height="4" rx="2" fill="#FDE047" />
        </svg>
      );

    // 6. تاج الأرواح (Soul Crown)
    case 'crown':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('cr1')} x1="10" y1="14" x2="54" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
          </defs>
          <path d="M8 22L19 34L32 14L45 34L56 22L50 48H14L8 22Z" fill={`url(#${gid('cr1')})`} />
          <rect x="13" y="46" width="38" height="6" rx="3" fill="#B45309" />
          <circle cx="8" cy="20" r="3.5" fill="#FEF08A" />
          <circle cx="32" cy="12" r="4" fill="#FEF08A" />
          <circle cx="56" cy="20" r="3.5" fill="#FEF08A" />
          <circle cx="32" cy="34" r="4" fill="#06B6D4" />
          <circle cx="21" cy="38" r="2.8" fill="#F43F5E" />
          <circle cx="43" cy="38" r="2.8" fill="#F43F5E" />
        </svg>
      );

    // 7. صاروخ الإعجاب (Super Rocket)
    case 'rocket':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('rk1')} x1="18" y1="10" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#6D28D9" />
            </linearGradient>
          </defs>
          <path d="M16 40L10 54L24 48" fill="#F97316" />
          <path d="M18 42L14 50L22 46" fill="#FDE047" />
          <path d="M22 26L12 30L18 39" fill="#EC4899" />
          <path d="M38 42L34 52L25 46" fill="#EC4899" />
          <path
            d="M52 12C39 12 27 20 20 34L30 44C44 37 52 25 52 12Z"
            fill={`url(#${gid('rk1')})`}
          />
          <path d="M52 12C45 12 39 14 34 18L46 30C50 25 52 19 52 12Z" fill="#F43F5E" />
          <circle cx="36" cy="28" r="5.5" fill="#38BDF8" stroke="#E0F2FE" strokeWidth="2" />
        </svg>
      );

    // 8. مجرة التوافق (Soul Galaxy)
    case 'galaxy':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <radialGradient id={gid('gx1')} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="40%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.1" />
            </radialGradient>
          </defs>
          <circle cx="32" cy="32" r="24" fill={`url(#${gid('gx1')})`} />
          <ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(-24 32 32)" stroke="#67E8F9" strokeWidth="2.5" strokeOpacity="0.85" />
          <ellipse cx="32" cy="32" rx="18" ry="6.5" transform="rotate(-24 32 32)" stroke="#C084FC" strokeWidth="2" strokeOpacity="0.8" />
          <circle cx="32" cy="32" r="6" fill="#FEF9C3" />
          <circle cx="14" cy="18" r="2" fill="#FFFFFF" />
          <circle cx="50" cy="16" r="1.8" fill="#67E8F9" />
          <circle cx="48" cy="48" r="2.2" fill="#FDE047" />
          <circle cx="16" cy="46" r="1.5" fill="#E879F9" />
        </svg>
      );

    // 9. خاتم الأبدية (Eternity Ring)
    case 'ring':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('rn1')} x1="16" y1="22" x2="48" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="38" r="16" stroke={`url(#${gid('rn1')})`} strokeWidth="6" />
          <circle cx="32" cy="38" r="13" stroke="#FEF9C3" strokeWidth="1" strokeOpacity="0.6" />
          <polygon points="24,12 40,12 45,19 32,28 19,19" fill="#38BDF8" />
          <polygon points="24,12 40,12 36,19 28,19" fill="#E0F2FE" fillOpacity="0.8" />
          <polygon points="19,19 28,19 32,28" fill="#0284C7" fillOpacity="0.7" />
        </svg>
      );

    // 10. وحيد القرن (Magic Unicorn)
    case 'unicorn':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('un1')} x1="18" y1="6" x2="34" y2="26" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id={gid('un2')} x1="14" y1="20" x2="48" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F472B6" />
              <stop offset="50%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
          </defs>
          <path d="M29 6L35 22H25L29 6Z" fill={`url(#${gid('un1')})`} />
          <path d="M18 24C14 30 14 42 20 50H32C28 42 27 32 30 24H18Z" fill={`url(#${gid('un2')})`} />
          <path
            d="M22 24C22 19 27 17 33 18C39 19 49 26 51 32C52 36 49 40 44 40C40 40 36 38 33 36V52H22V24Z"
            fill="#F8FAFC"
            stroke="#E2E8F0"
            strokeWidth="1.5"
          />
          <circle cx="38" cy="27" r="2.2" fill="#312E81" />
          <circle cx="46" cy="34" r="2" fill="#F472B6" fillOpacity="0.65" />
          <path d="M22 21L16 15L24 18Z" fill="#FBCFE8" />
        </svg>
      );

    // 11. ألعاب نارية (Royal Fireworks)
    case 'fireworks':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <circle cx="32" cy="28" r="4.5" fill="#FDE047" />
          <path d="M32 20V8" stroke="#F43F5E" strokeWidth="3" strokeLinecap="round" />
          <path d="M32 36V48" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
          <path d="M24 28H12" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
          <path d="M40 28H52" stroke="#A855F7" strokeWidth="3" strokeLinecap="round" />
          <path d="M26 22L16 12" stroke="#FB7185" strokeWidth="3" strokeLinecap="round" />
          <path d="M38 22L48 12" stroke="#34D399" strokeWidth="3" strokeLinecap="round" />
          <path d="M26 34L16 44" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
          <path d="M38 34L48 44" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round" />
          <circle cx="16" cy="12" r="2.5" fill="#FDE047" />
          <circle cx="48" cy="12" r="2.5" fill="#FDE047" />
          <circle cx="12" cy="28" r="2.5" fill="#FDE047" />
          <circle cx="52" cy="28" r="2.5" fill="#FDE047" />
          <path d="M32 48L28 58M32 48L36 58" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    // 12. سيارة خارقة (Supercar)
    case 'supercar':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('sc1')} x1="6" y1="24" x2="58" y2="44" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F97316" />
              <stop offset="50%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#B91C1C" />
            </linearGradient>
          </defs>
          <path d="M8 38L14 28L28 22H42L52 30L58 34V42H6L8 38Z" fill={`url(#${gid('sc1')})`} />
          <path d="M22 28L28 23.5H40L47 29H22V28Z" fill="#BAE6FD" />
          <path d="M51 33H57V37H53L51 33Z" fill="#FEF08A" />
          <circle cx="18" cy="43" r="6.5" fill="#1E293B" stroke="#94A3B8" strokeWidth="2" />
          <circle cx="18" cy="43" r="2.5" fill="#E2E8F0" />
          <circle cx="47" cy="43" r="6.5" fill="#1E293B" stroke="#94A3B8" strokeWidth="2" />
          <circle cx="47" cy="43" r="2.5" fill="#E2E8F0" />
        </svg>
      );

    // 13. يخت فاخر (Luxury Yacht)
    case 'yacht':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('yt1')} x1="8" y1="30" x2="56" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="100%" stopColor="#CBD5E1" />
            </linearGradient>
          </defs>
          <path d="M20 28L25 18H40L45 28H20Z" fill="#E2E8F0" />
          <rect x="26" y="21" width="12" height="4" rx="1.5" fill="#38BDF8" />
          <rect x="31" y="12" width="2.5" height="6" rx="1" fill="#64748B" />
          <path d="M8 32H56L48 44H14L8 32Z" fill={`url(#${gid('yt1')})`} />
          <path d="M10 35H54L51 39H12L10 35Z" fill="#0284C7" />
          <path d="M6 48C12 45 18 51 24 48C30 45 36 51 42 48C48 45 54 51 58 48" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    // 14. طائرة خاصة (Private Jet)
    case 'jet':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('jt1')} x1="8" y1="16" x2="56" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="100%" stopColor="#94A3B8" />
            </linearGradient>
          </defs>
          <path d="M28 12L36 12L42 30H24L28 12Z" fill="#38BDF8" />
          <path d="M26 36H40L34 52H28L26 36Z" fill="#0284C7" />
          <path d="M10 28L16 20H21L19 29H48C53 29 57 31 57 33C57 35 53 37 48 37H14L10 28Z" fill={`url(#${gid('jt1')})`} />
          <circle cx="32" cy="33" r="1.5" fill="#0EA5E9" />
          <circle cx="38" cy="33" r="1.5" fill="#0EA5E9" />
          <circle cx="44" cy="33" r="1.5" fill="#0EA5E9" />
        </svg>
      );

    // 15. قصر الأحلام (Dream Castle)
    case 'castle':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('cs1')} x1="12" y1="16" x2="52" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#C4B5FD" />
              <stop offset="100%" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
          <polygon points="10,24 16,12 22,24" fill="#F43F5E" />
          <polygon points="42,24 48,12 54,24" fill="#F43F5E" />
          <polygon points="25,18 32,6 39,18" fill="#F59E0B" />
          <rect x="11" y="24" width="10" height="30" fill="#A78BFA" />
          <rect x="43" y="24" width="10" height="30" fill="#A78BFA" />
          <rect x="21" y="18" width="22" height="36" fill={`url(#${gid('cs1')})`} />
          <path d="M26 54V42C26 38.7 28.7 36 32 36C35.3 36 38 38.7 38 42V54H26Z" fill="#4C1D95" />
          <rect x="29" y="24" width="6" height="7" rx="3" fill="#FDE047" />
        </svg>
      );

    // 16. جزيرة خاصة (Private Island)
    case 'island':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <circle cx="48" cy="16" r="7" fill="#FDE047" />
          <path d="M8 48C14 45 20 51 26 48C32 45 38 51 44 48C50 45 54 49 58 47" stroke="#06B6D4" strokeWidth="3" strokeLinecap="round" />
          <path d="M14 46C18 38 26 35 34 35C42 35 48 39 50 46H14Z" fill="#FBBF24" />
          <path d="M29 36C29 28 31 23 34 19" stroke="#92400E" strokeWidth="4" strokeLinecap="round" />
          <path d="M34 19C26 14 20 17 17 22C23 20 29 20 34 19Z" fill="#10B981" />
          <path d="M34 19C31 11 25 9 20 11C26 13 30 15 34 19Z" fill="#34D399" />
          <path d="M34 19C41 13 47 16 50 21C44 19 39 19 34 19Z" fill="#10B981" />
          <path d="M34 19C39 11 45 10 49 13C43 14 39 16 34 19Z" fill="#059669" />
        </svg>
      );

    // 17. عنقاء الخلود (Eternal Phoenix)
    case 'phoenix':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('px1')} x1="8" y1="12" x2="56" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="50%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#DC2626" />
            </linearGradient>
          </defs>
          <path
            d="M32 10C36 10 39 14 37 19C44 16 53 15 56 22C50 25 46 28 42 32C47 34 50 38 48 44C42 42 38 40 35 38L32 54L29 38C26 40 22 42 16 44C14 38 17 34 22 32C18 28 14 25 8 22C11 15 20 16 27 19C25 14 28 10 32 10Z"
            fill={`url(#${gid('px1')})`}
          />
          <path d="M32 18L36 28L32 38L28 28L32 18Z" fill="#FEF08A" />
          <circle cx="32" cy="14" r="1.5" fill="#7C2D12" />
        </svg>
      );

    // 18. كوكب ذهبي (Golden Planet)
    case 'planet':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('pl1')} x1="16" y1="14" x2="48" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="16" fill={`url(#${gid('pl1')})`} />
          <ellipse cx="32" cy="32" rx="27" ry="8" transform="rotate(-22 32 32)" stroke="#FDE047" strokeWidth="3.5" />
          <circle cx="26" cy="25" r="3" fill="#FFFBEB" fillOpacity="0.5" />
          <circle cx="38" cy="37" r="2" fill="#92400E" fillOpacity="0.35" />
        </svg>
      );

    // 19. عرش الملوك (Sovereign Throne)
    case 'throne':
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('th1')} x1="14" y1="8" x2="50" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="55%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
          </defs>
          <path d="M18 14L25 20L32 8L39 20L46 14V38H18V14Z" fill={`url(#${gid('th1')})`} />
          <rect x="22" y="22" width="20" height="16" rx="3" fill="#991B1B" />
          <rect x="14" y="36" width="36" height="8" rx="3" fill="#F59E0B" />
          <rect x="16" y="44" width="6" height="12" rx="2" fill="#B45309" />
          <rect x="42" y="44" width="6" height="12" rx="2" fill="#B45309" />
          <circle cx="32" cy="29" r="3.5" fill="#FDE047" />
        </svg>
      );

    // Default Gift Box
    default:
      return (
        <svg viewBox="0 0 64 64" fill="none" className={className} aria-hidden="true">
          <defs>
            <linearGradient id={gid('df1')} x1="12" y1="22" x2="52" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>
          </defs>
          <rect x="12" y="28" width="40" height="26" rx="5" fill={`url(#${gid('df1')})`} />
          <rect x="9" y="20" width="46" height="10" rx="4" fill="#F43F5E" />
          <rect x="28" y="20" width="8" height="34" fill="#FDE047" />
          <path d="M32 20C25 20 19 16 19 11C19 8.2 21.5 7 24 7C28 7 31 12 32 20Z" fill="#FACC15" />
          <path d="M32 20C39 20 45 16 45 11C45 8.2 42.5 7 40 7C36 7 33 12 32 20Z" fill="#FDE047" />
        </svg>
      );
  }
};
