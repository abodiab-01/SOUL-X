import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Info, RotateCw, Snowflake, Trophy, Volume2, VolumeX, X, Zap } from 'lucide-react';
import { AuthUser, Language } from '../types';
import { CoinIcon } from './CurrencyIcons';
import { GameBetWheel } from './GameBetWheel';
import { getStoredAuthToken } from '../lib/authStorage';
import { GAME_BET_AMOUNTS } from '../lib/gamesConfig';

export type WinterSlotsSymbolId = 'rain' | 'cloud' | 'lightning' | 'snow' | 'seven' | 'wild';

interface WinterSlotsWinningLine {
  lineIndex: number;
  indices: [number, number, number];
  symbol: WinterSlotsSymbolId;
  multiplier: number;
}

interface WinterSlotsHistoryItem {
  id: number;
  won: boolean;
  multiplier: number;
  payout: number;
}

interface WinterSlotsGameProps {
  lang: Language;
  currentUser: AuthUser | null;
  coinsBalance: number;
  betAmounts?: readonly number[];
  onCoinsBalanceSync: (nextBalance: number) => void;
  onOpenWallet: () => void;
}

const SYMBOLS_ORDER: readonly WinterSlotsSymbolId[] = [
  'rain',
  'cloud',
  'lightning',
  'snow',
  'seven',
  'wild',
] as const;

const DEFAULT_PAYTABLE: Record<WinterSlotsSymbolId, number> = {
  rain: 2,
  cloud: 3,
  lightning: 5,
  snow: 8,
  seven: 20,
  wild: 50,
};

const INITIAL_SHOWCASE_GRID: WinterSlotsSymbolId[] = [
  'snow', 'lightning', 'seven',
  'cloud', 'wild', 'snow',
  'rain', 'snow', 'lightning',
];

const SYMBOL_LABELS: Record<WinterSlotsSymbolId, { ar: string; en: string }> = {
  rain: { ar: 'المطر', en: 'Rain' },
  cloud: { ar: 'غيمة', en: 'Cloud' },
  lightning: { ar: 'برق', en: 'Lightning' },
  snow: { ar: 'ثلج', en: 'Snow' },
  seven: { ar: 'رقم 7', en: 'Lucky 7' },
  wild: { ar: 'رمز Wild', en: 'WILD' },
};

const WinterSymbolArt: React.FC<{ symbol: WinterSlotsSymbolId; className?: string }> = ({
  symbol,
  className = 'w-11 h-11 sm:w-14 sm:h-14',
}) => {
  const uid = useId();
  const sevenGradId = `ws-7-${uid}`;
  const wildGradId = `ws-w-${uid}`;

  switch (symbol) {
    case 'rain':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <path
            d="M19 31H46C50.4 31 54 27.6 54 23.4C54 19.6 51 16.4 47.2 15.9C45.7 11.3 41.3 8 36.1 8C30.4 8 25.6 12 24.5 17.3C23.8 17.1 23 17 22.2 17C16.6 17 12 21.3 12 26.6C12 29.1 15 31 19 31Z"
            fill="#64748B"
            stroke="#CBD5E1"
            strokeWidth="2"
          />
          <path
            d="M22 37L19 46C18.5 47.5 19.6 49 21.1 49C22.4 49 23.5 48 23.8 46.7L25 38L22 37Z"
            fill="#38BDF8"
            stroke="#BAE6FD"
            strokeWidth="1.2"
          />
          <path
            d="M34 39L31 50C30.5 51.6 31.6 53 33.2 53C34.5 53 35.6 52 35.9 50.6L37 40L34 39Z"
            fill="#0EA5E9"
            stroke="#BAE6FD"
            strokeWidth="1.2"
          />
          <path
            d="M45 37L42 46C41.5 47.5 42.6 49 44.1 49C45.4 49 46.5 48 46.8 46.7L48 38L45 37Z"
            fill="#38BDF8"
            stroke="#BAE6FD"
            strokeWidth="1.2"
          />
        </svg>
      );

    case 'cloud':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <path
            d="M17 44H47C52.5 44 57 39.7 57 34.4C57 29.5 53.3 25.5 48.4 24.9C46.5 18.6 40.6 14 33.6 14C26 14 19.7 19.5 18.4 26.7C17.5 26.5 16.5 26.4 15.5 26.4C10.3 26.4 6 30.4 6 35.4C6 40.1 10.8 44 17 44Z"
            fill="#E2E8F0"
            stroke="#94A3B8"
            strokeWidth="2.2"
          />
          <path
            d="M18 39H46C49.5 39 52 36.6 52 33.6C52 30.8 49.8 28.5 46.9 28.2"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
            opacity="0.75"
          />
        </svg>
      );

    case 'lightning':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <circle cx="32" cy="32" r="23" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.8" strokeOpacity="0.45" />
          <path
            d="M36 9L18 34H31L26 55L46 29H33L36 9Z"
            fill="#FACC15"
            stroke="#FEF9C3"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M34 15L24 31H32L29 45" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );

    case 'snow':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <g stroke="#67E8F9" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="32" y1="8" x2="32" y2="56" />
            <line x1="11.2" y1="20" x2="52.8" y2="44" />
            <line x1="52.8" y1="20" x2="11.2" y2="44" />
            <polyline points="26,14 32,20 38,14" />
            <polyline points="26,50 32,44 38,50" />
            <polyline points="14,27 21,25 19,18" />
            <polyline points="50,37 43,39 45,46" />
            <polyline points="45,18 43,25 50,27" />
            <polyline points="19,46 21,39 14,37" />
          </g>
          <circle cx="32" cy="32" r="5" fill="#ECFEFF" stroke="#22D3EE" strokeWidth="2" />
        </svg>
      );

    case 'seven':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={sevenGradId} x1="14" y1="10" x2="48" y2="54" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FB7185" />
              <stop offset="48%" stopColor="#E11D48" />
              <stop offset="100%" stopColor="#9F1239" />
            </linearGradient>
          </defs>
          <path
            d="M15 12H49L47 21L30 53H19L35 21H15V12Z"
            fill={`url(#${sevenGradId})`}
            stroke="#FDE047"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <path d="M18 15H44" stroke="#FFE4E6" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        </svg>
      );

    case 'wild':
    default:
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={wildGradId} x1="8" y1="12" x2="56" y2="52" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
          </defs>
          <polygon
            points="32,7 55,19 55,45 32,57 9,45 9,19"
            fill="#0F172A"
            stroke={`url(#${wildGradId})`}
            strokeWidth="3"
          />
          <polygon
            points="32,12 50,22 50,42 32,52 14,42 14,22"
            fill="#1E293B"
            stroke="#38BDF8"
            strokeWidth="1.2"
            strokeOpacity="0.6"
          />
          <text
            x="32"
            y="36.5"
            textAnchor="middle"
            fill="#FDE047"
            fontSize="14"
            fontWeight="900"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            letterSpacing="0.8"
          >
            WILD
          </text>
        </svg>
      );
  }
};

export const WinterSlotsGame: React.FC<WinterSlotsGameProps> = ({
  lang,
  currentUser,
  coinsBalance,
  betAmounts,
  onCoinsBalanceSync,
  onOpenWallet,
}) => {
  const isAr = lang === 'ar';

  const [betSteps, setBetSteps] = useState<readonly number[]>(
    () => (betAmounts && betAmounts.length > 0 ? betAmounts : GAME_BET_AMOUNTS)
  );
  const [selectedBetIdx, setSelectedBetIdx] = useState<number>(0);
  const [paytable, setPaytable] = useState<Record<WinterSlotsSymbolId, number>>(DEFAULT_PAYTABLE);

  // 3 columns x 3 rows displayed grid (indices 0..8 row-major)
  const [grid, setGrid] = useState<WinterSlotsSymbolId[]>(INITIAL_SHOWCASE_GRID);
  const [reelSpinning, setReelSpinning] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [reelJustStopped, setReelJustStopped] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);

  const [winningLines, setWinningLines] = useState<WinterSlotsWinningLine[]>([]);
  const [lastOutcome, setLastOutcome] = useState<{
    won: boolean;
    totalMultiplier: number;
    payout: number;
    betAmount: number;
  } | null>(null);
  const [history, setHistory] = useState<WinterSlotsHistoryItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showPaytable, setShowPaytable] = useState<boolean>(false);

  const nextHistoryIdRef = useRef<number>(1);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isMutedRef = useRef<boolean>(isMuted);
  const timersRef = useRef<number[]>([]);
  const spinIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (betAmounts && betAmounts.length > 0) {
      setBetSteps(betAmounts);
    }
  }, [betAmounts]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      if (spinIntervalRef.current !== null) {
        window.clearInterval(spinIntervalRef.current);
      }
    };
  }, []);

  // Load config & paytable from server
  useEffect(() => {
    fetch('/api/games/winter-slots/config')
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          if (Array.isArray(data.betAmounts) && data.betAmounts.length > 0) {
            setBetSteps(data.betAmounts);
          }
          if (data.paytable && typeof data.paytable === 'object') {
            setPaytable((prev) => ({ ...prev, ...data.paytable }));
          }
        }
      })
      .catch(() => {});
  }, []);

  const getAudioCtx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined' || isMutedRef.current) return null;
    if (!audioCtxRef.current) {
      const AudioContextCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        audioCtxRef.current = new AudioContextCtor();
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    return audioCtxRef.current;
  }, []);

  const playReelTick = useCallback(
    (pitch = 320) => {
      const ctx = getAudioCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(pitch, now);
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.65, now + 0.045);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
      } catch {}
    },
    [getAudioCtx]
  );

  const playReelStop = useCallback(
    (reelIdx: number) => {
      const ctx = getAudioCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(190 + reelIdx * 35, now);
        osc.frequency.exponentialRampToValueAtTime(85, now + 0.08);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } catch {}
    },
    [getAudioCtx]
  );

  const playWinFanfare = useCallback(
    (multiplier: number) => {
      const ctx = getAudioCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const notes =
          multiplier >= 20
            ? [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98]
            : multiplier >= 5
            ? [523.25, 659.25, 783.99, 1046.5]
            : [440, 554.37, 659.25];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.055);
          gain.gain.setValueAtTime(0.08, now + idx * 0.055);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.055 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.055);
          osc.stop(now + idx * 0.055 + 0.26);
        });
      } catch {}
    },
    [getAudioCtx]
  );

  const winningCellSet = useMemo(() => {
    const set = new Set<number>();
    winningLines.forEach((line) => {
      line.indices.forEach((idx) => set.add(idx));
    });
    return set;
  }, [winningLines]);

  const selectedBet = betSteps[selectedBetIdx] ?? betSteps[0] ?? 500;

  const handleSpin = async () => {
    if (isSpinning) return;
    setErrorMsg(null);

    if (!currentUser) {
      setErrorMsg(isAr ? 'يجب تسجيل الدخول أولاً للعب' : 'Please sign in first to play');
      return;
    }
    if (coinsBalance < selectedBet) {
      setErrorMsg(
        isAr
          ? `رصيدك (${coinsBalance.toLocaleString()}) أقل من مبلغ الرهان (${selectedBet.toLocaleString()})`
          : `Insufficient Coins (${coinsBalance.toLocaleString()} < ${selectedBet.toLocaleString()})`
      );
      return;
    }

    // Clear previous timers
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
    if (spinIntervalRef.current !== null) {
      window.clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }

    setIsSpinning(true);
    setWinningLines([]);
    setLastOutcome(null);
    setReelSpinning([true, true, true]);
    setReelJustStopped([false, false, false]);
    onCoinsBalanceSync(Math.max(0, coinsBalance - selectedBet));

    let activeSpinMask: [boolean, boolean, boolean] = [true, true, true];
    let tickCount = 0;

    // Rapid reel symbol cycling while waiting/landing
    spinIntervalRef.current = window.setInterval(() => {
      tickCount++;
      if (tickCount % 2 === 0) {
        playReelTick(280 + (tickCount % 4) * 35);
      }
      setGrid((prev) => {
        const next = [...prev];
        for (let col = 0; col < 3; col++) {
          if (activeSpinMask[col]) {
            for (let row = 0; row < 3; row++) {
              const cellIdx = row * 3 + col;
              next[cellIdx] = SYMBOLS_ORDER[Math.floor(Math.random() * SYMBOLS_ORDER.length)];
            }
          }
        }
        return next;
      });
    }, 65);

    try {
      const token = getStoredAuthToken();
      const res = await fetch('/api/games/winter-slots/spin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: currentUser.id,
          displayId: currentUser.displayId,
          email: currentUser.email,
          betAmount: selectedBet,
        }),
      });
      const data = await res.json();

      if (!data?.success || !Array.isArray(data.grid) || data.grid.length !== 9) {
        if (spinIntervalRef.current !== null) {
          window.clearInterval(spinIntervalRef.current);
          spinIntervalRef.current = null;
        }
        setReelSpinning([false, false, false]);
        setIsSpinning(false);
        setErrorMsg(data?.message || (isAr ? 'تعذر إتمام اللفة' : 'Spin failed'));
        if (typeof data?.currentCoins === 'number') {
          onCoinsBalanceSync(data.currentCoins);
        } else {
          onCoinsBalanceSync(coinsBalance);
        }
        return;
      }

      const finalGrid = data.grid as WinterSlotsSymbolId[];
      const finalWinLines = Array.isArray(data.winningLines)
        ? (data.winningLines as WinterSlotsWinningLine[])
        : [];
      const totalMultiplier = Number(data.totalMultiplier || 0);
      const payout = Number(data.payout || 0);
      const betAmt = Number(data.betAmount || selectedBet);
      const nextBalance =
        typeof data.newCoinsBalance === 'number' ? data.newCoinsBalance : coinsBalance;

      // Staggered stop for Reel 1, Reel 2, Reel 3
      const stopDelays = [380, 760, 1140];
      stopDelays.forEach((delay, colIdx) => {
        const t = window.setTimeout(() => {
          activeSpinMask[colIdx] = false;
          setReelSpinning((prev) => {
            const copy: [boolean, boolean, boolean] = [...prev];
            copy[colIdx] = false;
            return copy;
          });
          setReelJustStopped((prev) => {
            const copy: [boolean, boolean, boolean] = [...prev];
            copy[colIdx] = true;
            return copy;
          });
          setGrid((prev) => {
            const next = [...prev];
            for (let row = 0; row < 3; row++) {
              const cellIdx = row * 3 + colIdx;
              next[cellIdx] = finalGrid[cellIdx];
            }
            return next;
          });
          playReelStop(colIdx);

          const clearBounce = window.setTimeout(() => {
            setReelJustStopped((prev) => {
              const copy: [boolean, boolean, boolean] = [...prev];
              copy[colIdx] = false;
              return copy;
            });
          }, 260);
          timersRef.current.push(clearBounce);

          // Final reel stopped -> finish spin
          if (colIdx === 2) {
            if (spinIntervalRef.current !== null) {
              window.clearInterval(spinIntervalRef.current);
              spinIntervalRef.current = null;
            }
            const won = payout > 0;
            if (won) {
              playWinFanfare(totalMultiplier);
            }
            onCoinsBalanceSync(nextBalance);
            setWinningLines(finalWinLines);
            setLastOutcome({
              won,
              totalMultiplier,
              payout,
              betAmount: betAmt,
            });
            setHistory((prev) =>
              [
                {
                  id: nextHistoryIdRef.current++,
                  won,
                  multiplier: totalMultiplier,
                  payout,
                },
                ...prev,
              ].slice(0, 8)
            );
            setIsSpinning(false);
          }
        }, delay);
        timersRef.current.push(t);
      });
    } catch {
      if (spinIntervalRef.current !== null) {
        window.clearInterval(spinIntervalRef.current);
        spinIntervalRef.current = null;
      }
      setReelSpinning([false, false, false]);
      setIsSpinning(false);
      onCoinsBalanceSync(coinsBalance);
      setErrorMsg(isAr ? 'حدث خطأ في الاتصال بالخادم' : 'Network error connecting to server');
    }
  };

  return (
    <div
      className="flex-1 min-h-0 w-full max-w-2xl mx-auto px-2.5 sm:px-5 py-2 flex flex-col gap-2 overflow-hidden select-none animate-in fade-in duration-300"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Main Winter Slots Machine Board */}
      <div className="flex-1 min-h-0 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 shadow-sm flex flex-col overflow-hidden">
        {/* Compact Header + History + Controls */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2 border-b border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-x-auto no-scrollbar">
            <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-neutral-900 dark:text-white tracking-tight whitespace-nowrap shrink-0">
              <Snowflake className="w-4 h-4 text-cyan-500" />
              <span>Winter Slots</span>
            </span>

            {history.slice(0, 6).map((h) => (
              <span
                key={h.id}
                className={`font-mono tabular-nums text-[11px] font-black shrink-0 ${
                  h.won
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-neutral-400 dark:text-neutral-500'
                }`}
                dir="ltr"
              >
                {h.won ? `${h.multiplier}x` : '—'}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowPaytable(true)}
              className="p-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
              title={isAr ? 'جدول الجوائز والرموز' : 'Paytable & Symbols'}
              aria-label={isAr ? 'جدول الجوائز' : 'Paytable'}
            >
              <Info className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className="p-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
              title={isMuted ? (isAr ? 'تشغيل الصوت' : 'Unmute') : (isAr ? 'كتم الصوت' : 'Mute')}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-cyan-500" />}
            </button>
          </div>
        </div>

        {/* Status / Outcome Strip */}
        <div className="shrink-0 px-4 py-2 border-b border-neutral-100 dark:border-neutral-800/70 bg-neutral-50/70 dark:bg-neutral-950/40 flex items-center justify-between gap-2 text-xs">
          {isSpinning ? (
            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 font-bold">
              <Snowflake className="w-4 h-4 animate-spin shrink-0" />
              <span>{isAr ? 'جاري تدوير البكرات الثلجية...' : 'Spinning the winter reels...'}</span>
            </div>
          ) : lastOutcome ? (
            lastOutcome.won ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black">
                <Trophy className="w-4 h-4 shrink-0" />
                <span className="font-mono tabular-nums">
                  {isAr
                    ? `فوز ${lastOutcome.totalMultiplier}x · ربحت +${lastOutcome.payout.toLocaleString()} Coins`
                    : `${lastOutcome.totalMultiplier}x Win · +${lastOutcome.payout.toLocaleString()} Coins`}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 font-bold">
                <span>
                  {isAr ? 'حاول مجدداً في اللفة القادمة' : 'No matching payline — spin again'}
                </span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 font-semibold truncate">
              <span>{isAr ? '3 بكرات · 5 خطوط ربح' : '3 Reels · 5 Paylines'}</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                {isAr ? 'Wild يعوّض أي رمز' : 'Wild substitutes any symbol'}
              </span>
            </div>
          )}

          <div
            className="text-[11px] font-mono tabular-nums font-bold text-neutral-500 dark:text-neutral-400 shrink-0"
            dir="ltr"
          >
            {isAr ? 'حتى 50x' : 'Max 50x'}
          </div>
        </div>

        {/* 3-Reel Winter Slot Machine Cabinet */}
        <div className="flex-1 min-h-0 p-3 sm:p-5 flex flex-col items-center justify-center bg-[#091224] relative overflow-hidden">
          {/* Subtle Winter Backdrop Glints */}
          <div className="absolute inset-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_25%_20%,rgba(56,189,248,0.22),transparent_55%),radial-gradient(circle_at_75%_80%,rgba(245,158,11,0.16),transparent_55%)]" />

          {/* Reel Frame */}
          <div
            className="relative z-10 w-full max-w-md rounded-3xl p-2.5 sm:p-3.5 bg-[#0F1B33] border-2 border-cyan-400/35 shadow-[0_12px_40px_rgba(8,145,178,0.22)]"
            dir="ltr"
          >
            {/* 3 Vertical Reels Grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[0, 1, 2].map((colIdx) => {
                const spinningThisReel = reelSpinning[colIdx];
                const bouncedThisReel = reelJustStopped[colIdx];

                return (
                  <div
                    key={colIdx}
                    className={`rounded-2xl bg-[#091122] border border-cyan-500/20 p-1.5 sm:p-2 flex flex-col gap-1.5 sm:gap-2 overflow-hidden transition-transform duration-150 ${
                      bouncedThisReel ? 'translate-y-0.5 scale-[0.985]' : ''
                    }`}
                  >
                    {[0, 1, 2].map((rowIdx) => {
                      const cellIdx = rowIdx * 3 + colIdx;
                      const sym = grid[cellIdx];
                      const isMiddleRow = rowIdx === 1;
                      const isWinnerCell = !isSpinning && winningCellSet.has(cellIdx);

                      return (
                        <div
                          key={cellIdx}
                          className={`relative rounded-xl h-20 sm:h-24 flex flex-col items-center justify-center transition-all duration-150 border ${
                            isWinnerCell
                              ? 'bg-amber-500/18 border-amber-400 ring-2 ring-amber-400/40 shadow-[0_0_18px_rgba(251,191,36,0.35)]'
                              : isMiddleRow
                              ? 'bg-slate-900/95 border-cyan-400/25'
                              : 'bg-slate-900/65 border-slate-800/80'
                          } ${spinningThisReel ? 'opacity-85 blur-[0.6px]' : 'opacity-100'}`}
                        >
                          <div
                            className={`transition-transform duration-100 ${
                              isWinnerCell ? 'scale-110' : ''
                            }`}
                          >
                            <WinterSymbolArt
                              symbol={sym}
                              className="w-11 h-11 sm:w-14 sm:h-14"
                            />
                          </div>
                          {!spinningThisReel && (
                            <span
                              className={`text-[9px] sm:text-[10px] font-bold mt-0.5 leading-none ${
                                isWinnerCell
                                  ? 'text-amber-300'
                                  : sym === 'wild'
                                  ? 'text-amber-400'
                                  : sym === 'seven'
                                  ? 'text-rose-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              {isAr ? SYMBOL_LABELS[sym].ar : SYMBOL_LABELS[sym].en}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact Symbol Payout Strip */}
          <div className="relative z-10 mt-2.5 flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
            {SYMBOLS_ORDER.map((sym) => (
              <div
                key={sym}
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-900/90 border border-slate-700/70 text-[10px] font-mono tabular-nums text-slate-200"
                dir="ltr"
              >
                <WinterSymbolArt symbol={sym} className="w-4 h-4" />
                <span className={sym === 'wild' ? 'text-amber-400 font-black' : 'text-cyan-300 font-bold'}>
                  {paytable[sym]}x
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Control Dock: Shared Bet Wheel + Spin Action CTA */}
      <div className="shrink-0 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 px-3 py-2.5 shadow-sm space-y-2">
        <GameBetWheel
          lang={lang}
          betAmounts={betSteps}
          selectedBetIdx={selectedBetIdx}
          onSelectBetIdx={(idx) => {
            setSelectedBetIdx(idx);
            setErrorMsg(null);
          }}
          coinsBalance={coinsBalance}
          isMuted={isMuted}
          disabled={isSpinning}
          lockedNotice={isSpinning ? (isAr ? 'جاري التدوير' : 'Spinning') : undefined}
          onOpenWallet={onOpenWallet}
        />

        {errorMsg && (
          <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center justify-between gap-2">
            <span className="truncate">{errorMsg}</span>
            {coinsBalance < selectedBet && !isSpinning && (
              <button
                type="button"
                onClick={onOpenWallet}
                className="px-2 py-0.5 rounded-lg bg-rose-500 text-white text-[10px] font-bold shrink-0 cursor-pointer"
              >
                {isAr ? 'شحن' : 'Top up'}
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleSpin}
          disabled={isSpinning}
          className="w-full h-11 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-cyan-600 hover:from-cyan-400 hover:to-sky-500 text-neutral-950 font-black text-sm shadow-md shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
        >
          <RotateCw className={`w-4 h-4 shrink-0 ${isSpinning ? 'animate-spin' : ''}`} />
          <span>
            {isSpinning
              ? isAr
                ? 'جاري الدوران...'
                : 'Spinning...'
              : isAr
              ? 'تدوير البكرات'
              : 'SPIN REELS'}
          </span>
          <span
            className="font-mono tabular-nums text-xs px-2 py-0.5 rounded-lg bg-neutral-950/15 text-neutral-950 inline-flex items-center gap-1 shrink-0"
            dir="ltr"
          >
            <span>{selectedBet.toLocaleString()}</span>
            <CoinIcon className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>

      {/* Paytable Modal */}
      {showPaytable && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-950/75 backdrop-blur-sm animate-in fade-in duration-150"
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <Snowflake className="w-5 h-5 text-cyan-500" />
                <h3 className="text-base font-black text-neutral-900 dark:text-white">
                  {isAr ? 'جدول جوائز Winter Slots' : 'Winter Slots Paytable'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPaytable(false)}
                className="p-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {SYMBOLS_ORDER.map((sym) => (
                <div
                  key={sym}
                  className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <WinterSymbolArt symbol={sym} className="w-8 h-8 shrink-0" />
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 truncate">
                      {isAr ? SYMBOL_LABELS[sym].ar : SYMBOL_LABELS[sym].en}
                    </span>
                  </div>
                  <span
                    className={`font-mono tabular-nums text-xs font-black shrink-0 ${
                      sym === 'wild'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-cyan-600 dark:text-cyan-400'
                    }`}
                    dir="ltr"
                  >
                    3× = {paytable[sym]}x
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs font-bold text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Zap className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>
                {isAr
                  ? 'رمز Wild يعوّض أي رمز آخر لإكمال خطوط الربح الخمسة (الأفقي والقطري)، وعند ظهور 3 رموز Wild يمنحك 50x.'
                  : 'Wild substitutes for any symbol across all 5 horizontal & diagonal paylines, and 3× Wild pays 50x.'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowPaytable(false)}
              className="w-full py-2.5 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-black text-xs cursor-pointer"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
