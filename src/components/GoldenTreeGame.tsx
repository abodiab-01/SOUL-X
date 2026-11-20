import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  ChevronLeft,
  ChevronRight,
  Crown,
  Music,
  Pause,
  Play,
  RotateCw,
  Sparkles,
  Trophy,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { AuthUser, Language } from '../types';
import { CoinIcon } from './CurrencyIcons';
import { GameBetWheel } from './GameBetWheel';
import { getStoredAuthToken } from '../lib/authStorage';
import { GAME_BET_AMOUNTS } from '../lib/gamesConfig';
import {
  GOLDEN_TREE_ALL_SYMBOLS,
  GoldenTreeAudio,
  GoldenTreeExpandedWildArt,
  GoldenTreeRegularSymbolId,
  GoldenTreeSymbolArt,
  GoldenTreeSymbolId,
  PAYLINE_COLORS,
} from './GoldenTreeArt';

export type BuyBonusOptionId = 'wild_1' | 'wild_2' | 'wild_3' | 'random_wild';

interface PaylineWin {
  lineIndex: number;
  lineNumber: number;
  symbol: GoldenTreeRegularSymbolId;
  matchCount: number;
  positions: Array<{ row: number; col: number; cellIndex: number }>;
  baseMultiplier: number;
  wildMultipliers: number[];
  appliedWildMultiplier: number;
  totalLineMultiplier: number;
  payout: number;
}

interface ScatterWin {
  type: 'scatter_dollar' | 'scatter_star';
  count: number;
  positions: Array<{ row: number; col: number; cellIndex: number }>;
  multiplier: number;
  payout: number;
}

interface WildReelInfo {
  col: number;
  multiplier: number;
}

interface ActiveBonusSession {
  sessionId: string;
  optionId: BuyBonusOptionId;
  resolvedWildCount: 1 | 2 | 3;
  betAmount: number;
  bonusCost: number;
  totalSpins: number;
  remainingSpins: number;
  spinsPlayed: number;
  totalBonusWin: number;
  spinResults: Array<{
    spinNumber: number;
    payout: number;
    totalMultiplier: number;
    expandedWildReels: WildReelInfo[];
    timestamp: string;
  }>;
}

interface BuyBonusOption {
  id: BuyBonusOptionId;
  costMultiplier: number;
  freeSpinsCount: number;
  guaranteedWilds: number | 'random';
  enabled: boolean;
}

interface PaytableEntry {
  2?: number;
  3: number;
  4: number;
  5: number;
}

interface GoldenTreeConfig {
  paylines: number[][];
  paytable: Record<GoldenTreeRegularSymbolId, PaytableEntry>;
  wildSettings: {
    allowedReels: number[];
    multipliers: number[];
    combineMode: 'multiply' | 'sum' | 'max';
  };
  scatterDollarSettings: {
    pays3: number;
    pays4: number;
    pays5: number;
  };
  scatterStarSettings: {
    allowedReels: number[];
    triggerCount: number;
    payoutMultiplier: number;
  };
  buyBonusOptions: Record<BuyBonusOptionId, BuyBonusOption>;
  maxWinMultiplier: number;
  volatility: 'low' | 'medium' | 'high';
  targetRtpPercent: number;
}

interface GoldenTreeGameProps {
  lang: Language;
  currentUser: AuthUser | null;
  coinsBalance: number;
  betAmounts?: readonly number[];
  onCoinsBalanceSync: (nextBalance: number) => void;
  onOpenWallet: () => void;
  musicEnabled?: boolean;
  onToggleMusic?: () => void;
}

const DEFAULT_PAYLINES: number[][] = [
  [1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
  [0, 1, 2, 1, 0],
  [2, 1, 0, 1, 2],
  [0, 0, 1, 2, 2],
  [2, 2, 1, 0, 0],
  [1, 0, 1, 0, 1],
  [1, 2, 1, 2, 1],
  [0, 1, 1, 1, 0],
];

const DEFAULT_CONFIG: GoldenTreeConfig = {
  paylines: DEFAULT_PAYLINES,
  paytable: {
    seven: { 2: 1, 3: 5, 4: 25, 5: 500 },
    watermelon: { 3: 4, 4: 12, 5: 70 },
    grapes: { 3: 4, 4: 12, 5: 70 },
    bell: { 3: 2, 4: 4, 5: 20 },
    cherry: { 3: 1, 4: 3, 5: 15 },
    orange: { 3: 1, 4: 3, 5: 15 },
    lemon: { 3: 1, 4: 3, 5: 15 },
    plum: { 3: 1, 4: 3, 5: 15 },
  },
  wildSettings: {
    allowedReels: [1, 2, 3],
    multipliers: [1, 2, 3, 5],
    combineMode: 'multiply',
  },
  scatterDollarSettings: { pays3: 5, pays4: 20, pays5: 100 },
  scatterStarSettings: { allowedReels: [0, 2, 4], triggerCount: 5, payoutMultiplier: 20 },
  buyBonusOptions: {
    wild_1: { id: 'wild_1', costMultiplier: 50, freeSpinsCount: 5, guaranteedWilds: 1, enabled: true },
    wild_2: { id: 'wild_2', costMultiplier: 150, freeSpinsCount: 5, guaranteedWilds: 2, enabled: true },
    wild_3: { id: 'wild_3', costMultiplier: 350, freeSpinsCount: 5, guaranteedWilds: 3, enabled: true },
    random_wild: {
      id: 'random_wild',
      costMultiplier: 100,
      freeSpinsCount: 5,
      guaranteedWilds: 'random',
      enabled: true,
    },
  },
  maxWinMultiplier: 10000,
  volatility: 'high',
  targetRtpPercent: 96.5,
};

// Initial showcase columns [col][row]
const INITIAL_COLUMNS: GoldenTreeSymbolId[][] = [
  ['seven', 'watermelon', 'cherry'],
  ['grapes', 'bell', 'orange'],
  ['wild', 'wild', 'wild'],
  ['lemon', 'seven', 'plum'],
  ['scatter_star', 'grapes', 'scatter_dollar'],
];

const INITIAL_WILD_REELS: WildReelInfo[] = [{ col: 2, multiplier: 3 }];

export const GoldenTreeGame: React.FC<GoldenTreeGameProps> = ({
  lang,
  currentUser,
  coinsBalance,
  betAmounts,
  onCoinsBalanceSync,
  onOpenWallet,
  musicEnabled = true,
  onToggleMusic,
}) => {
  const isAr = lang === 'ar';

  const [betSteps, setBetSteps] = useState<readonly number[]>(
    () => (betAmounts && betAmounts.length > 0 ? betAmounts : GAME_BET_AMOUNTS)
  );
  const [selectedBetIdx, setSelectedBetIdx] = useState<number>(0);
  const [config, setConfig] = useState<GoldenTreeConfig>(DEFAULT_CONFIG);

  // Grid & Reel Spin State (5 columns x 3 rows)
  const [columns, setColumns] = useState<GoldenTreeSymbolId[][]>(INITIAL_COLUMNS);
  const [expandedWildReels, setExpandedWildReels] = useState<WildReelInfo[]>(INITIAL_WILD_REELS);
  const [reelSpinning, setReelSpinning] = useState<[boolean, boolean, boolean, boolean, boolean]>([
    false,
    false,
    false,
    false,
    false,
  ]);
  const [reelJustStopped, setReelJustStopped] = useState<
    [boolean, boolean, boolean, boolean, boolean]
  >([false, false, false, false, false]);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);

  // Outcomes & Bonus State
  const [paylineWins, setPaylineWins] = useState<PaylineWin[]>([]);
  const [scatterWins, setScatterWins] = useState<ScatterWin[]>([]);
  const [activeBonus, setActiveBonus] = useState<ActiveBonusSession | null>(null);
  const [bonusSummaryModal, setBonusSummaryModal] = useState<ActiveBonusSession | null>(null);

  // Controls & Modals
  const [turboMode, setTurboMode] = useState<boolean>(false);
  const [autoSpinsRemaining, setAutoSpinsRemaining] = useState<number>(0);
  const [showAutoMenu, setShowAutoMenu] = useState<boolean>(false);
  const isMuted = false;
  const [showBuyBonusModal, setShowBuyBonusModal] = useState<boolean>(false);
  const [confirmBonusOption, setConfirmBonusOption] = useState<BuyBonusOptionId | null>(null);
  const [isBuyingBonus, setIsBuyingBonus] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioRef = useRef<GoldenTreeAudio | null>(null);
  const spinIntervalRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const isMountedRef = useRef<boolean>(true);

  if (!audioRef.current) {
    audioRef.current = new GoldenTreeAudio();
  }

  useEffect(() => {
    audioRef.current?.setMuted(false);
  }, []);

  useEffect(() => {
    if (betAmounts && betAmounts.length > 0) {
      setBetSteps(betAmounts);
    }
  }, [betAmounts]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    if (spinIntervalRef.current !== null) {
      window.clearInterval(spinIntervalRef.current);
      spinIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  // Fetch authoritative server config & recover any active unfinished Free Spins bonus
  const loadServerConfig = useCallback(async () => {
    try {
      const token = getStoredAuthToken();
      const qs = new URLSearchParams();
      if (currentUser?.id) qs.set('userId', currentUser.id);
      if (currentUser?.displayId) qs.set('displayId', currentUser.displayId);
      if (currentUser?.email) qs.set('email', currentUser.email);

      const res = await fetch(`/api/games/golden-tree/config?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!isMountedRef.current || !data?.success) return;

      if (Array.isArray(data.betAmounts) && data.betAmounts.length > 0) {
        setBetSteps(data.betAmounts);
      }
      setConfig({
        paylines: Array.isArray(data.paylines) ? data.paylines : DEFAULT_PAYLINES,
        paytable: data.paytable || DEFAULT_CONFIG.paytable,
        wildSettings: data.wildSettings || DEFAULT_CONFIG.wildSettings,
        scatterDollarSettings: data.scatterDollarSettings || DEFAULT_CONFIG.scatterDollarSettings,
        scatterStarSettings: data.scatterStarSettings || DEFAULT_CONFIG.scatterStarSettings,
        buyBonusOptions: data.buyBonusOptions || DEFAULT_CONFIG.buyBonusOptions,
        maxWinMultiplier: Number(data.maxWinMultiplier) || 10000,
        volatility: data.volatility || 'high',
        targetRtpPercent: Number(data.targetRtpPercent) || 96.5,
      });

      if (data.activeBonusSession && data.activeBonusSession.remainingSpins > 0) {
        setActiveBonus(data.activeBonusSession);
      }
    } catch {}
  }, [currentUser?.id, currentUser?.displayId, currentUser?.email]);

  useEffect(() => {
    loadServerConfig();
  }, [loadServerConfig]);

  const selectedBet = betSteps[selectedBetIdx] ?? betSteps[0] ?? 500;

  const winningCellSet = useMemo(() => {
    const set = new Set<string>();
    paylineWins.forEach((lw) => {
      lw.positions.forEach((p) => set.add(`${p.col}-${p.row}`));
    });
    scatterWins.forEach((sw) => {
      sw.positions.forEach((p) => set.add(`${p.col}-${p.row}`));
    });
    return set;
  }, [paylineWins, scatterWins]);

  const wildReelMap = useMemo(() => {
    const m = new Map<number, number>();
    expandedWildReels.forEach((w) => m.set(w.col, w.multiplier));
    return m;
  }, [expandedWildReels]);

  const animateReelResolution = useCallback(
    (
      finalColumns: GoldenTreeSymbolId[][],
      finalWildReels: WildReelInfo[],
      finalLineWins: PaylineWin[],
      finalScatterWins: ScatterWin[],
      finalPayout: number,
      finalMult: number,
      onComplete: () => void
    ) => {
      clearTimers();
      setReelSpinning([true, true, true, true, true]);
      setReelJustStopped([false, false, false, false, false]);
      setExpandedWildReels([]);
      setPaylineWins([]);
      setScatterWins([]);

      const spinMask: boolean[] = [true, true, true, true, true];
      let tick = 0;

      spinIntervalRef.current = window.setInterval(() => {
        if (!isMountedRef.current) return;
        tick++;
        if (tick % 2 === 0) {
          audioRef.current?.playSpinTick(270 + (tick % 5) * 28);
        }
        setColumns((prev) =>
          prev.map((colCells, colIdx) => {
            if (!spinMask[colIdx]) return colCells;
            return [0, 1, 2].map(() => {
              // Keep star out of reels 2 & 4 even in blur spin animation
              const pool =
                colIdx === 1 || colIdx === 3
                  ? GOLDEN_TREE_ALL_SYMBOLS.filter((s) => s !== 'scatter_star')
                  : GOLDEN_TREE_ALL_SYMBOLS.filter((s) => s !== 'wild');
              return pool[Math.floor(Math.random() * pool.length)];
            });
          })
        );
      }, turboMode ? 45 : 65);

      const stopDelays = turboMode ? [220, 320, 420, 520, 620] : [520, 740, 960, 1180, 1420];
      const finalWildSet = new Set(finalWildReels.map((w) => w.col));

      stopDelays.forEach((delay, colIdx) => {
        const tid = window.setTimeout(() => {
          if (!isMountedRef.current) return;
          spinMask[colIdx] = false;

          setColumns((prev) => {
            const copy = prev.map((c) => [...c]);
            copy[colIdx] = [...finalColumns[colIdx]];
            return copy;
          });

          setReelSpinning((prev) => {
            const next = [...prev] as [boolean, boolean, boolean, boolean, boolean];
            next[colIdx] = false;
            return next;
          });

          setReelJustStopped((prev) => {
            const next = [...prev] as [boolean, boolean, boolean, boolean, boolean];
            next[colIdx] = true;
            return next;
          });

          if (finalWildSet.has(colIdx)) {
            const matchedWild = finalWildReels.find((w) => w.col === colIdx);
            if (matchedWild) {
              setExpandedWildReels((prev) => [
                ...prev.filter((x) => x.col !== colIdx),
                matchedWild,
              ]);
            }
            audioRef.current?.playReelStop(colIdx, true);
          } else {
            audioRef.current?.playReelStop(colIdx, false);
          }

          const clearBounce = window.setTimeout(() => {
            if (!isMountedRef.current) return;
            setReelJustStopped((prev) => {
              const next = [...prev] as [boolean, boolean, boolean, boolean, boolean];
              next[colIdx] = false;
              return next;
            });
          }, 260);
          timersRef.current.push(clearBounce);

          if (colIdx === 4) {
            if (spinIntervalRef.current !== null) {
              window.clearInterval(spinIntervalRef.current);
              spinIntervalRef.current = null;
            }
            setExpandedWildReels(finalWildReels);
            setPaylineWins(finalLineWins);
            setScatterWins(finalScatterWins);
            if (finalPayout > 0) {
              audioRef.current?.playWinFanfare(finalMult);
            }
            setIsSpinning(false);
            onComplete();
          }
        }, delay);
        timersRef.current.push(tid);
      });
    },
    [clearTimers, turboMode]
  );

  // Execute a base spin or free spin
  const handleSpin = useCallback(async () => {
    if (isSpinning) return;
    setErrorMsg(null);

    const isFreeSpin = Boolean(activeBonus && activeBonus.remainingSpins > 0);
    const activeBet = isFreeSpin && activeBonus ? activeBonus.betAmount : selectedBet;

    if (!currentUser) {
      setErrorMsg(isAr ? 'يجب تسجيل الدخول أولاً للعب' : 'Please sign in first to play');
      setAutoSpinsRemaining(0);
      return;
    }

    if (!isFreeSpin && coinsBalance < activeBet) {
      setErrorMsg(
        isAr
          ? `رصيدك (${coinsBalance.toLocaleString()}) أقل من مبلغ الرهان (${activeBet.toLocaleString()})`
          : `Insufficient Coins (${coinsBalance.toLocaleString()} < ${activeBet.toLocaleString()})`
      );
      setAutoSpinsRemaining(0);
      return;
    }

    setIsSpinning(true);
    setShowAutoMenu(false);

    if (!isFreeSpin) {
      onCoinsBalanceSync(Math.max(0, coinsBalance - activeBet));
    }

    try {
      const token = getStoredAuthToken();
      const endpoint = isFreeSpin
        ? '/api/games/golden-tree/bonus-spin'
        : '/api/games/golden-tree/spin';

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: currentUser.id,
          displayId: currentUser.displayId,
          email: currentUser.email,
          betAmount: activeBet,
        }),
      });
      const data = await res.json();

      if (!data?.success || !Array.isArray(data.columns)) {
        setIsSpinning(false);
        setAutoSpinsRemaining(0);
        setErrorMsg(data?.message || (isAr ? 'تعذر إتمام اللفة' : 'Spin failed'));
        if (data?.activeBonusSession) {
          setActiveBonus(data.activeBonusSession);
        }
        if (!isFreeSpin) {
          if (typeof data?.currentCoins === 'number') {
            onCoinsBalanceSync(data.currentCoins);
          } else {
            onCoinsBalanceSync(coinsBalance);
          }
        }
        return;
      }

      const finalCols = data.columns as GoldenTreeSymbolId[][];
      const finalWilds = (Array.isArray(data.expandedWildReels)
        ? data.expandedWildReels
        : []) as WildReelInfo[];
      const finalLineWins = (Array.isArray(data.paylineWins) ? data.paylineWins : []) as PaylineWin[];
      const finalScatterWins = (Array.isArray(data.scatterWins)
        ? data.scatterWins
        : []) as ScatterWin[];
      const finalPayout = Number(data.payout) || 0;
      const finalMult = Number(data.totalMultiplier) || 0;

      animateReelResolution(
        finalCols,
        finalWilds,
        finalLineWins,
        finalScatterWins,
        finalPayout,
        finalMult,
        () => {
          if (!isMountedRef.current) return;
          if (typeof data.newCoinsBalance === 'number') {
            onCoinsBalanceSync(data.newCoinsBalance);
          }
          if (isFreeSpin) {
            if (data.bonusCompleted && data.bonusSummary) {
              setActiveBonus(null);
              setBonusSummaryModal(data.bonusSummary as ActiveBonusSession);
            } else if (data.activeBonusSession) {
              setActiveBonus(data.activeBonusSession as ActiveBonusSession);
            }
          }
        }
      );
    } catch {
      setIsSpinning(false);
      setAutoSpinsRemaining(0);
      setErrorMsg(isAr ? 'تعذر الاتصال بالخادم' : 'Network connection error');
      if (!isFreeSpin) {
        onCoinsBalanceSync(coinsBalance);
      }
    }
  }, [
    isSpinning,
    activeBonus,
    selectedBet,
    currentUser,
    isAr,
    coinsBalance,
    onCoinsBalanceSync,
    animateReelResolution,
  ]);

  const isBonusActive = Boolean(activeBonus && activeBonus.remainingSpins > 0);

  // Automatic Bonus Free Spins loop: bonus spins play automatically with Spin button disabled
  useEffect(() => {
    if (!activeBonus || activeBonus.remainingSpins <= 0) return;
    if (isSpinning || isBuyingBonus || bonusSummaryModal || errorMsg) return;

    const delayMs =
      activeBonus.spinsPlayed === 0
        ? turboMode
          ? 240
          : 480
        : turboMode
        ? 450
        : 950;

    const t = window.setTimeout(() => {
      if (!isMountedRef.current) return;
      handleSpin();
    }, delayMs);
    return () => window.clearTimeout(t);
  }, [activeBonus, isSpinning, isBuyingBonus, bonusSummaryModal, errorMsg, turboMode, handleSpin]);

  // Regular Auto-spin loop (disabled/paused whenever Free Spins bonus is active)
  useEffect(() => {
    if (isSpinning || bonusSummaryModal || isBonusActive) return;
    if (autoSpinsRemaining > 0) {
      const t = window.setTimeout(() => {
        if (!isMountedRef.current) return;
        setAutoSpinsRemaining((n) => Math.max(0, n - 1));
        handleSpin();
      }, turboMode ? 320 : 650);
      return () => window.clearTimeout(t);
    }
  }, [autoSpinsRemaining, isSpinning, bonusSummaryModal, isBonusActive, handleSpin, turboMode]);

  // Purchase Bonus Handler
  const handleConfirmBuyBonus = async () => {
    if (!confirmBonusOption || isBuyingBonus || isSpinning) return;
    const option = config.buyBonusOptions[confirmBonusOption];
    if (!option) return;

    const cost = Math.round(selectedBet * option.costMultiplier);
    setErrorMsg(null);

    if (!currentUser) {
      setErrorMsg(isAr ? 'يرجى تسجيل الدخول أولاً للشراء' : 'Please sign in first');
      setConfirmBonusOption(null);
      return;
    }

    if (coinsBalance < cost) {
      setErrorMsg(
        isAr
          ? `الرصيد غير كافٍ لشراء البونص (${cost.toLocaleString()} Coin)`
          : `Insufficient balance (${cost.toLocaleString()} Coins required)`
      );
      setConfirmBonusOption(null);
      return;
    }

    setIsBuyingBonus(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch('/api/games/golden-tree/buy-bonus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: currentUser.id,
          displayId: currentUser.displayId,
          email: currentUser.email,
          optionId: confirmBonusOption,
          betAmount: selectedBet,
        }),
      });
      const data = await res.json();

      if (!data?.success || !data.activeBonusSession) {
        setErrorMsg(data?.message || (isAr ? 'تعذر تفعيل البونص' : 'Bonus activation failed'));
        setIsBuyingBonus(false);
        return;
      }

      if (typeof data.newCoinsBalance === 'number') {
        onCoinsBalanceSync(data.newCoinsBalance);
      }

      audioRef.current?.playBonusTrigger();
      setActiveBonus(data.activeBonusSession as ActiveBonusSession);
      setPaylineWins([]);
      setScatterWins([]);
      setConfirmBonusOption(null);
      setShowBuyBonusModal(false);
    } catch {
      setErrorMsg(isAr ? 'حدث خطأ أثناء شراء البونص' : 'Network error purchasing bonus');
    } finally {
      setIsBuyingBonus(false);
    }
  };

  // Helper to build SVG path string for a payline across 5 columns x 3 rows (viewBox 500 x 300)
  const buildPaylineSvgPoints = (lineRows: number[]) =>
    lineRows.map((row, col) => `${col * 100 + 50},${row * 100 + 50}`).join(' ');

  const displayedPaylinesToDraw = useMemo(
    () =>
      paylineWins.map((w) => ({
        lineIndex: w.lineIndex,
        rows: config.paylines[w.lineIndex] || DEFAULT_PAYLINES[w.lineIndex],
      })),
    [paylineWins, config.paylines]
  );

  const bonusOptionOrder: BuyBonusOptionId[] = ['wild_1', 'wild_2', 'wild_3', 'random_wild'];

  const getBonusOptionCopy = (optId: BuyBonusOptionId) => {
    switch (optId) {
      case 'wild_1':
        return {
          title: isAr ? '1 شجرة Wild مضمونة' : '1 Guaranteed Wild',
          desc: isAr
            ? '5 لفات مجانية · ظهور شجرة ذهبية Wild واحدة مضمونة في كل لفة'
            : '5 Free Spins · At least 1 Golden Tree Wild per spin',
          badge: '1 WILD',
          accent: 'from-amber-400 to-yellow-600',
        };
      case 'wild_2':
        return {
          title: isAr ? '2 شجرتان Wild مضمونتان' : '2 Guaranteed Wilds',
          desc: isAr
            ? '5 لفات مجانية · ظهور شجرتين ذهبيتين Wild مضمونتين في كل لفة'
            : '5 Free Spins · At least 2 Golden Tree Wilds per spin',
          badge: '2 WILDS',
          accent: 'from-orange-400 to-amber-600',
        };
      case 'wild_3':
        return {
          title: isAr ? '3 أشجار Wild (كامل البكرات 2-3-4)' : '3 Full Wild Reels',
          desc: isAr
            ? '5 لفات مجانية · البكرات 2 و 3 و 4 تتحول بالكامل إلى Wild مضاعف!'
            : '5 Free Spins · Reels 2, 3 & 4 all Wild with multipliers!',
          badge: '3 WILDS',
          accent: 'from-yellow-300 via-amber-400 to-rose-500',
        };
      case 'random_wild':
        return {
          title: isAr ? 'بونص Wild العشوائي' : 'Mystery Wild Bonus',
          desc: isAr
            ? '5 لفات مجانية · يختار عشوائياً (1 أو 2 أو 3) أشجار Wild بمضاعفات x1/x2/x3/x5'
            : '5 Free Spins · Randomly draws 1, 2 or 3 Wilds (x1/x2/x3/x5)',
          badge: 'RANDOM',
          accent: 'from-fuchsia-500 to-amber-500',
        };
    }
  };

  return (
    <div
      className="relative flex-1 min-h-0 w-full flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,#4c1d95_0%,#240748_45%,#0f0320_100%)] text-white select-none"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Ambient Golden Glow Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[220px] rounded-full bg-amber-400/15 blur-3xl" />
        <div className="absolute bottom-10 left-1/4 w-72 h-72 rounded-full bg-purple-600/20 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto px-2.5 sm:px-5 py-1.5 flex flex-col justify-center gap-2 max-h-full">
        {/* Compact Active Bonus Strip (only visible during Free Spins Bonus) */}
        {activeBonus && (
          <div className="shrink-0 rounded-2xl bg-purple-950/85 backdrop-blur-md border border-amber-400/35 px-3 py-1.5 flex items-center justify-between gap-2 text-[11px] shadow-sm">
            <div className="flex items-center gap-1.5 min-w-0 text-amber-200 font-extrabold truncate">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="truncate">
                {isAr
                  ? `بونص تلقائي · ${activeBonus.resolvedWildCount} Wild`
                  : `Auto Bonus · ${activeBonus.resolvedWildCount} Wild`}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="px-2 py-0.5 rounded-lg bg-amber-400/15 border border-amber-400/35 text-amber-200 font-black tabular-nums">
                {isAr ? 'اللفات' : 'Spins'} {activeBonus.remainingSpins}/{activeBonus.totalSpins}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-black/45 border border-amber-400/40 text-yellow-300 font-black tabular-nums inline-flex items-center gap-1">
                <CoinIcon className="w-3 h-3 text-amber-400 shrink-0" />
                <span>{activeBonus.totalBonusWin.toLocaleString()}</span>
              </span>
            </div>
          </div>
        )}

        {/* 5x3 Golden-Framed Slot Machine Stage */}
        <div
          className="relative shrink-0 rounded-3xl p-1.5 sm:p-3 bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-[0_14px_40px_rgba(0,0,0,0.6),0_0_28px_rgba(245,158,11,0.18)]"
          dir="ltr"
        >
          {/* Inner Velvet Dark Purple Cabinet */}
          <div className="relative rounded-[20px] bg-gradient-to-b from-[#1a0736] via-[#120426] to-[#0a0217] p-1.5 sm:p-2.5 border border-purple-400/20 overflow-hidden">
            {/* 5 Columns Grid */}
            <div className="relative grid grid-cols-5 gap-1 sm:gap-2">
              {[0, 1, 2, 3, 4].map((colIdx) => {
                const wildMultiplier = wildReelMap.get(colIdx);
                const isExpandedWild = wildMultiplier !== undefined;
                const spinningThisCol = reelSpinning[colIdx];
                const stoppedBounce = reelJustStopped[colIdx];

                return (
                  <div
                    key={colIdx}
                    className={`relative rounded-xl border-2 p-1 sm:p-1.5 transition-transform duration-200 ${
                      isExpandedWild && !spinningThisCol
                        ? 'border-amber-300 bg-amber-500/10 shadow-[0_0_18px_rgba(250,204,21,0.35)]'
                        : 'border-amber-500/45 bg-gradient-to-b from-purple-950/90 via-[#1b0838] to-purple-950/90 shadow-inner'
                    } ${stoppedBounce ? 'translate-y-0.5 scale-[1.01]' : ''}`}
                  >
                    {/* Expanded Golden Tree Wild Overlay covering all 3 rows */}
                    {isExpandedWild && !spinningThisCol ? (
                      <div className="w-full aspect-[1/2.75] sm:aspect-[1/2.55]">
                        <GoldenTreeExpandedWildArt multiplier={wildMultiplier!} />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 sm:gap-2">
                        {[0, 1, 2].map((rowIdx) => {
                          const sym = columns[colIdx]?.[rowIdx] ?? 'seven';
                          const isWinningCell =
                            !spinningThisCol && winningCellSet.has(`${colIdx}-${rowIdx}`);

                          return (
                            <div
                              key={rowIdx}
                              className={`relative w-full aspect-square rounded-lg flex items-center justify-center transition-all duration-200 ${
                                spinningThisCol
                                  ? 'opacity-85 blur-[0.8px] scale-95 bg-purple-900/30'
                                  : isWinningCell
                                  ? 'bg-amber-400/20 ring-2 ring-amber-300 shadow-[0_0_16px_rgba(250,204,21,0.55)] scale-[1.03]'
                                  : 'bg-purple-950/60 border border-purple-500/15'
                              }`}
                            >
                              <GoldenTreeSymbolArt
                                symbol={sym}
                                className="w-[82%] h-[82%] drop-shadow-[0_3px_6px_rgba(0,0,0,0.65)]"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* SVG Paylines Overlay (500 x 300 coordinate space aligned to 5 cols x 3 rows) */}
              {!isSpinning && displayedPaylinesToDraw.length > 0 && (
                <svg
                  viewBox="0 0 500 300"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 w-full h-full z-20"
                  aria-hidden="true"
                >
                  {displayedPaylinesToDraw.map(({ lineIndex, rows }) => {
                    const color = PAYLINE_COLORS[lineIndex % PAYLINE_COLORS.length];
                    return (
                      <g key={lineIndex}>
                        <polyline
                          points={buildPaylineSvgPoints(rows)}
                          fill="none"
                          stroke={color}
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeOpacity="0.92"
                        />
                        {rows.map((r, c) => (
                          <circle
                            key={`${lineIndex}-${c}`}
                            cx={c * 100 + 50}
                            cy={r * 100 + 50}
                            r="7"
                            fill={color}
                            stroke="#1E073B"
                            strokeWidth="2.5"
                          />
                        ))}
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorMsg && (
          <div className="rounded-xl bg-rose-950/85 border border-rose-400/60 text-rose-100 px-3.5 py-2.5 text-xs sm:text-sm font-bold flex items-center justify-between gap-2">
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="p-1 rounded-lg hover:bg-rose-800/60 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Bottom Control Dock */}
        <div className="shrink-0 rounded-2xl bg-purple-950/80 backdrop-blur-md border border-amber-400/35 p-2.5 sm:p-3 shadow-[0_10px_30px_rgba(0,0,0,0.45)] flex flex-col gap-2">
          <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-2 sm:gap-3">
            {/* Bet Controls (Left 5 cols on desktop) */}
            <div className="md:col-span-5 flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs font-bold text-amber-200/80">
                <span>{isAr ? 'قيمة الرهان' : 'BET AMOUNT'}</span>
                <span className="text-amber-300 font-black tabular-nums">
                  {selectedBet.toLocaleString()} Coin
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSpinning || Boolean(activeBonus) || selectedBetIdx <= 0}
                  onClick={() => setSelectedBetIdx((i) => Math.max(0, i - 1))}
                  className="p-2 rounded-xl bg-purple-900/80 border border-amber-400/35 text-amber-200 hover:border-amber-300 disabled:opacity-40 cursor-pointer"
                >
                  {isAr ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <GameBetWheel
                    lang={lang}
                    betAmounts={betSteps}
                    selectedBetIdx={selectedBetIdx}
                    onSelectBetIdx={setSelectedBetIdx}
                    coinsBalance={coinsBalance}
                    isMuted={isMuted}
                    disabled={isSpinning || Boolean(activeBonus)}
                    onOpenWallet={onOpenWallet}
                  />
                </div>
                <button
                  type="button"
                  disabled={isSpinning || Boolean(activeBonus) || selectedBetIdx >= betSteps.length - 1}
                  onClick={() => setSelectedBetIdx((i) => Math.min(betSteps.length - 1, i + 1))}
                  className="p-2 rounded-xl bg-purple-900/80 border border-amber-400/35 text-amber-200 hover:border-amber-300 disabled:opacity-40 cursor-pointer"
                >
                  {isAr ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Central SPIN Button + Music, Turbo & Auto Spin (Center 4 cols) */}
            <div className="md:col-span-4 flex items-center justify-center gap-2 relative">
              {/* Music Toggle Button (Bottom Control Dock) */}
              <button
                type="button"
                onClick={() => onToggleMusic?.()}
                className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl border text-[10px] font-black transition-all cursor-pointer ${
                  musicEnabled
                    ? 'bg-purple-900/80 text-amber-200 border-amber-400/30 hover:border-amber-300'
                    : 'bg-rose-950/70 text-rose-200 border-rose-400/40 hover:border-rose-300'
                }`}
                aria-label={musicEnabled ? (isAr ? 'إيقاف الموسيقى' : 'Music Off') : (isAr ? 'تشغيل الموسيقى' : 'Music On')}
                title={musicEnabled ? (isAr ? 'إيقاف الموسيقى' : 'Music Off') : (isAr ? 'تشغيل الموسيقى' : 'Music On')}
              >
                {musicEnabled ? <Music className="w-4 h-4 mb-0.5" /> : <VolumeX className="w-4 h-4 mb-0.5" />}
                <span>{isAr ? 'موسيقى' : 'Music'}</span>
              </button>

              {/* Turbo Button */}
              <button
                type="button"
                onClick={() => setTurboMode((t) => !t)}
                className={`flex flex-col items-center justify-center w-11 h-12 rounded-2xl border text-[10px] font-black transition-all cursor-pointer ${
                  turboMode
                    ? 'bg-amber-400 text-purple-950 border-yellow-100 shadow-[0_0_15px_rgba(250,204,21,0.5)]'
                    : 'bg-purple-900/80 text-amber-200 border-amber-400/30 hover:border-amber-300'
                }`}
                title={isAr ? 'دوران سريع (Turbo)' : 'Turbo Spin'}
              >
                <Zap className="w-4 h-4 mb-0.5" />
                <span>TURBO</span>
              </button>

              {/* Main Gold SPIN Button (strictly disabled during automatic Free Spins Bonus) */}
              <button
                type="button"
                disabled={isSpinning || isBonusActive}
                onClick={handleSpin}
                className="relative group flex items-center justify-center w-24 h-16 sm:w-28 sm:h-16 rounded-2xl bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 text-purple-950 font-black text-sm sm:text-base shadow-[0_6px_25px_rgba(245,158,11,0.55),inset_0_2px_2px_rgba(255,255,255,0.75)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer border-2 border-yellow-100"
              >
                <RotateCw className={`w-5 h-5 me-1.5 shrink-0 ${isSpinning ? 'animate-spin' : ''}`} />
                <span className="truncate">
                  {isBonusActive
                    ? isAr
                      ? 'بونص تلقائي'
                      : 'AUTO'
                    : isAr
                    ? 'تدوير'
                    : 'SPIN'}
                </span>
              </button>

              {/* Auto Spin Button */}
              <div className="relative">
                <button
                  type="button"
                  disabled={isBonusActive}
                  onClick={() => {
                    if (isBonusActive) return;
                    if (autoSpinsRemaining > 0) {
                      setAutoSpinsRemaining(0);
                    } else {
                      setShowAutoMenu((s) => !s);
                    }
                  }}
                  className={`flex flex-col items-center justify-center w-12 h-12 rounded-2xl border text-[10px] font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                    autoSpinsRemaining > 0
                      ? 'bg-rose-500 text-white border-rose-200 shadow-[0_0_14px_rgba(244,63,94,0.5)]'
                      : 'bg-purple-900/80 text-amber-200 border-amber-400/30 hover:border-amber-300'
                  }`}
                >
                  {autoSpinsRemaining > 0 ? (
                    <>
                      <Pause className="w-4 h-4 mb-0.5" />
                      <span>{autoSpinsRemaining}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mb-0.5" />
                      <span>AUTO</span>
                    </>
                  )}
                </button>

                {showAutoMenu && (
                  <div className="absolute bottom-14 end-0 z-30 w-32 rounded-xl bg-purple-950 border border-amber-400/50 shadow-2xl p-1.5 flex flex-col gap-1">
                    {[10, 25, 50, 100].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => {
                          setShowAutoMenu(false);
                          setAutoSpinsRemaining(count);
                        }}
                        className="w-full px-3 py-1.5 rounded-lg text-xs font-black text-amber-100 hover:bg-amber-400 hover:text-purple-950 text-center transition-colors cursor-pointer"
                      >
                        {count} {isAr ? 'لفة' : 'Spins'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Buy Bonus & Paytable Actions (Right 3 cols) */}
            <div className="md:col-span-3 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSpinning || Boolean(activeBonus)}
                onClick={() => {
                  setConfirmBonusOption(null);
                  setShowBuyBonusModal(true);
                }}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-amber-500 border border-amber-300 text-white font-black text-xs sm:text-sm shadow-[0_4px_20px_rgba(217,70,239,0.4)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-45 cursor-pointer"
              >
                <Crown className="w-4 h-4 text-yellow-200 shrink-0" />
                <span>{isAr ? 'شراء بونص' : 'BUY BONUS'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          MODAL: BUY BONUS (4 OPTIONS + CONFIRMATION STEP)
         ======================================================== */}
      {showBuyBonusModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-3xl bg-[#1b0838] border-2 border-amber-400/60 p-5 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-amber-400/20 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <h2 className="text-base sm:text-lg font-black text-amber-200">
                  {isAr ? 'شراء جولة البونص (Buy Bonus)' : 'Buy Free Spins Bonus'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfirmBonusOption(null);
                  setShowBuyBonusModal(false);
                }}
                className="p-1.5 rounded-xl bg-purple-900 hover:bg-purple-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!confirmBonusOption ? (
              <div className="space-y-3">
                <div className="text-xs text-amber-100/80 flex items-center justify-between">
                  <span>{isAr ? 'الرهان الأساسي الحالي:' : 'Base Bet:'}</span>
                  <span className="font-black text-amber-300">
                    {selectedBet.toLocaleString()} Coin
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {bonusOptionOrder.map((optId) => {
                    const opt = config.buyBonusOptions[optId];
                    if (!opt || !opt.enabled) return null;
                    const copy = getBonusOptionCopy(optId);
                    const totalCost = Math.round(selectedBet * opt.costMultiplier);
                    const canAfford = coinsBalance >= totalCost;

                    return (
                      <button
                        key={optId}
                        type="button"
                        onClick={() => setConfirmBonusOption(optId)}
                        className="text-start rounded-2xl bg-purple-950/90 border-2 border-amber-400/35 hover:border-amber-300 p-4 transition-all hover:scale-[1.01] cursor-pointer flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-black text-purple-950 bg-gradient-to-r ${copy.accent}`}
                            >
                              {copy.badge}
                            </span>
                            <span className="text-xs font-extrabold text-amber-300">
                              x{opt.costMultiplier}
                            </span>
                          </div>
                          <h3 className="text-sm font-black text-white">{copy.title}</h3>
                          <p className="text-xs text-purple-200/80 leading-relaxed">{copy.desc}</p>
                        </div>

                        <div
                          className={`w-full py-2 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 ${
                            canAfford
                              ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-purple-950'
                              : 'bg-rose-950/80 text-rose-200 border border-rose-500/40'
                          }`}
                        >
                          <CoinIcon className="w-3.5 h-3.5" />
                          <span>{totalCost.toLocaleString()}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Confirmation Step Before Deducting Balance */
              (() => {
                const chosen = config.buyBonusOptions[confirmBonusOption];
                const copy = getBonusOptionCopy(confirmBonusOption);
                const cost = Math.round(selectedBet * chosen.costMultiplier);
                return (
                  <div className="space-y-4 py-2">
                    <div className="rounded-2xl bg-purple-950/90 border border-amber-400/45 p-4 space-y-2.5">
                      <div className="text-xs font-bold text-amber-300 uppercase">
                        {isAr ? 'تأكيد شراء البونص' : 'CONFIRM BONUS PURCHASE'}
                      </div>
                      <div className="text-lg font-black text-white">{copy.title}</div>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-purple-800/70 text-xs">
                        <div>
                          <span className="text-purple-300 block">
                            {isAr ? 'عدد اللفات المجانية' : 'Free Spins'}
                          </span>
                          <span className="font-black text-amber-200 text-sm">
                            {chosen.freeSpinsCount} {isAr ? 'لفات' : 'Spins'}
                          </span>
                        </div>
                        <div>
                          <span className="text-purple-300 block">
                            {isAr ? 'التكلفة الإجمالية' : 'Total Cost'}
                          </span>
                          <span className="font-black text-yellow-300 text-sm">
                            {cost.toLocaleString()} Coin
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        disabled={isBuyingBonus}
                        onClick={() => setConfirmBonusOption(null)}
                        className="flex-1 py-2.5 rounded-xl bg-purple-900 border border-purple-600 text-sm font-bold text-purple-100 hover:bg-purple-800 cursor-pointer"
                      >
                        {isAr ? 'رجوع' : 'Back'}
                      </button>
                      <button
                        type="button"
                        disabled={isBuyingBonus}
                        onClick={handleConfirmBuyBonus}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-purple-950 text-sm font-black shadow-lg hover:brightness-110 disabled:opacity-50 cursor-pointer"
                      >
                        {isBuyingBonus
                          ? isAr
                            ? 'جاري التفعيل...'
                            : 'Activating...'
                          : isAr
                          ? 'تأكيد وشراء'
                          : 'Confirm & Activate'}
                      </button>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: BONUS COMPLETION SUMMARY CELEBRATION
         ======================================================== */}
      {bonusSummaryModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-purple-900 via-[#1f0742] to-purple-950 border-2 border-amber-300 p-6 text-center text-white shadow-[0_0_50px_rgba(250,204,21,0.4)] space-y-4">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
              <Trophy className="w-9 h-9 text-purple-950" />
            </div>
            <div>
              <div className="text-xs font-extrabold uppercase tracking-widest text-amber-300">
                {isAr ? 'انتهت جولة البونص!' : 'FREE SPINS COMPLETE!'}
              </div>
              <h2 className="text-2xl font-black mt-1 text-white">
                {isAr ? 'إجمالي أرباح البونص' : 'TOTAL BONUS WIN'}
              </h2>
            </div>

            <div className="py-3 px-4 rounded-2xl bg-black/45 border border-amber-400/50 flex items-center justify-center gap-2">
              <CoinIcon className="w-7 h-7 text-amber-400" />
              <span className="text-3xl font-black text-yellow-300 tabular-nums">
                {bonusSummaryModal.totalBonusWin.toLocaleString()}
              </span>
            </div>

            <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs">
              {bonusSummaryModal.spinResults.map((sr) => (
                <div
                  key={sr.spinNumber}
                  className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-purple-950/80 border border-purple-700/50"
                >
                  <span className="font-bold text-purple-200">
                    {isAr ? `اللفة ${sr.spinNumber}` : `Spin #${sr.spinNumber}`}
                  </span>
                  <span className="font-black text-amber-300 tabular-nums">
                    +{sr.payout.toLocaleString()} (x{sr.totalMultiplier})
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setBonusSummaryModal(null)}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-yellow-300 via-amber-400 to-amber-500 text-purple-950 font-black text-sm shadow-lg hover:brightness-110 cursor-pointer flex items-center justify-center gap-2"
            >
              <Award className="w-4 h-4" />
              <span>{isAr ? 'استلام ومتابعة اللعب' : 'Collect & Continue'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
