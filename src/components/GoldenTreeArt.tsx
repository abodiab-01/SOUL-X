import React, { useId } from 'react';

export type GoldenTreeRegularSymbolId =
  | 'seven'
  | 'watermelon'
  | 'grapes'
  | 'bell'
  | 'cherry'
  | 'orange'
  | 'lemon'
  | 'plum';

export type GoldenTreeSymbolId =
  | GoldenTreeRegularSymbolId
  | 'wild'
  | 'scatter_dollar'
  | 'scatter_star';

export const GOLDEN_TREE_ALL_SYMBOLS: readonly GoldenTreeSymbolId[] = [
  'seven',
  'watermelon',
  'grapes',
  'bell',
  'cherry',
  'orange',
  'lemon',
  'plum',
  'wild',
  'scatter_dollar',
  'scatter_star',
] as const;

export const GOLDEN_TREE_REGULAR_SYMBOLS: readonly GoldenTreeRegularSymbolId[] = [
  'seven',
  'watermelon',
  'grapes',
  'bell',
  'cherry',
  'orange',
  'lemon',
  'plum',
] as const;

export const PAYLINE_COLORS: readonly string[] = [
  '#FACC15', // Line 1: Gold
  '#38BDF8', // Line 2: Sky Blue
  '#FB7185', // Line 3: Rose
  '#34D399', // Line 4: Emerald
  '#C084FC', // Line 5: Violet
  '#FB923C', // Line 6: Amber Orange
  '#2DD4BF', // Line 7: Teal
  '#F472B6', // Line 8: Pink
  '#A3E635', // Line 9: Lime
  '#FDE047', // Line 10: Bright Yellow
] as const;

export const GOLDEN_TREE_SYMBOL_LABELS: Record<
  GoldenTreeSymbolId,
  { ar: string; en: string; isSpecial?: boolean }
> = {
  seven: { ar: 'الرقم 7 الأحمر', en: 'Lucky Red 7' },
  watermelon: { ar: 'البطيخ', en: 'Watermelon' },
  grapes: { ar: 'العنب', en: 'Royal Grapes' },
  bell: { ar: 'الجرس الذهبي', en: 'Golden Bell' },
  cherry: { ar: 'الكرز', en: 'Twin Cherry' },
  orange: { ar: 'البرتقال', en: 'Sun Orange' },
  lemon: { ar: 'الليمون', en: 'Gold Lemon' },
  plum: { ar: 'البرقوق', en: 'Velvet Plum' },
  wild: { ar: 'الشجرة الذهبية Wild', en: 'Golden Tree WILD', isSpecial: true },
  scatter_dollar: { ar: 'الدولار Scatter', en: 'Dollar SCATTER', isSpecial: true },
  scatter_star: { ar: 'النجمة الزرقاء Scatter', en: 'Blue Star SCATTER', isSpecial: true },
};

export const GoldenTreeSymbolArt: React.FC<{
  symbol: GoldenTreeSymbolId;
  className?: string;
  wildMultiplier?: number;
}> = ({ symbol, className = 'w-12 h-12 sm:w-14 sm:h-14', wildMultiplier }) => {
  const rawUid = useId();
  const uid = rawUid.replace(/:/g, '');

  switch (symbol) {
    case 'seven':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={`s7-body-${uid}`} x1="18" y1="12" x2="62" y2="68" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF6B8B" />
              <stop offset="45%" stopColor="#E11D48" />
              <stop offset="100%" stopColor="#881337" />
            </linearGradient>
            <linearGradient id={`s7-gold-${uid}`} x1="12" y1="10" x2="68" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
          </defs>
          <path
            d="M20 15H63L60 27L38 67H23L43 27H20V15Z"
            fill={`url(#s7-body-${uid})`}
            stroke={`url(#s7-gold-${uid})`}
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M24 19H57" stroke="#FFE4E6" strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />
          <path d="M46 29L30 62" stroke="#FDA4AF" strokeWidth="2" strokeLinecap="round" opacity="0.55" />
          <circle cx="59" cy="17" r="3" fill="#FEF08A" />
        </svg>
      );

    case 'watermelon':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={`wm-rind-${uid}`} x1="12" y1="24" x2="68" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4ADE80" />
              <stop offset="55%" stopColor="#16A34A" />
              <stop offset="100%" stopColor="#14532D" />
            </linearGradient>
            <linearGradient id={`wm-flesh-${uid}`} x1="16" y1="22" x2="62" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="55%" stopColor="#E11D48" />
              <stop offset="100%" stopColor="#9F1239" />
            </linearGradient>
          </defs>
          <path
            d="M11 32C11 52 24 66 40 66C56 66 69 52 69 32H11Z"
            fill={`url(#wm-rind-${uid})`}
            stroke="#86EFAC"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            d="M15 32C15 48 26 59 40 59C54 59 65 48 65 32H15Z"
            fill="#DCFCE7"
          />
          <path
            d="M18 32C18 45 27.5 55 40 55C52.5 55 62 45 62 32H18Z"
            fill={`url(#wm-flesh-${uid})`}
          />
          <ellipse cx="30" cy="40" rx="1.9" ry="3.2" transform="rotate(-18 30 40)" fill="#1F2937" />
          <ellipse cx="40" cy="44" rx="1.9" ry="3.2" fill="#1F2937" />
          <ellipse cx="50" cy="40" rx="1.9" ry="3.2" transform="rotate(18 50 40)" fill="#1F2937" />
          <ellipse cx="35" cy="36" rx="1.6" ry="2.6" transform="rotate(-10 35 36)" fill="#1F2937" />
          <ellipse cx="45" cy="36" rx="1.6" ry="2.6" transform="rotate(10 45 36)" fill="#1F2937" />
          <path d="M22 35H58" stroke="#FFE4E6" strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
        </svg>
      );

    case 'grapes':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
          <defs>
            <radialGradient id={`gr-ball-${uid}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#E879F9" />
              <stop offset="50%" stopColor="#9333EA" />
              <stop offset="100%" stopColor="#4C1D95" />
            </radialGradient>
          </defs>
          <path d="M40 12C40 12 41 19 38 23" stroke="#854D0E" strokeWidth="4" strokeLinecap="round" />
          <path
            d="M40 18C47 11 58 14 57 22C51 24 44 23 40 18Z"
            fill="#22C55E"
            stroke="#86EFAC"
            strokeWidth="1.5"
          />
          {[
            [29, 31],
            [40, 30],
            [51, 31],
            [25, 42],
            [35, 41],
            [45, 41],
            [55, 42],
            [31, 52],
            [40, 52],
            [49, 52],
            [40, 62],
          ].map(([cx, cy], idx) => (
            <g key={idx}>
              <circle
                cx={cx}
                cy={cy}
                r="8.2"
                fill={`url(#gr-ball-${uid})`}
                stroke="#F3E8FF"
                strokeOpacity="0.45"
                strokeWidth="1.3"
              />
              <circle cx={cx - 2.6} cy={cy - 2.8} r="2.1" fill="#FFFFFF" opacity="0.5" />
            </g>
          ))}
        </svg>
      );

    case 'bell':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={`bl-gold-${uid}`} x1="16" y1="12" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FEF9C3" />
              <stop offset="35%" stopColor="#FACC15" />
              <stop offset="75%" stopColor="#D97706" />
              <stop offset="100%" stopColor="#92400E" />
            </linearGradient>
          </defs>
          <circle cx="40" cy="61" r="7.5" fill="#B45309" stroke="#FDE047" strokeWidth="2" />
          <circle cx="40" cy="14" r="5" fill="#FDE047" stroke="#B45309" strokeWidth="2" />
          <path
            d="M40 17C26 17 20 28 20 42L14 55C13 57.5 14.8 60 17.5 60H62.5C65.2 60 67 57.5 66 55L60 42C60 28 54 17 40 17Z"
            fill={`url(#bl-gold-${uid})`}
            stroke="#FEF08A"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path d="M27 28C24 34 24 42 22 48" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
          <path d="M18 55H62" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
        </svg>
      );

    case 'cherry':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
          <defs>
            <radialGradient id={`ch-red-${uid}`} cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FDA4AF" />
              <stop offset="40%" stopColor="#E11D48" />
              <stop offset="100%" stopColor="#881337" />
            </radialGradient>
          </defs>
          <path
            d="M28 45C29 30 37 19 46 13C49 23 53 33 54 45"
            stroke="#65A30D"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M46 13C55 11 63 16 61 23C55 25 49 21 46 13Z"
            fill="#22C55E"
            stroke="#86EFAC"
            strokeWidth="1.5"
          />
          <circle cx="27" cy="54" r="13" fill={`url(#ch-red-${uid})`} stroke="#FECDD3" strokeWidth="1.5" />
          <circle cx="53" cy="54" r="13" fill={`url(#ch-red-${uid})`} stroke="#FECDD3" strokeWidth="1.5" />
          <ellipse cx="22.5" cy="49" rx="3.8" ry="2.2" transform="rotate(-25 22.5 49)" fill="#FFFFFF" opacity="0.65" />
          <ellipse cx="48.5" cy="49" rx="3.8" ry="2.2" transform="rotate(-25 48.5 49)" fill="#FFFFFF" opacity="0.65" />
        </svg>
      );

    case 'orange':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
          <defs>
            <radialGradient id={`or-fill-${uid}`} cx="34%" cy="30%" r="72%">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="45%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#C2410C" />
            </radialGradient>
          </defs>
          <path d="M40 16C42 12 45 10 49 11" stroke="#65A30D" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M39 18C32 11 23 13 24 20C29 22 36 22 39 18Z" fill="#22C55E" stroke="#86EFAC" strokeWidth="1.4" />
          <circle cx="40" cy="44" r="23" fill={`url(#or-fill-${uid})`} stroke="#FED7AA" strokeWidth="2" />
          <ellipse cx="31" cy="34" rx="5.5" ry="3.2" transform="rotate(-30 31 34)" fill="#FFFFFF" opacity="0.55" />
          <circle cx="46" cy="52" r="1.4" fill="#EA580C" opacity="0.55" />
          <circle cx="52" cy="44" r="1.4" fill="#EA580C" opacity="0.55" />
          <circle cx="42" cy="58" r="1.4" fill="#EA580C" opacity="0.55" />
        </svg>
      );

    case 'lemon':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
          <defs>
            <radialGradient id={`lm-fill-${uid}`} cx="36%" cy="30%" r="72%">
              <stop offset="0%" stopColor="#FEF9C3" />
              <stop offset="48%" stopColor="#FACC15" />
              <stop offset="100%" stopColor="#CA8A04" />
            </radialGradient>
          </defs>
          <path d="M48 18C55 12 63 14 61 22C56 24 50 22 48 18Z" fill="#22C55E" stroke="#86EFAC" strokeWidth="1.4" />
          <path
            d="M15 44C15 30 28 22 41 22C54 22 65 30 65 44C65 56 53 63 40 63C27 63 15 56 15 44Z"
            fill={`url(#lm-fill-${uid})`}
            stroke="#FEF08A"
            strokeWidth="2.2"
          />
          <circle cx="14" cy="44" r="4" fill="#FACC15" stroke="#FEF08A" strokeWidth="1.6" />
          <circle cx="66" cy="44" r="4" fill="#FACC15" stroke="#FEF08A" strokeWidth="1.6" />
          <ellipse cx="32" cy="33" rx="6.5" ry="3" transform="rotate(-15 32 33)" fill="#FFFFFF" opacity="0.65" />
        </svg>
      );

    case 'plum':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
          <defs>
            <radialGradient id={`pl-fill-${uid}`} cx="35%" cy="30%" r="72%">
              <stop offset="0%" stopColor="#C084FC" />
              <stop offset="48%" stopColor="#7E22CE" />
              <stop offset="100%" stopColor="#3B0764" />
            </radialGradient>
          </defs>
          <path d="M40 16C41 11 45 9 48 10" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
          <path d="M41 17C47 11 55 13 54 20C49 22 43 21 41 17Z" fill="#22C55E" stroke="#86EFAC" strokeWidth="1.3" />
          <path
            d="M40 20C54 20 62 31 61 45C60 58 50 66 40 66C30 66 20 58 19 45C18 31 26 20 40 20Z"
            fill={`url(#pl-fill-${uid})`}
            stroke="#E9D5FF"
            strokeWidth="1.8"
          />
          <path d="M40 22C42 35 42 52 40 64" stroke="#581C87" strokeWidth="2.2" opacity="0.55" />
          <ellipse cx="30" cy="34" rx="4.5" ry="7" transform="rotate(15 30 34)" fill="#FFFFFF" opacity="0.4" />
        </svg>
      );

    case 'wild':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={`wt-gold-${uid}`} x1="16" y1="10" x2="64" y2="70" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FEF9C3" />
              <stop offset="45%" stopColor="#FACC15" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
            <radialGradient id={`wt-glow-${uid}`} cx="50%" cy="38%" r="50%">
              <stop offset="0%" stopColor="#FDE047" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="40" cy="36" r="32" fill={`url(#wt-glow-${uid})`} />
          {/* Trunk & roots */}
          <path
            d="M35 66C36 56 36 48 35 40L45 40C44 48 44 56 46 66L54 70H26L35 66Z"
            fill="#92400E"
            stroke="#FDE047"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Golden foliage canopy */}
          <circle cx="40" cy="24" r="14" fill={`url(#wt-gold-${uid})`} stroke="#FEF9C3" strokeWidth="1.8" />
          <circle cx="26" cy="33" r="11.5" fill={`url(#wt-gold-${uid})`} stroke="#FEF9C3" strokeWidth="1.6" />
          <circle cx="54" cy="33" r="11.5" fill={`url(#wt-gold-${uid})`} stroke="#FEF9C3" strokeWidth="1.6" />
          <circle cx="33" cy="39" r="9.5" fill="#FACC15" stroke="#FEF08A" strokeWidth="1.4" />
          <circle cx="47" cy="39" r="9.5" fill="#FACC15" stroke="#FEF08A" strokeWidth="1.4" />
          {/* WILD plaque */}
          <rect x="13" y="49" width="54" height="19" rx="6" fill="#2E1065" stroke="#FACC15" strokeWidth="2.4" />
          <text
            x="40"
            y="62.5"
            textAnchor="middle"
            fill="#FEF08A"
            fontSize="12.5"
            fontWeight="900"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            letterSpacing="1"
          >
            {wildMultiplier ? `WILD x${wildMultiplier}` : 'WILD'}
          </text>
        </svg>
      );

    case 'scatter_dollar':
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={`sd-gold-${uid}`} x1="16" y1="12" x2="64" y2="68" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="48%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#92400E" />
            </linearGradient>
          </defs>
          <circle cx="40" cy="40" r="29" fill="#064E3B" stroke={`url(#sd-gold-${uid})`} strokeWidth="4" />
          <circle cx="40" cy="40" r="23" fill="#047857" stroke="#FDE047" strokeWidth="1.5" strokeDasharray="3 3" />
          <text
            x="40"
            y="50"
            textAnchor="middle"
            fill="#FEF08A"
            fontSize="36"
            fontWeight="900"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            stroke="#92400E"
            strokeWidth="1.2"
          >
            $
          </text>
        </svg>
      );

    case 'scatter_star':
    default:
      return (
        <svg viewBox="0 0 80 80" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={`ss-blue-${uid}`} x1="18" y1="12" x2="62" y2="68" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E0F2FE" />
              <stop offset="42%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
          </defs>
          <polygon
            points="40,8 48.8,27.5 70,30.2 54.4,44.8 58.5,66 40,55.6 21.5,66 25.6,44.8 10,30.2 31.2,27.5"
            fill={`url(#ss-blue-${uid})`}
            stroke="#BAE6FD"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <polygon
            points="40,18 45.2,30.2 58,32 48.5,41 51,54 40,47.5 29,54 31.5,41 22,32 34.8,30.2"
            fill="#E0F2FE"
            opacity="0.38"
          />
          <circle cx="40" cy="39" r="5" fill="#FFFFFF" opacity="0.65" />
        </svg>
      );
  }
};

/**
 * Expanded full-reel Golden Tree Wild artwork covering all 3 rows vertically
 */
export const GoldenTreeExpandedWildArt: React.FC<{ multiplier: number }> = ({ multiplier }) => {
  const uid = useId().replace(/:/g, '');
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between py-2.5 px-1.5 bg-gradient-to-b from-amber-500/25 via-yellow-500/15 to-amber-700/35 border-2 border-amber-400 rounded-xl shadow-[0_0_25px_rgba(250,204,21,0.45)] overflow-hidden select-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(253,224,71,0.35),transparent_70%)] pointer-events-none" />

      {/* Multiplier Crest */}
      <div className="relative z-10 px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-purple-950 font-black text-xs sm:text-sm tracking-tight shadow-md border border-yellow-100">
        x{multiplier}
      </div>

      {/* Tall Golden Tree SVG */}
      <svg viewBox="0 0 90 160" className="relative z-10 w-full h-[64%] drop-shadow-[0_4px_12px_rgba(245,158,11,0.5)]" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={`exp-canopy-${uid}`} x1="15" y1="8" x2="75" y2="95" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FEF9C3" />
            <stop offset="45%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
          <linearGradient id={`exp-trunk-${uid}`} x1="34" y1="68" x2="56" y2="150" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="50%" stopColor="#92400E" />
            <stop offset="100%" stopColor="#451A03" />
          </linearGradient>
        </defs>
        <path
          d="M39 144C40 118 40 94 37 72H53C50 94 50 118 52 144L68 154H22L39 144Z"
          fill={`url(#exp-trunk-${uid})`}
          stroke="#FDE047"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="45" cy="36" r="24" fill={`url(#exp-canopy-${uid})`} stroke="#FEF9C3" strokeWidth="2.2" />
        <circle cx="24" cy="54" r="18" fill={`url(#exp-canopy-${uid})`} stroke="#FEF9C3" strokeWidth="1.8" />
        <circle cx="66" cy="54" r="18" fill={`url(#exp-canopy-${uid})`} stroke="#FEF9C3" strokeWidth="1.8" />
        <circle cx="45" cy="64" r="16" fill="#FACC15" stroke="#FEF08A" strokeWidth="1.6" />
        <circle cx="29" cy="28" r="2.8" fill="#FFFFFF" opacity="0.85" />
        <circle cx="58" cy="26" r="2.2" fill="#FFFFFF" opacity="0.85" />
        <circle cx="64" cy="52" r="2.4" fill="#FFFFFF" opacity="0.85" />
      </svg>

      {/* WILD Badge */}
      <div className="relative z-10 w-full text-center py-1 rounded-lg bg-purple-950/90 border border-amber-400/80 text-amber-300 font-black text-[11px] sm:text-xs tracking-widest shadow">
        WILD
      </div>
    </div>
  );
};

// ==========================================
// Web Audio API Sound Effects Synthesizer
// ==========================================

export class GoldenTreeAudio {
  private ctx: AudioContext | null = null;
  private muted = false;

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined' || this.muted) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        this.ctx = new Ctor();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playSpinTick(pitch = 300) {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.65, now + 0.04);
      gain.gain.setValueAtTime(0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.055);
    } catch {}
  }

  playReelStop(reelIdx: number, isWild = false) {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isWild ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isWild ? 520 + reelIdx * 60 : 170 + reelIdx * 32, now);
      osc.frequency.exponentialRampToValueAtTime(isWild ? 780 : 82, now + 0.11);
      gain.gain.setValueAtTime(isWild ? 0.11 : 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } catch {}
  }

  playWinFanfare(multiplier: number) {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const notes =
        multiplier >= 50
          ? [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093.0]
          : multiplier >= 10
          ? [523.25, 659.25, 783.99, 1046.5, 1318.51]
          : [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.09, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.32);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.34);
      });
    } catch {}
  }

  playBonusTrigger() {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const chord = [392.0, 493.88, 587.33, 783.99, 987.77, 1174.66];
      chord.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.075);
        gain.gain.setValueAtTime(0.11, now + idx * 0.075);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.075 + 0.55);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.075);
        osc.stop(now + idx * 0.075 + 0.58);
      });
    } catch {}
  }
}
