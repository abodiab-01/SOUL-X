import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bomb,
  Gem,
  Music,
  VolumeX,
  Play,
  Coins,
  RotateCcw,
} from 'lucide-react';
import { AuthUser, Language } from '../types';
import { CoinIcon } from './CurrencyIcons';
import { GameBetWheel } from './GameBetWheel';
import { getStoredAuthToken } from '../lib/authStorage';
import { GAME_BET_AMOUNTS } from '../lib/gamesConfig';

interface MinesGameProps {
  lang: Language;
  currentUser: AuthUser | null;
  coinsBalance: number;
  betAmounts?: readonly number[];
  onCoinsBalanceSync: (nextBalance: number) => void;
  onOpenWallet: () => void;
  musicEnabled?: boolean;
  onToggleMusic?: () => void;
}

const GRID_SIZE = 25;
const DEFAULT_MINES_OPTIONS = [1, 3, 5, 10, 15, 20] as const;

type RoundPhase = 'idle' | 'active' | 'busted' | 'cashed_out';

interface MinesLastSummary {
  outcome: 'busted' | 'cashed_out' | 'cleared';
  multiplier: number;
  payout: number;
  netProfit: number;
}

export const MinesGame: React.FC<MinesGameProps> = ({
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
  const [minesOptions, setMinesOptions] = useState<readonly number[]>(DEFAULT_MINES_OPTIONS);
  const [selectedBetIdx, setSelectedBetIdx] = useState<number>(0);
  const [minesCount, setMinesCount] = useState<number>(3);

  const [phase, setPhase] = useState<RoundPhase>('idle');
  const [roundId, setRoundId] = useState<string | null>(null);
  const [activeBetAmount, setActiveBetAmount] = useState<number>(0);
  const [revealedSafe, setRevealedSafe] = useState<number[]>([]);
  const [mineTiles, setMineTiles] = useState<number[]>([]);
  const [detonatedTile, setDetonatedTile] = useState<number | null>(null);
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1);
  const [nextMultiplier, setNextMultiplier] = useState<number>(1.1);
  const [currentPayout, setCurrentPayout] = useState<number>(0);
  const [lastSummary, setLastSummary] = useState<MinesLastSummary | null>(null);

  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [pendingTile, setPendingTile] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isMuted = false;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const isMutedRef = useRef<boolean>(false);
  const onCoinsBalanceSyncRef = useRef(onCoinsBalanceSync);

  useEffect(() => {
    onCoinsBalanceSyncRef.current = onCoinsBalanceSync;
  }, [onCoinsBalanceSync]);

  useEffect(() => {
    if (betAmounts && betAmounts.length > 0) {
      setBetSteps(betAmounts);
    }
  }, [betAmounts]);

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

  const playGemSound = useCallback(
    (stepCount: number) => {
      const ctx = getAudioCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const baseFreq = 540 + Math.min(stepCount, 18) * 34;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.08);
        gain.gain.setValueAtTime(0.075, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      } catch {}
    },
    [getAudioCtx]
  );

  const playMineExplosionSound = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(170, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.28);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.32);
    } catch {}
  }, [getAudioCtx]);

  const playCashoutSound = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.045);
        gain.gain.setValueAtTime(0.075, now + idx * 0.045);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.045 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.045);
        osc.stop(now + idx * 0.045 + 0.24);
      });
    } catch {}
  }, [getAudioCtx]);

  const buildAuthHeaders = () => {
    const token = getStoredAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // Load config & resume any in-progress round cleanly
  useEffect(() => {
    fetch('/api/games/mines/config')
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) {
          if (Array.isArray(data.betAmounts) && data.betAmounts.length > 0) {
            setBetSteps(data.betAmounts);
          }
          if (Array.isArray(data.minesOptions) && data.minesOptions.length > 0) {
            setMinesOptions(data.minesOptions);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const token = getStoredAuthToken();
    const params = new URLSearchParams();
    if (currentUser.id) params.set('userId', currentUser.id);
    if (currentUser.displayId) params.set('displayId', currentUser.displayId);
    if (currentUser.email) params.set('email', currentUser.email);

    fetch(`/api/games/mines/active?${params.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        const active = data?.activeRound;
        if (data?.success && active?.roundId) {
          setRoundId(active.roundId);
          setActiveBetAmount(active.betAmount);
          setMinesCount(active.minesCount);
          setRevealedSafe(Array.isArray(active.revealedIndices) ? active.revealedIndices : []);
          setMineTiles([]);
          setDetonatedTile(null);
          setCurrentMultiplier(active.currentMultiplier || 1);
          setNextMultiplier(active.nextMultiplier || 1.1);
          setCurrentPayout(active.currentPayout || 0);
          setLastSummary(null);
          setPhase('active');

          const matchedBetIdx = betSteps.indexOf(active.betAmount);
          if (matchedBetIdx >= 0) {
            setSelectedBetIdx(matchedBetIdx);
          }
          if (typeof data.coinsBalance === 'number') {
            onCoinsBalanceSyncRef.current(data.coinsBalance);
          }
        }
      })
      .catch(() => {});
  }, [currentUser?.id]);

  const selectedBet = betSteps[selectedBetIdx] ?? betSteps[0] ?? 500;
  const isRoundActive = phase === 'active';

  const revealedSet = useMemo(() => new Set(revealedSafe), [revealedSafe]);
  const mineSet = useMemo(() => new Set(mineTiles), [mineTiles]);

  const handleStartGame = async () => {
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

    setIsBusy(true);
    try {
      const res = await fetch('/api/games/mines/start', {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          userId: currentUser.id,
          displayId: currentUser.displayId,
          email: currentUser.email,
          betAmount: selectedBet,
          minesCount,
        }),
      });
      const data = await res.json();

      if (!data?.success) {
        if (data?.code === 'ACTIVE_ROUND_EXISTS' && data?.activeRound) {
          const active = data.activeRound;
          setRoundId(active.roundId);
          setActiveBetAmount(active.betAmount);
          setMinesCount(active.minesCount);
          setRevealedSafe(active.revealedIndices || []);
          setMineTiles([]);
          setDetonatedTile(null);
          setCurrentMultiplier(active.currentMultiplier || 1);
          setNextMultiplier(active.nextMultiplier || 1.1);
          setCurrentPayout(active.currentPayout || 0);
          setPhase('active');
        } else {
          setErrorMsg(data?.message || (isAr ? 'تعذر بدء الجولة' : 'Failed to start round'));
          if (typeof data?.currentCoins === 'number') {
            onCoinsBalanceSync(data.currentCoins);
          }
        }
        return;
      }

      if (typeof data.newCoinsBalance === 'number') {
        onCoinsBalanceSync(data.newCoinsBalance);
      }
      setRoundId(data.roundId);
      setActiveBetAmount(data.betAmount ?? selectedBet);
      setRevealedSafe([]);
      setMineTiles([]);
      setDetonatedTile(null);
      setCurrentMultiplier(1);
      setNextMultiplier(data.nextMultiplier ?? 1.1);
      setCurrentPayout(0);
      setLastSummary(null);
      setPhase('active');
    } catch {
      setErrorMsg(isAr ? 'حدث خطأ في الاتصال بالخادم' : 'Network error connecting to server');
    } finally {
      setIsBusy(false);
    }
  };

  const handleTileClick = async (tileIndex: number) => {
    if (!isRoundActive || !roundId || isBusy || pendingTile !== null) return;
    if (revealedSet.has(tileIndex)) return;

    setErrorMsg(null);
    setPendingTile(tileIndex);
    try {
      const res = await fetch('/api/games/mines/reveal', {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          userId: currentUser?.id,
          displayId: currentUser?.displayId,
          email: currentUser?.email,
          roundId,
          tileIndex,
        }),
      });
      const data = await res.json();
      if (!data?.success) {
        setErrorMsg(data?.message || (isAr ? 'تعذر فتح المربع' : 'Could not reveal tile'));
        return;
      }

      if (data.outcome === 'mine') {
        playMineExplosionSound();
        setRevealedSafe(Array.isArray(data.revealedIndices) ? data.revealedIndices : revealedSafe);
        setMineTiles(Array.isArray(data.mineIndices) ? data.mineIndices : [tileIndex]);
        setDetonatedTile(tileIndex);
        setCurrentMultiplier(0);
        setCurrentPayout(0);
        setLastSummary({
          outcome: 'busted',
          multiplier: 0,
          payout: 0,
          netProfit: data.netProfit ?? -activeBetAmount,
        });
        setPhase('busted');
        if (typeof data.newCoinsBalance === 'number') {
          onCoinsBalanceSync(data.newCoinsBalance);
        }
        return;
      }

      if (data.outcome === 'cleared') {
        playCashoutSound();
        setRevealedSafe(Array.isArray(data.revealedIndices) ? data.revealedIndices : [...revealedSafe, tileIndex]);
        setMineTiles(Array.isArray(data.mineIndices) ? data.mineIndices : []);
        setCurrentMultiplier(data.multiplier ?? currentMultiplier);
        setCurrentPayout(data.payout ?? 0);
        setLastSummary({
          outcome: 'cleared',
          multiplier: data.multiplier ?? currentMultiplier,
          payout: data.payout ?? 0,
          netProfit: data.netProfit ?? 0,
        });
        setPhase('cashed_out');
        if (typeof data.newCoinsBalance === 'number') {
          onCoinsBalanceSync(data.newCoinsBalance);
        }
        return;
      }

      // Safe gem found!
      const nextList: number[] = Array.isArray(data.revealedIndices)
        ? data.revealedIndices
        : [...revealedSafe, tileIndex];
      playGemSound(nextList.length);
      setRevealedSafe(nextList);
      setCurrentMultiplier(data.currentMultiplier ?? currentMultiplier);
      setNextMultiplier(data.nextMultiplier ?? nextMultiplier);
      setCurrentPayout(data.currentPayout ?? 0);
    } catch {
      setErrorMsg(isAr ? 'حدث خطأ في الاتصال بالخادم' : 'Network error connecting to server');
    } finally {
      setPendingTile(null);
    }
  };

  const handleCashOut = async () => {
    if (!isRoundActive || !roundId || revealedSafe.length < 1 || isBusy) return;
    setErrorMsg(null);
    setIsBusy(true);
    try {
      const res = await fetch('/api/games/mines/cashout', {
        method: 'POST',
        headers: buildAuthHeaders(),
        body: JSON.stringify({
          userId: currentUser?.id,
          displayId: currentUser?.displayId,
          email: currentUser?.email,
          roundId,
        }),
      });
      const data = await res.json();
      if (!data?.success) {
        setErrorMsg(data?.message || (isAr ? 'تعذر سحب الأرباح' : 'Could not cash out'));
        return;
      }

      playCashoutSound();
      setMineTiles(Array.isArray(data.mineIndices) ? data.mineIndices : []);
      setCurrentMultiplier(data.multiplier ?? currentMultiplier);
      setCurrentPayout(data.payout ?? 0);
      setLastSummary({
        outcome: 'cashed_out',
        multiplier: data.multiplier ?? currentMultiplier,
        payout: data.payout ?? 0,
        netProfit: data.netProfit ?? 0,
      });
      setPhase('cashed_out');
      if (typeof data.newCoinsBalance === 'number') {
        onCoinsBalanceSync(data.newCoinsBalance);
      }
    } catch {
      setErrorMsg(isAr ? 'حدث خطأ في الاتصال بالخادم' : 'Network error connecting to server');
    } finally {
      setIsBusy(false);
    }
  };

  const isRoundFinished = phase === 'busted' || phase === 'cashed_out';

  return (
    <div
      className="flex-1 min-h-0 w-full max-w-2xl mx-auto px-2.5 sm:px-5 py-2 flex flex-col gap-2 overflow-hidden select-none animate-in fade-in duration-300"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Main Interactive Board Card — Fits fixed height between Top & Bottom bars */}
      <div className="flex-1 min-h-0 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 shadow-sm flex flex-col overflow-hidden">
        {/* Compact Board Header: Mines Count Selector + Gems Count */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2 border-b border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-950 p-0.5 rounded-xl border border-neutral-200/70 dark:border-neutral-800 shrink-0 overflow-x-auto no-scrollbar">
            <Bomb className="w-3.5 h-3.5 text-rose-500 mx-1 shrink-0" />
            {minesOptions.map((opt) => {
              const isSelected = minesCount === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={isRoundActive || isBusy}
                  onClick={() => {
                    setMinesCount(opt);
                    setErrorMsg(null);
                  }}
                  className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-black transition-colors cursor-pointer disabled:cursor-not-allowed ${
                    isSelected
                      ? 'bg-neutral-900 text-white dark:bg-amber-500 dark:text-neutral-950 shadow-xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white disabled:opacity-45'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          <span className="font-mono text-[11px] font-black text-emerald-600 dark:text-emerald-400 shrink-0 inline-flex items-center gap-1">
            <Gem className="w-3.5 h-3.5" />
            <span>{GRID_SIZE - minesCount}</span>
          </span>
        </div>

        {/* Live Telemetry / Round Status Strip */}
        <div className="shrink-0 px-3.5 py-1.5 bg-neutral-50/80 dark:bg-neutral-950/60 border-b border-neutral-100 dark:border-neutral-800/70 flex items-center justify-between gap-2 text-[11px] font-bold">
          {isRoundActive ? (
            <>
              <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 min-w-0">
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono font-black">
                  <Gem className="w-3.5 h-3.5" />
                  <span>{revealedSafe.length}/{GRID_SIZE - minesCount}</span>
                </span>
                <span className="text-neutral-300 dark:text-neutral-700">·</span>
                <span className="truncate font-mono">
                  {isAr ? 'الحالي:' : 'Current:'}{' '}
                  <strong className="text-neutral-900 dark:text-white">{currentMultiplier}x</strong>
                </span>
              </div>

              <div className="font-mono text-amber-600 dark:text-amber-400 shrink-0" dir="ltr">
                {isAr ? 'التالي:' : 'Next:'} <strong>{nextMultiplier}x</strong>
              </div>
            </>
          ) : lastSummary ? (
            <>
              <span
                className={`font-black truncate ${
                  lastSummary.outcome === 'busted'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {lastSummary.outcome === 'busted'
                  ? isAr
                    ? 'انفجر لغم! حظاً أوفر في الجولة القادمة'
                    : 'Mine hit! Try again'
                  : lastSummary.outcome === 'cleared'
                  ? isAr
                    ? `تصفية كاملة! (${lastSummary.multiplier}x)`
                    : `Board cleared! (${lastSummary.multiplier}x)`
                  : isAr
                  ? `تم سحب الأرباح بنجاح (${lastSummary.multiplier}x)`
                  : `Cashed out at ${lastSummary.multiplier}x`}
              </span>
              <span
                className={`font-mono font-black shrink-0 ${
                  lastSummary.netProfit >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
                dir="ltr"
              >
                {lastSummary.netProfit >= 0
                  ? `+${lastSummary.payout.toLocaleString()}`
                  : lastSummary.netProfit.toLocaleString()}{' '}
                Coins
              </span>
            </>
          ) : (
            <>
              <span className="text-neutral-500 dark:text-neutral-400 truncate">
                {isAr
                  ? `اختر عدد الألغام ومبلغ الرهان ثم اضغط ابدأ اللعب`
                  : `Pick mines & bet amount, then press Start Game`}
              </span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 shrink-0">
                {GRID_SIZE - minesCount} {isAr ? 'جواهر' : 'Gems'}
              </span>
            </>
          )}
        </div>

        {/* 5x5 Mines Grid — Centered & responsive to fit any viewport height cleanly */}
        <div className="flex-1 min-h-0 p-2.5 sm:p-4 flex items-center justify-center bg-neutral-50/40 dark:bg-neutral-950/40">
          <div className="h-full max-h-[340px] sm:max-h-[380px] aspect-square max-w-full grid grid-cols-5 grid-rows-5 gap-1.5 sm:gap-2">
            {Array.from({ length: GRID_SIZE }).map((_, idx) => {
              const isSafeRevealed = revealedSet.has(idx);
              const isMine = mineSet.has(idx);
              const isDetonated = detonatedTile === idx;
              const isLoadingTile = pendingTile === idx;
              const isUnclickedEndGem = isRoundFinished && !isSafeRevealed && !isMine;
              const isUnclickedEndMine = isRoundFinished && isMine && !isDetonated;

              const tileClickable = isRoundActive && !isSafeRevealed && pendingTile === null && !isBusy;

              let tileClass =
                'bg-white dark:bg-neutral-800/95 border-neutral-200/90 dark:border-neutral-700/80 shadow-[0_3px_0_0_rgba(0,0,0,0.08)] dark:shadow-[0_3px_0_0_rgba(0,0,0,0.45)]';
              if (tileClickable) {
                tileClass +=
                  ' hover:bg-neutral-100 dark:hover:bg-neutral-700/90 hover:border-emerald-500/45 active:translate-y-0.5 active:shadow-none cursor-pointer';
              } else if (phase === 'idle') {
                tileClass += ' opacity-85 cursor-default';
              } else {
                tileClass += ' cursor-default';
              }

              if (isSafeRevealed) {
                tileClass =
                  'bg-emerald-500/15 dark:bg-emerald-500/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shadow-inner cursor-default';
              } else if (isDetonated) {
                tileClass =
                  'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/35 cursor-default';
              } else if (isUnclickedEndMine) {
                tileClass =
                  'bg-rose-500/12 dark:bg-rose-500/15 border-rose-500/30 text-rose-500 dark:text-rose-400 opacity-80 cursor-default';
              } else if (isUnclickedEndGem) {
                tileClass =
                  'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20 text-emerald-500/55 dark:text-emerald-400/50 opacity-70 cursor-default';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!tileClickable}
                  onClick={() => handleTileClick(idx)}
                  aria-label={`Tile ${idx + 1}`}
                  className={`relative w-full h-full rounded-xl sm:rounded-2xl border flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${tileClass}`}
                >
                  {isLoadingTile ? (
                    <span className="w-4 h-4 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
                  ) : isSafeRevealed ? (
                    <Gem className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500 dark:text-emerald-400 animate-in zoom-in-75 duration-150 drop-shadow-xs" />
                  ) : isDetonated ? (
                    <Bomb className="w-5 h-5 sm:w-6 sm:h-6 text-white animate-in zoom-in-75 duration-150" />
                  ) : isUnclickedEndMine ? (
                    <Bomb className="w-4 h-4 sm:w-5 sm:h-5 opacity-85" />
                  ) : isUnclickedEndGem ? (
                    <Gem className="w-4 h-4 sm:w-5 sm:h-5 opacity-60" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-neutral-300/80 dark:bg-neutral-600/70" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Control Dock: Shared Rotatable Bet Wheel + Start / Cashout CTA */}
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
          disabled={isRoundActive || isBusy}
          lockedNotice={isRoundActive ? (isAr ? 'جولة قيد التشغيل' : 'Round active') : undefined}
          onOpenWallet={onOpenWallet}
        />

        {/* Inline Error Notice */}
        {errorMsg && (
          <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center justify-between gap-2">
            <span className="truncate">{errorMsg}</span>
            {coinsBalance < selectedBet && !isRoundActive && (
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

        {/* Bottom Action Row: Music Toggle + Start / Cashout CTA */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleMusic?.()}
            className={`h-11 px-2.5 rounded-2xl border text-[10px] font-black transition-all cursor-pointer shrink-0 flex flex-col items-center justify-center leading-tight ${
              musicEnabled
                ? 'bg-cyan-500/12 border-cyan-500/30 text-cyan-700 dark:text-cyan-300'
                : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400'
            }`}
            aria-label={musicEnabled ? (isAr ? 'إيقاف الموسيقى' : 'Music Off') : (isAr ? 'تشغيل الموسيقى' : 'Music On')}
            title={musicEnabled ? (isAr ? 'إيقاف الموسيقى' : 'Music Off') : (isAr ? 'تشغيل الموسيقى' : 'Music On')}
          >
            {musicEnabled ? <Music className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{isAr ? 'موسيقى' : 'Music'}</span>
          </button>

          {isRoundActive ? (
            <button
              type="button"
              onClick={handleCashOut}
              disabled={isBusy || revealedSafe.length < 1}
              className={`flex-1 h-11 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                revealedSafe.length >= 1
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-neutral-950 shadow-md shadow-emerald-500/25 cursor-pointer'
                  : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 cursor-not-allowed'
              }`}
            >
              <Coins className="w-4 h-4" />
              {revealedSafe.length >= 1 ? (
                <>
                  <span>
                    {isBusy
                      ? isAr
                        ? 'جاري السحب...'
                        : 'Cashing out...'
                      : isAr
                      ? 'سحب الأرباح'
                      : 'Cash Out'}
                  </span>
                  <span
                    className="font-mono text-xs px-2 py-0.5 rounded-lg bg-neutral-950/15 text-neutral-950 inline-flex items-center gap-1"
                    dir="ltr"
                  >
                    <span>{currentPayout.toLocaleString()}</span>
                    <CoinIcon className="w-3.5 h-3.5" />
                    <span>({currentMultiplier}x)</span>
                  </span>
                </>
              ) : (
                <span>{isAr ? 'اختر مربعاً آمناً للكشف' : 'Pick a safe tile to start'}</span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartGame}
              disabled={isBusy}
              className="flex-1 h-11 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-black text-sm shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isRoundFinished ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              <span>
                {isBusy
                  ? isAr
                    ? 'جاري البدء...'
                    : 'Starting...'
                  : isRoundFinished
                  ? isAr
                    ? 'جولة جديدة'
                    : 'Play Again'
                  : isAr
                  ? 'ابدأ اللعب'
                  : 'Start Game'}
              </span>
              <span
                className="font-mono text-xs px-2 py-0.5 rounded-lg bg-neutral-950/15 text-neutral-950 inline-flex items-center gap-1"
                dir="ltr"
              >
                <span>{selectedBet.toLocaleString()}</span>
                <CoinIcon className="w-3.5 h-3.5" />
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
