import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Volume2, VolumeX, Music, Zap, Info, X, RotateCw, Sparkles } from 'lucide-react';
import { AuthUser, Language } from '../types';
import { CoinIcon } from './CurrencyIcons';
import { GameBetWheel } from './GameBetWheel';
import { getStoredAuthToken } from '../lib/authStorage';
import { GAME_BET_AMOUNTS } from '../lib/gamesConfig';
import { OlympusAudioEngine } from '../lib/olympusAudio';
import olympusZeusCrestImg from '../assets/images/olympus_zeus_crest_1794815720543.jpg';

export type OlympusSymbolId =
  | 'sapphire'
  | 'emerald'
  | 'topaz'
  | 'amethyst'
  | 'ruby'
  | 'chalice'
  | 'ring'
  | 'hourglass'
  | 'crown'
  | 'zeus';

interface OlympusOrb {
  index: number;
  multiplier: number;
}

interface MatchedGroup {
  symbol: OlympusSymbolId;
  count: number;
  win: number;
}

interface OlympusCascadeStep {
  grid: OlympusSymbolId[];
  winningIndices: number[];
  matchedGroups: MatchedGroup[];
  orbs: OlympusOrb[];
  stepWin: number;
}

interface OlympusFreeSpinsInfo {
  remainingSpins: number;
  betAmount: number;
  accumulatedMultiplier: number;
  totalBonusWin: number;
}

type CellDropMode = 'static' | 'full-drop' | 'slide-down' | 'new-drop';

interface CellMotionInfo {
  mode: CellDropMode;
  fallRows: number;
  token: number;
}

interface OlympusGameProps {
  lang: Language;
  currentUser: AuthUser | null;
  coinsBalance: number;
  betAmounts?: readonly number[];
  onCoinsBalanceSync: (nextBalance: number) => void;
  onOpenWallet: () => void;
}

const DEFAULT_PAYTABLE: Record<Exclude<OlympusSymbolId, 'zeus'>, { m8: number; m10: number; m12: number }> = {
  sapphire: { m8: 0.25, m10: 0.55, m12: 1.2 },
  emerald: { m8: 0.3, m10: 0.65, m12: 1.5 },
  topaz: { m8: 0.35, m10: 0.8, m12: 1.8 },
  amethyst: { m8: 0.4, m10: 0.9, m12: 2.2 },
  ruby: { m8: 0.5, m10: 1.1, m12: 2.6 },
  chalice: { m8: 0.7, m10: 1.6, m12: 3.8 },
  ring: { m8: 0.9, m10: 2.2, m12: 5.0 },
  hourglass: { m8: 1.2, m10: 3.0, m12: 7.5 },
  crown: { m8: 1.8, m10: 4.5, m12: 12.0 },
};

const INITIAL_SHOWCASE_GRID: OlympusSymbolId[] = [
  'crown', 'sapphire', 'chalice', 'topaz', 'emerald', 'crown',
  'ruby', 'hourglass', 'zeus', 'amethyst', 'ring', 'ruby',
  'emerald', 'crown', 'ruby', 'sapphire', 'zeus', 'chalice',
  'amethyst', 'ring', 'topaz', 'hourglass', 'emerald', 'sapphire',
  'sapphire', 'chalice', 'zeus', 'crown', 'topaz', 'amethyst',
];

const SYMBOL_LABELS: Record<OlympusSymbolId, { ar: string; en: string }> = {
  crown: { ar: 'تاج أوليمبوس', en: 'Zeus Crown' },
  hourglass: { ar: 'الساعة الذهبية', en: 'Hourglass' },
  ring: { ar: 'الخاتم الملكي', en: 'Royal Ring' },
  chalice: { ar: 'الكأس الذهبي', en: 'Gold Chalice' },
  ruby: { ar: 'ياقوتة حمراء', en: 'Crimson Ruby' },
  amethyst: { ar: 'أميثيست ملكي', en: 'Royal Amethyst' },
  topaz: { ar: 'توباز الشمس', en: 'Sun Topaz' },
  emerald: { ar: 'زمردة المعبد', en: 'Temple Emerald' },
  sapphire: { ar: 'صفير السماء', en: 'Sky Sapphire' },
  zeus: { ar: 'صاعقة زيوس', en: 'Zeus Scatter' },
};

const OlympusSymbolArt: React.FC<{ symbol: OlympusSymbolId; className?: string }> = ({
  symbol,
  className = 'w-7 h-7 sm:w-9 sm:h-9',
}) => {
  const uid = useId();
  const crownGradId = `ol-crown-${uid}`;

  switch (symbol) {
    case 'crown':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={crownGradId} x1="8" y1="14" x2="56" y2="50" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
          </defs>
          <path
            d="M10 44L7 20L21 30L32 14L43 30L57 20L54 44H10Z"
            fill={`url(#${crownGradId})`}
            stroke="#FEF3C7"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <rect x="11" y="45" width="42" height="7" rx="3" fill="#92400E" stroke="#FCD34D" strokeWidth="1.8" />
          <circle cx="32" cy="13" r="3.5" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1.2" />
          <circle cx="20" cy="37" r="2.8" fill="#EF4444" />
          <circle cx="32" cy="34" r="3.2" fill="#38BDF8" />
          <circle cx="44" cy="37" r="2.8" fill="#10B981" />
        </svg>
      );

    case 'hourglass':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <rect x="16" y="10" width="32" height="5.5" rx="2.5" fill="#F59E0B" stroke="#FEF3C7" strokeWidth="1.6" />
          <rect x="16" y="48.5" width="32" height="5.5" rx="2.5" fill="#F59E0B" stroke="#FEF3C7" strokeWidth="1.6" />
          <path
            d="M20 16H44C44 26 35 29 32 32C29 29 20 26 20 16Z"
            fill="#0EA5E9"
            fillOpacity="0.35"
            stroke="#BAE6FD"
            strokeWidth="2"
          />
          <path
            d="M20 48H44C44 38 35 35 32 32C29 35 20 38 20 48Z"
            fill="#0EA5E9"
            fillOpacity="0.35"
            stroke="#BAE6FD"
            strokeWidth="2"
          />
          <path d="M23 47H41C40 42 36 39 32 38C28 39 24 42 23 47Z" fill="#FBBF24" />
          <path d="M25 22H39C37 26 34 28 32 29C30 28 27 26 25 22Z" fill="#FBBF24" />
        </svg>
      );

    case 'ring':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <circle cx="32" cy="37" r="16" stroke="#F59E0B" strokeWidth="6.5" />
          <circle cx="32" cy="37" r="16" stroke="#FEF3C7" strokeWidth="1.4" />
          <polygon points="32,8 42,17 32,26 22,17" fill="#3B82F6" stroke="#DBEAFE" strokeWidth="2" />
          <polygon points="32,12 37,17 32,22 27,17" fill="#93C5FD" />
        </svg>
      );

    case 'chalice':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <path
            d="M17 13H47L44 29C43 36 38 40 32 40C26 40 21 36 20 29L17 13Z"
            fill="#F59E0B"
            stroke="#FEF3C7"
            strokeWidth="2"
          />
          <path d="M17 17H11C11 25 14 29 20 29" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
          <path d="M47 17H53C53 25 50 29 44 29" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
          <rect x="29" y="40" width="6" height="9" fill="#D97706" />
          <rect x="21" y="49" width="22" height="5" rx="2.5" fill="#F59E0B" stroke="#FEF3C7" strokeWidth="1.5" />
          <circle cx="32" cy="25" r="4" fill="#DC2626" stroke="#FCA5A5" strokeWidth="1.2" />
        </svg>
      );

    case 'ruby':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <polygon points="32,8 52,22 45,52 19,52 12,22" fill="#E11D48" stroke="#FDA4AF" strokeWidth="2.2" />
          <polygon points="32,14 45,24 40,46 24,46 19,24" fill="#FB7185" fillOpacity="0.45" />
          <polygon points="32,20 39,27 32,40 25,27" fill="#FFE4E6" fillOpacity="0.7" />
        </svg>
      );

    case 'amethyst':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <polygon points="32,9 54,48 10,48" fill="#7C3AED" stroke="#DDD6FE" strokeWidth="2.4" strokeLinejoin="round" />
          <polygon points="32,17 45,44 19,44" fill="#A78BFA" fillOpacity="0.5" />
          <polygon points="32,24 38,39 26,39" fill="#EDE9FE" fillOpacity="0.65" />
        </svg>
      );

    case 'topaz':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <polygon points="32,8 52,20 52,44 32,56 12,44 12,20" fill="#D97706" stroke="#FDE68A" strokeWidth="2.2" />
          <polygon points="32,15 45,23 45,41 32,49 19,41 19,23" fill="#FBBF24" fillOpacity="0.65" />
          <polygon points="32,22 39,32 32,42 25,32" fill="#FEF9C3" fillOpacity="0.8" />
        </svg>
      );

    case 'emerald':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <polygon points="20,10 44,10 53,20 53,44 44,54 20,54 11,44 11,20" fill="#059669" stroke="#A7F3D0" strokeWidth="2.2" />
          <rect x="20" y="18" width="24" height="28" rx="3" fill="#34D399" fillOpacity="0.55" stroke="#ECFDF5" strokeWidth="1.4" />
        </svg>
      );

    case 'sapphire':
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <polygon points="32,8 54,32 32,56 10,32" fill="#2563EB" stroke="#BFDBFE" strokeWidth="2.4" />
          <polygon points="32,16 45,32 32,48 19,32" fill="#60A5FA" fillOpacity="0.55" />
          <polygon points="32,23 39,32 32,41 25,32" fill="#EFF6FF" fillOpacity="0.75" />
        </svg>
      );

    case 'zeus':
    default:
      return (
        <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
          <circle cx="32" cy="32" r="24" fill="#1E1B4B" stroke="#FBBF24" strokeWidth="2.8" />
          <circle cx="32" cy="32" r="19" stroke="#38BDF8" strokeWidth="1.2" strokeDasharray="3 3" />
          <path
            d="M36 12L21 34H32L28 52L44 29H33L36 12Z"
            fill="#FDE047"
            stroke="#FFFFFF"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};

function getOrbTierStyle(mult: number): string {
  if (mult >= 50) {
    return 'from-rose-500 via-amber-400 to-yellow-300 border-yellow-200 text-neutral-950 shadow-amber-500/50';
  }
  if (mult >= 10) {
    return 'from-violet-500 via-fuchsia-500 to-amber-300 border-violet-200 text-white shadow-violet-500/40';
  }
  return 'from-emerald-400 via-cyan-400 to-sky-500 border-cyan-100 text-neutral-950 shadow-cyan-500/40';
}

export const OlympusGame: React.FC<OlympusGameProps> = ({
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
  const [anteBet, setAnteBet] = useState<boolean>(false);
  const [isTurbo, setIsTurbo] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('soulx_olympus_muted') === '1';
  });
  const [isMusicOn, setIsMusicOn] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('soulx_olympus_music') !== '0';
  });
  const [isPaytableOpen, setIsPaytableOpen] = useState<boolean>(false);
  const [crestImgError, setCrestImgError] = useState<boolean>(false);

  const [grid, setGrid] = useState<OlympusSymbolId[]>(INITIAL_SHOWCASE_GRID);
  const [cellMotions, setCellMotions] = useState<CellMotionInfo[]>(() =>
    Array.from({ length: 30 }, () => ({ mode: 'static', fallRows: 0, token: 0 }))
  );
  const [isFetchingRound, setIsFetchingRound] = useState<boolean>(false);
  const [winningSet, setWinningSet] = useState<Set<number>>(new Set());
  const [explodingSet, setExplodingSet] = useState<Set<number>>(new Set());
  const [activeOrbs, setActiveOrbs] = useState<Map<number, number>>(new Map());
  const [isDropping, setIsDropping] = useState<boolean>(false);
  const [zeusStrikeActive, setZeusStrikeActive] = useState<boolean>(false);
  const [activeMatchedGroups, setActiveMatchedGroups] = useState<MatchedGroup[]>([]);
  const [inspectedSymbol, setInspectedSymbol] = useState<OlympusSymbolId | null>(null);

  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [paytable, setPaytable] = useState(DEFAULT_PAYTABLE);
  const [freeSpins, setFreeSpins] = useState<OlympusFreeSpinsInfo | null>(null);

  const [roundBaseWin, setRoundBaseWin] = useState<number>(0);
  const [roundMultiplier, setRoundMultiplier] = useState<number>(1);
  const [winCalcPhase, setWinCalcPhase] = useState<'idle' | 'dropping' | 'matching' | 'multiplying' | 'counting'>('idle');
  const [displayedWinCounter, setDisplayedWinCounter] = useState<number>(0);
  const [multiplierPopKey, setMultiplierPopKey] = useState<number>(0);
  const [bannerCallout, setBannerCallout] = useState<{
    title: string;
    subtitle?: string;
    tone: 'gold' | 'violet';
  } | null>(null);
  const [lastResult, setLastResult] = useState<{
    payout: number;
    netProfit: number;
    appliedMultiplier: number;
    scatterBonus: number;
    freeSpinsAwarded: number;
    matchedGroups: MatchedGroup[];
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioRef = useRef<OlympusAudioEngine | null>(null);
  const timersRef = useRef<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const inspectTimerRef = useRef<number | null>(null);
  const calloutTimerRef = useRef<number | null>(null);
  const mountedRef = useRef<boolean>(true);
  const onCoinsBalanceSyncRef = useRef(onCoinsBalanceSync);

  const isFreeMode = Boolean(freeSpins && freeSpins.remainingSpins > 0);
  const selectedBet = freeSpins ? freeSpins.betAmount : (betSteps[selectedBetIdx] ?? betSteps[0] ?? 500);
  const spinCost = isFreeMode ? 0 : anteBet ? Math.round(selectedBet * 1.25) : selectedBet;

  useEffect(() => {
    onCoinsBalanceSyncRef.current = onCoinsBalanceSync;
  }, [onCoinsBalanceSync]);

  useEffect(() => {
    if (betAmounts && betAmounts.length > 0) {
      setBetSteps(betAmounts);
    }
  }, [betAmounts]);

  const clearAnimTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // Initialize Web Audio synthesizer engine + lifecycle cleanup
  useEffect(() => {
    const engine = new OlympusAudioEngine();
    audioRef.current = engine;
    engine.setAudioFlags(!isMuted, isMusicOn, isFreeMode);

    const onVisibility = () => engine.handleVisibilityChange();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      engine.dispose();
      audioRef.current = null;
      if (inspectTimerRef.current) window.clearTimeout(inspectTimerRef.current);
      if (calloutTimerRef.current) window.clearTimeout(calloutTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    audioRef.current?.setAudioFlags(!isMuted, isMusicOn, isFreeMode);
  }, [isMuted, isMusicOn, isFreeMode]);

  useEffect(() => {
    mountedRef.current = true;
    const token = getStoredAuthToken();
    const q = new URLSearchParams();
    if (currentUser?.id) q.set('userId', currentUser.id);
    if (currentUser?.displayId) q.set('displayId', currentUser.displayId);
    if (currentUser?.email) q.set('email', currentUser.email);

    fetch(`/api/games/olympus/config?${q.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((data) => {
        if (!mountedRef.current || !data?.success) return;
        if (Array.isArray(data.betAmounts) && data.betAmounts.length > 0) {
          setBetSteps(data.betAmounts);
        }
        if (data.paytable) {
          setPaytable(data.paytable);
        }
        if (data.freeSpins && data.freeSpins.remainingSpins > 0) {
          setFreeSpins(data.freeSpins);
        } else {
          setFreeSpins(null);
        }
      })
      .catch(() => {});

    return () => {
      mountedRef.current = false;
      clearAnimTimers();
    };
  }, [currentUser?.id, currentUser?.displayId, currentUser?.email, clearAnimTimers]);

  const unlockAudioGesture = useCallback(() => {
    audioRef.current?.unlockAndSync();
  }, []);

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    try {
      localStorage.setItem('soulx_olympus_muted', nextMuted ? '1' : '0');
    } catch {}
    audioRef.current?.setAudioFlags(!nextMuted, isMusicOn, isFreeMode);
    if (!nextMuted) {
      audioRef.current?.unlockAndSync();
      audioRef.current?.play('tap');
    }
  };

  const handleToggleMusic = () => {
    const nextMusic = !isMusicOn;
    setIsMusicOn(nextMusic);
    if (nextMusic && isMuted) {
      setIsMuted(false);
      try {
        localStorage.setItem('soulx_olympus_muted', '0');
      } catch {}
    }
    try {
      localStorage.setItem('soulx_olympus_music', nextMusic ? '1' : '0');
    } catch {}
    const effectiveSfx = nextMusic ? true : !isMuted;
    audioRef.current?.setAudioFlags(effectiveSfx, nextMusic, isFreeMode);
    audioRef.current?.unlockAndSync();
    audioRef.current?.play('tap');
  };

  const showBannerCallout = useCallback(
    (title: string, subtitle: string | undefined, tone: 'gold' | 'violet', durationMs = 2400) => {
      if (calloutTimerRef.current) window.clearTimeout(calloutTimerRef.current);
      setBannerCallout({ title, subtitle, tone });
      calloutTimerRef.current = window.setTimeout(() => {
        if (mountedRef.current) setBannerCallout(null);
      }, durationMs);
    },
    []
  );

  const handleInspectSymbol = (sym: OlympusSymbolId) => {
    if (isSpinning) return;
    unlockAudioGesture();
    audioRef.current?.play('tap');
    setInspectedSymbol(sym);
    if (inspectTimerRef.current) window.clearTimeout(inspectTimerRef.current);
    inspectTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current) setInspectedSymbol(null);
    }, 3200);
  };

  const waitMs = (ms: number) =>
    new Promise<void>((resolve) => {
      const id = window.setTimeout(resolve, ms);
      timersRef.current.push(id);
    });

  const animateWinCountUp = useCallback(
    (fromValue: number, toValue: number, durationMs: number): Promise<void> =>
      new Promise((resolve) => {
        if (toValue <= fromValue || durationMs <= 0) {
          setDisplayedWinCounter(toValue);
          resolve();
          return;
        }
        const start = performance.now();
        let lastTickAt = 0;
        let tickStep = 0;

        const tick = (now: number) => {
          if (!mountedRef.current) {
            resolve();
            return;
          }
          const elapsed = now - start;
          const progress = Math.min(1, elapsed / durationMs);
          // Smooth easeOutCubic curve
          const eased = 1 - Math.pow(1 - progress, 3);
          const currentVal = Math.round(fromValue + (toValue - fromValue) * eased);
          setDisplayedWinCounter(currentVal);

          if (now - lastTickAt >= 105 && progress < 0.96) {
            lastTickAt = now;
            audioRef.current?.play('winTick', tickStep);
            tickStep += 1;
          }

          if (progress < 1) {
            rafRef.current = window.requestAnimationFrame(tick);
          } else {
            rafRef.current = null;
            setDisplayedWinCounter(toValue);
            resolve();
          }
        };

        rafRef.current = window.requestAnimationFrame(tick);
      }),
    []
  );

  const handleSpin = async () => {
    if (isSpinning) return;
    unlockAudioGesture();
    setErrorMsg(null);
    setInspectedSymbol(null);
    setBannerCallout(null);

    if (!currentUser) {
      setErrorMsg(isAr ? 'يجب تسجيل الدخول أولاً للعب' : 'Please sign in first to play');
      return;
    }
    if (!isFreeMode && coinsBalance < spinCost) {
      setErrorMsg(
        isAr
          ? `رصيدك (${coinsBalance.toLocaleString()}) أقل من تكلفة اللفة (${spinCost.toLocaleString()})`
          : `Insufficient Coins (${coinsBalance.toLocaleString()} < ${spinCost.toLocaleString()})`
      );
      return;
    }

    clearAnimTimers();
    setIsSpinning(true);
    setIsFetchingRound(true);
    setWinCalcPhase('dropping');
    setDisplayedWinCounter(0);
    setWinningSet(new Set());
    setExplodingSet(new Set());
    setActiveOrbs(new Map());
    setActiveMatchedGroups([]);
    setRoundBaseWin(0);
    setRoundMultiplier(isFreeMode && freeSpins ? Math.max(1, freeSpins.accumulatedMultiplier) : 1);
    setLastResult(null);
    audioRef.current?.play('spinStart');

    try {
      const token = getStoredAuthToken();
      const res = await fetch('/api/games/olympus/play', {
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
          anteBet: isFreeMode ? false : anteBet,
        }),
      });
      const data = await res.json();
      if (!mountedRef.current) return;
      setIsFetchingRound(false);

      if (!data?.success) {
        setErrorMsg(data?.message || (isAr ? 'تعذر تشغيل اللفة' : 'Could not spin gates'));
        if (typeof data?.currentCoins === 'number') {
          onCoinsBalanceSyncRef.current(data.currentCoins);
        }
        return;
      }

      const steps: OlympusCascadeStep[] = Array.isArray(data.steps) ? data.steps : [];
      let accumRoundBase = 0;
      let accumRoundOrb = data.isFreeSpin && freeSpins ? freeSpins.accumulatedMultiplier : 0;
      const roundOrbsMap = new Map<number, number>();
      const roundMatchedSummary: MatchedGroup[] = [];

      // Slower, weightier reel cadence in normal mode; crisp & snappy in Turbo
      const colAudioStagger = isTurbo ? 28 : 72;
      const dropDelay = isTurbo ? 270 : 720;
      const highlightDelay = isTurbo ? 340 : 760;
      const explodeDelay = isTurbo ? 170 : 340;

      for (let s = 0; s < steps.length; s++) {
        if (!mountedRef.current) return;
        const step = steps[s];

        const activeDropCols = [true, true, true, true, true, true];
        const nextMotions: CellMotionInfo[] = new Array(30);

        if (s === 0) {
          for (let i = 0; i < 30; i++) {
            nextMotions[i] = { mode: 'full-drop', fallRows: 0, token: 1 };
          }
        } else {
          const prevWinSet = new Set(steps[s - 1].winningIndices);
          const shiftedOrbsMap = new Map<number, number>();

          for (let col = 0; col < 6; col++) {
            const survivingPrevRows: number[] = [];
            for (let row = 4; row >= 0; row--) {
              const prevIdx = row * 6 + col;
              if (!prevWinSet.has(prevIdx)) {
                survivingPrevRows.push(row);
              }
            }
            const clearedCount = 5 - survivingPrevRows.length;
            activeDropCols[col] = clearedCount > 0;

            if (clearedCount === 0) {
              for (let row = 0; row < 5; row++) {
                const idx = row * 6 + col;
                nextMotions[idx] = { mode: 'static', fallRows: 0, token: 0 };
                const existingOrb = roundOrbsMap.get(idx);
                if (existingOrb !== undefined) {
                  shiftedOrbsMap.set(idx, existingOrb);
                }
              }
            } else {
              // Survivors slide down to fill cleared spots below them
              for (let k = 0; k < survivingPrevRows.length; k++) {
                const newRow = 4 - k;
                const prevRow = survivingPrevRows[k];
                const movedRows = newRow - prevRow;
                const newIdx = newRow * 6 + col;
                const prevIdx = prevRow * 6 + col;

                nextMotions[newIdx] =
                  movedRows > 0
                    ? { mode: 'slide-down', fallRows: movedRows, token: 1 }
                    : { mode: 'static', fallRows: 0, token: 0 };

                const existingOrb = roundOrbsMap.get(prevIdx);
                if (existingOrb !== undefined) {
                  shiftedOrbsMap.set(newIdx, existingOrb);
                }
              }

              // New symbols enter cleanly from the top into the emptied top slots
              for (let newRow = 0; newRow < clearedCount; newRow++) {
                const newIdx = newRow * 6 + col;
                nextMotions[newIdx] = { mode: 'new-drop', fallRows: clearedCount, token: 1 };
              }
            }
          }

          roundOrbsMap.clear();
          shiftedOrbsMap.forEach((mult, idx) => roundOrbsMap.set(idx, mult));
        }

        setGrid(step.grid);
        setCellMotions((prev) =>
          nextMotions.map((m, idx) => ({
            mode: m.mode,
            fallRows: m.fallRows,
            token: m.mode === 'static' ? prev[idx].token : prev[idx].token + 1,
          }))
        );
        setWinCalcPhase('dropping');
        setWinningSet(new Set());
        setExplodingSet(new Set());
        setIsDropping(true);

        // Play drop sound only for columns that actually dropped new/sliding tiles
        for (let c = 0; c < 6; c++) {
          if (!activeDropCols[c]) continue;
          const tId = window.setTimeout(() => {
            if (mountedRef.current) audioRef.current?.play('colDrop', c);
          }, c * colAudioStagger);
          timersRef.current.push(tId);
        }

        // Check Zeus Scatters landing
        const stepScatters = step.grid.filter((sym) => sym === 'zeus').length;
        if (s === 0 && stepScatters >= 3) {
          const scatterAudioId = window.setTimeout(() => {
            if (mountedRef.current) audioRef.current?.play('scatter');
          }, isTurbo ? 120 : 320);
          timersRef.current.push(scatterAudioId);
        }

        if (Array.isArray(step.orbs) && step.orbs.length > 0) {
          step.orbs.forEach((o) => roundOrbsMap.set(o.index, o.multiplier));
          setActiveOrbs(new Map(roundOrbsMap));
          if (step.stepWin > 0 || data.payout > 0) {
            setZeusStrikeActive(true);
            audioRef.current?.play('thunder');
            const stepOrbsTotal = step.orbs.reduce((acc, o) => acc + o.multiplier, 0);
            accumRoundOrb += stepOrbsTotal;
            setRoundMultiplier(Math.max(1, accumRoundOrb));
            setMultiplierPopKey((k) => k + 1);
          }
        } else if (roundOrbsMap.size > 0) {
          setActiveOrbs(new Map(roundOrbsMap));
        } else {
          setActiveOrbs(new Map());
        }

        const stepDropWait = s === 0 ? dropDelay : isTurbo ? 230 : 540;
        await waitMs(stepDropWait);
        if (!mountedRef.current) return;
        setIsDropping(false);
        setZeusStrikeActive(false);

        if (step.winningIndices && step.winningIndices.length > 0) {
          setWinCalcPhase('matching');
          setWinningSet(new Set(step.winningIndices));
          if (Array.isArray(step.matchedGroups)) {
            setActiveMatchedGroups(step.matchedGroups);
            step.matchedGroups.forEach((mg) => roundMatchedSummary.push(mg));
          }
          accumRoundBase += step.stepWin || 0;
          setRoundBaseWin(accumRoundBase);
          setDisplayedWinCounter(accumRoundBase);
          audioRef.current?.play('match', s);

          await waitMs(highlightDelay);
          if (!mountedRef.current) return;

          setExplodingSet(new Set(step.winningIndices));
          audioRef.current?.play('explode');
          await waitMs(explodeDelay);
        } else {
          setActiveMatchedGroups([]);
        }
      }

      if (!mountedRef.current) return;
      setWinningSet(new Set());
      setExplodingSet(new Set());

      const finalPayout = Number(data.payout || 0);
      const awardedSpins = Number(data.freeSpinsAwarded || 0);
      const appliedMult = Math.max(1, Number(data.appliedMultiplier || 1));
      const baseWithScatter = Math.max(accumRoundBase, Number(data.baseWin || 0) + Number(data.scatterBonus || 0));

      // Dedicated Multiplier Effect & Win Count-Up Phase
      if (finalPayout > 0) {
        if (appliedMult > 1) {
          setWinCalcPhase('multiplying');
          setRoundBaseWin(baseWithScatter > 0 ? baseWithScatter : accumRoundBase);
          setRoundMultiplier(appliedMult);
          setMultiplierPopKey((k) => k + 1);
          setZeusStrikeActive(true);
          audioRef.current?.play('orbCharge');

          await waitMs(isTurbo ? 340 : 860);
          if (!mountedRef.current) return;
          setZeusStrikeActive(false);
        }

        setWinCalcPhase('counting');
        const startCount = appliedMult > 1 && baseWithScatter > 0 && baseWithScatter < finalPayout ? baseWithScatter : 0;
        const countMs = isTurbo ? 260 : finalPayout >= selectedBet * 4 ? 1050 : 680;
        await animateWinCountUp(startCount, finalPayout, countMs);
        if (!mountedRef.current) return;
      }

      if (typeof data.newCoinsBalance === 'number') {
        onCoinsBalanceSyncRef.current(data.newCoinsBalance);
      }

      if (awardedSpins > 0) {
        audioRef.current?.play('bigWin');
        showBannerCallout(
          isAr ? `صاعقة زيوس! +${awardedSpins} لفات مجانية` : `Zeus Bonus! +${awardedSpins} Free Spins`,
          finalPayout > 0 ? `+${finalPayout.toLocaleString()} Coins` : undefined,
          'violet',
          2800
        );
      } else if (finalPayout >= selectedBet * 5) {
        audioRef.current?.play('bigWin');
        showBannerCallout(
          isAr ? `ربح ضخم +${finalPayout.toLocaleString()}` : `Big Win +${finalPayout.toLocaleString()}`,
          appliedMult > 1
            ? isAr
              ? `مضاعف ${appliedMult}x`
              : `${appliedMult}x Multiplier`
            : undefined,
          'gold',
          2600
        );
      } else if (finalPayout > 0) {
        audioRef.current?.play('win');
      }

      if (data.freeSpinsRemaining > 0) {
        setFreeSpins({
          remainingSpins: data.freeSpinsRemaining,
          betAmount: data.betAmount,
          accumulatedMultiplier: data.bonusAccumulatedMultiplier || 0,
          totalBonusWin: data.totalBonusWin || 0,
        });
      } else {
        setFreeSpins(null);
      }

      setRoundMultiplier(appliedMult);
      setLastResult({
        payout: finalPayout,
        netProfit: Number(data.netProfit || 0),
        appliedMultiplier: appliedMult,
        scatterBonus: Number(data.scatterBonus || 0),
        freeSpinsAwarded: awardedSpins,
        matchedGroups: roundMatchedSummary,
      });
    } catch {
      if (mountedRef.current) {
        setErrorMsg(isAr ? 'حدث خطأ في الاتصال بالخادم' : 'Network error connecting to server');
      }
    } finally {
      if (mountedRef.current) {
        setIsSpinning(false);
        setIsFetchingRound(false);
        setIsDropping(false);
        setZeusStrikeActive(false);
        setWinCalcPhase('idle');
      }
    }
  };

  const scatterCountOnBoard = useMemo(
    () => grid.reduce((acc, s) => (s === 'zeus' ? acc + 1 : acc), 0),
    [grid]
  );

  const formattedPaytableList = useMemo(
    () =>
      (['crown', 'hourglass', 'ring', 'chalice', 'ruby', 'amethyst', 'topaz', 'emerald', 'sapphire'] as const).map(
        (sym) => ({
          id: sym,
          label: isAr ? SYMBOL_LABELS[sym].ar : SYMBOL_LABELS[sym].en,
          rates: paytable[sym] || DEFAULT_PAYTABLE[sym],
        })
      ),
    [isAr, paytable]
  );

  // Compact deduplicated match summary after spin ends
  const displayMatchedGroups = useMemo(() => {
    const source = isSpinning ? activeMatchedGroups : lastResult?.matchedGroups || [];
    if (source.length <= 3) return source;
    return source.slice(0, 3);
  }, [isSpinning, activeMatchedGroups, lastResult?.matchedGroups]);

  return (
    <div
      onPointerDown={unlockAudioGesture}
      className="flex-1 min-h-0 w-full max-w-3xl mx-auto px-2.5 sm:px-5 py-2 flex flex-col gap-2 overflow-hidden select-none animate-in fade-in duration-300"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Main Olympus Temple Frame */}
      <div className="flex-1 min-h-0 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 shadow-sm flex flex-col overflow-hidden">
        {/* Compact Top HUD inside Board */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-950/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-500/50 bg-slate-900 shrink-0 flex items-center justify-center">
              {!crestImgError ? (
                <img
                  src={olympusZeusCrestImg}
                  alt="Zeus"
                  referrerPolicy="no-referrer"
                  onError={() => setCrestImgError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <OlympusSymbolArt symbol="zeus" className="w-6 h-6" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-neutral-900 dark:text-white truncate">
                <span>Olympus Gates</span>
                <span className="text-neutral-400 font-normal" aria-hidden="true">·</span>
                <span
                  key={multiplierPopKey}
                  className={`font-mono tabular-nums px-1.5 py-0.5 rounded-md transition-colors ${
                    winCalcPhase === 'multiplying' || roundMultiplier > 1
                      ? 'olympus-mult-pop bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-400/40'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {roundMultiplier}x
                </span>
                {scatterCountOnBoard >= 3 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 text-[10px] font-black font-mono tabular-nums">
                    ⚡×{scatterCountOnBoard}
                  </span>
                )}
              </div>
              <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 truncate">
                {isFreeMode && freeSpins
                  ? isAr
                    ? `لفات مجانية: ${freeSpins.remainingSpins} · مضاعف ${freeSpins.accumulatedMultiplier}x`
                    : `Free Spins: ${freeSpins.remainingSpins} · Accum ${freeSpins.accumulatedMultiplier}x`
                  : isAr
                  ? '8+ رموز متشابهة في أي مكان تفوز · اضغط على أي رمز لمعرفة قيمته'
                  : '8+ matching symbols win anywhere · Tap any tile to inspect payout'}
              </div>
            </div>
          </div>

          {/* Utility Buttons: Turbo · Paytable · Music · Mute */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                unlockAudioGesture();
                audioRef.current?.play('tap');
                setIsTurbo((t) => !t);
              }}
              disabled={isSpinning}
              className={`px-2 py-1.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer flex items-center gap-1 ${
                isTurbo
                  ? 'bg-amber-500 text-neutral-950 border-amber-500'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
              }`}
              title={isAr ? 'تسريع الدوران' : 'Turbo Spin'}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isAr ? 'سريع' : 'Turbo'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                unlockAudioGesture();
                audioRef.current?.play('tap');
                setIsPaytableOpen(true);
              }}
              className="p-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer"
              title={isAr ? 'جدول الأرباح' : 'Paytable'}
              aria-label="Paytable"
            >
              <Info className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToggleMusic}
              className={`p-1.5 rounded-xl border transition-colors cursor-pointer ${
                isMusicOn && !isMuted
                  ? 'bg-violet-500/15 border-violet-500/35 text-violet-600 dark:text-violet-300'
                  : 'bg-neutral-100 dark:bg-neutral-800 border-transparent text-neutral-400 dark:text-neutral-500'
              }`}
              title={isMusicOn && !isMuted ? (isAr ? 'إيقاف الموسيقى' : 'Music Off') : (isAr ? 'تشغيل الموسيقى' : 'Music On')}
              aria-label="Toggle Music"
            >
              <Music className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToggleMute}
              className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                !isMuted
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
              }`}
              title={isMuted ? (isAr ? 'تشغيل الصوت' : 'Unmute') : (isAr ? 'كتم الصوت' : 'Mute')}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 6x5 Olympus Temple Grid Arena */}
        <div
          className={`relative flex-1 min-h-0 p-2 sm:p-3.5 flex flex-col justify-between gap-2 transition-colors duration-200 ${
            isFreeMode
              ? 'bg-gradient-to-b from-[#1A1038] via-[#120E2B] to-[#0B1020]'
              : 'bg-gradient-to-b from-[#0E172A] via-[#131E38] to-[#0A1120]'
          }`}
        >
          {/* Zeus Lightning Flash Overlay */}
          {zeusStrikeActive && (
            <div
              className="olympus-lightning-overlay absolute inset-0 pointer-events-none bg-amber-300/20 z-10"
              aria-hidden="true"
            />
          )}

          {/* Multiplier & Animated Win Calculation Banner Overlay */}
          {(winCalcPhase === 'multiplying' || winCalcPhase === 'counting') && (
            <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-2xl bg-slate-950/92 border border-amber-400/80 shadow-2xl shadow-amber-500/35 backdrop-blur-md text-center animate-in zoom-in-90 duration-150">
              <div className="flex items-center justify-center gap-2 font-mono tabular-nums text-xs sm:text-sm font-black whitespace-nowrap" dir="ltr">
                {roundMultiplier > 1 ? (
                  <>
                    <span className="text-slate-200">{roundBaseWin.toLocaleString()}</span>
                    <span className="text-amber-400">×</span>
                    <span
                      key={multiplierPopKey}
                      className="olympus-mult-pop px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-950 shadow-sm shadow-amber-500/50"
                    >
                      {roundMultiplier}x
                    </span>
                    {winCalcPhase === 'counting' && (
                      <>
                        <span className="text-amber-400">=</span>
                        <span className="text-emerald-400 text-sm sm:text-base">
                          +{displayedWinCounter.toLocaleString()}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="text-emerald-400 text-sm sm:text-base">
                    +{displayedWinCounter.toLocaleString()} Coins
                  </span>
                )}
              </div>
              <div className="text-[10px] font-bold text-amber-200/90 mt-0.5">
                {winCalcPhase === 'multiplying'
                  ? isAr
                    ? 'تطبيق مضاعف صاعقة زيوس!'
                    : 'Applying Zeus Lightning Multiplier!'
                  : isAr
                  ? 'احتساب الأرباح النهائية...'
                  : 'Counting total win...'}
              </div>
            </div>
          )}

          {/* Crisp Big Win / Free Spins Floating Callout */}
          {bannerCallout && (
            <button
              type="button"
              onClick={() => setBannerCallout(null)}
              className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-2xl border shadow-2xl backdrop-blur-md text-center cursor-pointer animate-in zoom-in-90 duration-150 ${
                bannerCallout.tone === 'violet'
                  ? 'bg-indigo-950/90 border-violet-400/70 text-white shadow-violet-500/40'
                  : 'bg-neutral-950/90 border-amber-400/75 text-amber-300 shadow-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-black whitespace-nowrap">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{bannerCallout.title}</span>
              </div>
              {bannerCallout.subtitle && (
                <div className="text-[11px] font-mono tabular-nums font-bold text-white/90 mt-0.5">
                  {bannerCallout.subtitle}
                </div>
              )}
            </button>
          )}

          {/* 6x5 Reel Grid */}
          <div
            className="flex-1 min-h-0 grid grid-cols-6 grid-rows-5 gap-1 sm:gap-1.5 p-1.5 sm:p-2 rounded-2xl border border-amber-500/35 bg-[#090E1B]/80 shadow-inner overflow-hidden"
            dir="ltr"
          >
            {grid.map((symbol, idx) => {
              const isWin = winningSet.has(idx);
              const isExplode = explodingSet.has(idx);
              const hasActiveWinFocus = winningSet.size > 0;
              const orbMult = activeOrbs.get(idx);
              const colIdx = idx % 6;
              const rowIdx = Math.floor(idx / 6);
              const motion = cellMotions[idx] || { mode: 'static', fallRows: 0, token: 0 };

              const staggerMs = isDropping
                ? motion.mode === 'full-drop'
                  ? colIdx * (isTurbo ? 28 : 72) + rowIdx * (isTurbo ? 8 : 18)
                  : motion.mode === 'slide-down' || motion.mode === 'new-drop'
                  ? colIdx * (isTurbo ? 14 : 30) + (4 - rowIdx) * (isTurbo ? 6 : 16)
                  : 0
                : 0;
              const isHighlightedScatter = symbol === 'zeus' && scatterCountOnBoard >= 3;
              const isOrbEnergizing = orbMult !== undefined && winCalcPhase === 'multiplying';

              let tileMotionClass = '';
              if (isFetchingRound) {
                tileMotionClass = 'olympus-spin-cell';
              } else if (isExplode) {
                tileMotionClass = 'olympus-explode-cell';
              } else if (isWin) {
                tileMotionClass = 'olympus-win-cell';
              } else if (isDropping) {
                if (motion.mode === 'full-drop') {
                  tileMotionClass = isTurbo ? 'olympus-drop-cell-turbo' : 'olympus-drop-cell';
                } else if (motion.mode === 'slide-down') {
                  tileMotionClass = isTurbo ? 'olympus-tumble-slide-turbo' : 'olympus-tumble-slide';
                } else if (motion.mode === 'new-drop') {
                  tileMotionClass = isTurbo ? 'olympus-tumble-new-turbo' : 'olympus-tumble-new';
                }
              }

              const tileStyle: React.CSSProperties | undefined =
                staggerMs > 0 || motion.fallRows > 0
                  ? ({
                      ...(staggerMs > 0 ? { animationDelay: `${staggerMs}ms` } : {}),
                      ...(motion.fallRows > 0 ? { '--olympus-fall-rows': motion.fallRows } : {}),
                    } as React.CSSProperties)
                  : undefined;

              return (
                <button
                  key={`${motion.token}-${idx}`}
                  type="button"
                  onClick={() => handleInspectSymbol(symbol)}
                  style={tileStyle}
                  aria-label={isAr ? SYMBOL_LABELS[symbol].ar : SYMBOL_LABELS[symbol].en}
                  className={`relative rounded-xl border flex items-center justify-center overflow-hidden transition-colors duration-150 focus:outline-none ${tileMotionClass} ${
                    isExplode
                      ? 'bg-amber-400/25 border-amber-300'
                      : isWin
                      ? 'bg-amber-500/25 border-amber-300 shadow-md shadow-amber-500/30 z-10'
                      : isOrbEnergizing
                      ? 'bg-amber-500/20 border-yellow-300 shadow-lg shadow-amber-400/45 z-20'
                      : isHighlightedScatter
                      ? 'bg-indigo-900/95 border-amber-300 shadow-sm shadow-indigo-500/40'
                      : symbol === 'zeus'
                      ? 'bg-indigo-950/90 border-amber-400/50'
                      : hasActiveWinFocus && orbMult === undefined
                      ? 'bg-slate-900/55 border-slate-800/60 opacity-45'
                      : 'bg-slate-900/80 border-slate-700/55 hover:border-amber-400/45 cursor-pointer'
                  }`}
                >
                  <OlympusSymbolArt
                    symbol={symbol}
                    className="w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9"
                  />

                  {/* Multiplier Orb Overlay when Zeus Strikes */}
                  {orbMult !== undefined && (
                    <div
                      className={`${
                        isOrbEnergizing
                          ? 'olympus-orb-charging ring-2 ring-yellow-300 shadow-xl shadow-amber-400/70'
                          : 'olympus-orb-badge'
                      } absolute inset-0.5 rounded-lg bg-gradient-to-br ${getOrbTierStyle(
                        orbMult
                      )} border flex flex-col items-center justify-center shadow-lg z-20`}
                    >
                      <span className="font-mono tabular-nums text-[11px] sm:text-sm font-black leading-none drop-shadow-xs">
                        {orbMult}x
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Live Clarity Strip: Shows Inspected Symbol / Matched Symbol Chips / Win Calculation */}
          <div className="shrink-0 min-h-9 px-2.5 py-1 rounded-xl bg-slate-950/85 border border-amber-500/25 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto no-scrollbar">
              {inspectedSymbol ? (
                <div className="flex items-center gap-2 text-slate-200 truncate">
                  <OlympusSymbolArt symbol={inspectedSymbol} className="w-5 h-5 shrink-0" />
                  <span className="font-bold text-amber-300 truncate">
                    {isAr ? SYMBOL_LABELS[inspectedSymbol].ar : SYMBOL_LABELS[inspectedSymbol].en}
                  </span>
                  {inspectedSymbol === 'zeus' ? (
                    <span className="text-[11px] text-indigo-300 font-semibold truncate">
                      {isAr ? '4+ صواعق = لفات مجانية + مضاعفات' : '4+ Scatters = Free Spins'}
                    </span>
                  ) : (
                    <span className="text-[11px] font-mono tabular-nums text-slate-300 shrink-0" dir="ltr">
                      8+:{Math.round(selectedBet * paytable[inspectedSymbol].m8).toLocaleString()} · 12+:
                      {Math.round(selectedBet * paytable[inspectedSymbol].m12).toLocaleString()}
                    </span>
                  )}
                </div>
              ) : isSpinning ? (
                winCalcPhase === 'multiplying' || winCalcPhase === 'counting' ? (
                  <div className="flex items-center gap-2 font-mono tabular-nums text-xs font-black" dir="ltr">
                    <span className="text-amber-300">{roundBaseWin.toLocaleString()}</span>
                    {roundMultiplier > 1 && (
                      <>
                        <span className="text-slate-400">×</span>
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/25 border border-amber-400/50 text-amber-200">
                          {roundMultiplier}x
                        </span>
                      </>
                    )}
                    <span className="text-slate-400">→</span>
                    <span className="text-emerald-400">+{displayedWinCounter.toLocaleString()}</span>
                  </div>
                ) : displayMatchedGroups.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {displayMatchedGroups.map((mg, idx) => (
                      <span
                        key={`${mg.symbol}-${idx}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-400/35 text-amber-200 text-[11px] font-mono tabular-nums shrink-0"
                        dir="ltr"
                      >
                        <OlympusSymbolArt symbol={mg.symbol} className="w-3.5 h-3.5" />
                        <span>×{mg.count}</span>
                        <span className="text-emerald-300 font-bold">+{mg.win.toLocaleString()}</span>
                      </span>
                    ))}
                    {roundBaseWin > 0 && (
                      <span className="text-amber-300 font-black font-mono tabular-nums text-[11px] shrink-0">
                        = {roundBaseWin.toLocaleString()}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-amber-300 font-bold truncate">
                    {isFetchingRound
                      ? isAr
                        ? 'جاري فتح بوابات أوليمبوس...'
                        : 'Opening the Gates...'
                      : isAr
                      ? 'تتساقط الرموز...'
                      : 'Symbols tumbling...'}
                  </span>
                )
              ) : lastResult ? (
                lastResult.payout > 0 ? (
                  <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                    <span className="text-emerald-400 font-black font-mono tabular-nums truncate">
                      {isAr
                        ? `+${lastResult.payout.toLocaleString()} Coins`
                        : `Won +${lastResult.payout.toLocaleString()} Coins`}
                    </span>
                    {displayMatchedGroups.map((mg, idx) => (
                      <span
                        key={`${mg.symbol}-${idx}`}
                        className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono tabular-nums shrink-0"
                        dir="ltr"
                      >
                        <OlympusSymbolArt symbol={mg.symbol} className="w-3.5 h-3.5" />
                        <span>×{mg.count}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400 truncate">
                    {isAr ? 'حاول مجدداً — طابق 8 رموز في أي مكان' : 'Try again — 8+ matching symbols win anywhere'}
                  </span>
                )
              ) : (
                <span className="text-slate-400 truncate">
                  {isAr ? 'اختر الرهان واضغط تدوير البوابات' : 'Select bet and press Spin Gates'}
                </span>
              )}
            </div>

            {roundMultiplier > 1 && (
              <span
                key={`strip-mult-${multiplierPopKey}`}
                className={`px-2 py-0.5 rounded-lg font-mono tabular-nums text-xs font-black shrink-0 transition-all ${
                  winCalcPhase === 'multiplying'
                    ? 'olympus-mult-pop bg-gradient-to-r from-amber-400 to-orange-500 text-neutral-950 shadow-md shadow-amber-500/40'
                    : 'bg-amber-500/15 border border-amber-400/35 text-amber-300'
                }`}
                dir="ltr"
              >
                {roundMultiplier}x
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Dock: Bet Wheel + Ante Option + Spin CTA */}
      <div className="shrink-0 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 px-3 py-2.5 shadow-sm space-y-2">
        <GameBetWheel
          lang={lang}
          betAmounts={betSteps}
          selectedBetIdx={selectedBetIdx}
          onSelectBetIdx={(idx) => {
            unlockAudioGesture();
            setSelectedBetIdx(idx);
            setErrorMsg(null);
          }}
          coinsBalance={coinsBalance}
          isMuted={isMuted}
          disabled={isSpinning || isFreeMode}
          onOpenWallet={onOpenWallet}
        />

        {errorMsg && (
          <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center justify-between gap-2">
            <span className="truncate">{errorMsg}</span>
            {coinsBalance < spinCost && (
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

        <div className="flex items-center gap-2">
          {/* Ante Bet Toggle (+25% Double Chance) */}
          <button
            type="button"
            disabled={isSpinning || isFreeMode}
            onClick={() => {
              unlockAudioGesture();
              audioRef.current?.play('tap');
              setAnteBet((a) => !a);
            }}
            className={`h-11 px-3 rounded-2xl border text-xs font-black transition-all cursor-pointer shrink-0 flex flex-col items-center justify-center leading-tight disabled:opacity-45 ${
              anteBet
                ? 'bg-violet-600 text-white border-violet-500 shadow-sm shadow-violet-500/25'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700'
            }`}
            title={isAr ? 'زيادة فرصة ظهور صاعقة زيوس مقابل +25%' : 'Boost Zeus Scatter chance (+25% bet)'}
          >
            <span className="whitespace-nowrap">{isAr ? 'فرصة 2x' : 'Ante'}</span>
            <span className="text-[10px] font-mono tabular-nums opacity-85">+25%</span>
          </button>

          {/* Primary Spin CTA */}
          <button
            type="button"
            onClick={handleSpin}
            disabled={isSpinning}
            className={`flex-1 h-11 rounded-2xl font-black text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer ${
              isFreeMode
                ? 'bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500 text-white shadow-violet-500/25'
                : 'bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 shadow-amber-500/20'
            }`}
          >
            <RotateCw className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
            <span>
              {isSpinning
                ? isAr
                  ? 'جاري الدوران...'
                  : 'Spinning...'
                : isFreeMode
                ? isAr
                  ? `لفة مجانية (${freeSpins?.remainingSpins})`
                  : `Free Spin (${freeSpins?.remainingSpins})`
                : isAr
                ? 'تدوير البوابات'
                : 'Spin Gates'}
            </span>
            <span
              className={`font-mono tabular-nums text-xs px-2 py-0.5 rounded-lg inline-flex items-center gap-1 ${
                isFreeMode ? 'bg-black/25 text-white' : 'bg-neutral-950/15 text-neutral-950'
              }`}
              dir="ltr"
            >
              <span>{isFreeMode ? 'FREE' : spinCost.toLocaleString()}</span>
              {!isFreeMode && <CoinIcon className="w-3.5 h-3.5" />}
            </span>
          </button>
        </div>
      </div>

      {/* Paytable & Rules Modal */}
      {isPaytableOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsPaytableOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[82dvh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white">
                {isAr ? 'جدول أرباح وقواعد Olympus Gates' : 'Olympus Gates Paytable & Rules'}
              </h2>
              <button
                type="button"
                onClick={() => setIsPaytableOpen(false)}
                className="p-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 text-xs">
              <p className="text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {isAr
                  ? 'اربح عند ظهور 8 رموز متطابقة أو أكثر في أي موضع على شبكة 6×5. تنفجر الرموز الفائزة لتسقط رموز جديدة بتتابع مستمر، وعند ظهور كرات المضاعفة (من 2x إلى 100x) يُضرب ربح الدورة في مجموع المضاعفات.'
                  : 'Win when 8+ matching symbols appear anywhere on the 6x5 grid. Winning symbols tumble away for consecutive drops, and Multiplier Orbs (2x to 100x) boost total tumble wins.'}
              </p>

              <div className="p-3 rounded-2xl bg-indigo-950/90 text-white border border-amber-500/35 flex items-center gap-3">
                <OlympusSymbolArt symbol="zeus" className="w-10 h-10 shrink-0" />
                <div>
                  <div className="font-black text-amber-300">
                    {isAr ? 'صاعقة زيوس (Scatter)' : 'Zeus Scatter Bonus'}
                  </div>
                  <div className="text-[11px] text-slate-200 mt-0.5">
                    {isAr
                      ? '4 صواعق = 1.5x + 5 لفات مجانية · 5 صواعق = 4x + 6 لفات · 6+ صواعق = 10x + 8 لفات مع مضاعف تراكمي!'
                      : '4 Scatters = 1.5x + 5 Free Spins · 5 = 4x + 6 Spins · 6+ = 10x + 8 Spins with accumulating multipliers.'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                {formattedPaytableList.map((row) => (
                  <div
                    key={row.id}
                    className="px-3 py-2 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <OlympusSymbolArt symbol={row.id} className="w-7 h-7 shrink-0" />
                      <span className="font-bold text-neutral-900 dark:text-white truncate">{row.label}</span>
                    </div>
                    <div className="font-mono tabular-nums text-[11px] text-neutral-600 dark:text-neutral-300 shrink-0" dir="ltr">
                      8-9: <strong className="text-amber-600 dark:text-amber-400">{row.rates.m8}x</strong> · 10-11:{' '}
                      <strong className="text-amber-600 dark:text-amber-400">{row.rates.m10}x</strong> · 12+:{' '}
                      <strong className="text-emerald-600 dark:text-emerald-400">{row.rates.m12}x</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
