import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dices, Volume2, VolumeX, ArrowUp, ArrowDown } from 'lucide-react';
import { AuthUser, Language } from '../types';
import { CoinIcon } from './CurrencyIcons';
import { GameBetWheel } from './GameBetWheel';
import { getStoredAuthToken } from '../lib/authStorage';
import { GAME_BET_AMOUNTS } from '../lib/gamesConfig';

interface DiceGameProps {
  lang: Language;
  currentUser: AuthUser | null;
  coinsBalance: number;
  betAmounts?: readonly number[];
  onCoinsBalanceSync: (nextBalance: number) => void;
  onOpenWallet: () => void;
}

interface DiceRollHistoryItem {
  id: number;
  roll: number;
  won: boolean;
  multiplier: number;
  netProfit: number;
  payout: number;
}

export const DiceGame: React.FC<DiceGameProps> = ({
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

  const [mode, setMode] = useState<'over' | 'under'>('over');
  const [target, setTarget] = useState<number>(50);
  const [lastRoll, setLastRoll] = useState<DiceRollHistoryItem | null>(null);
  const [displayRollNum, setDisplayRollNum] = useState<number | null>(null);
  const [history, setHistory] = useState<DiceRollHistoryItem[]>([]);

  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const nextHistoryIdRef = useRef<number>(1);
  const rollAnimRafRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isMutedRef = useRef<boolean>(isMuted);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    if (betAmounts && betAmounts.length > 0) {
      setBetSteps(betAmounts);
    }
  }, [betAmounts]);

  useEffect(() => {
    fetch('/api/games/dice/config')
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.betAmounts) && data.betAmounts.length > 0) {
          setBetSteps(data.betAmounts);
        }
      })
      .catch(() => {});

    return () => {
      if (rollAnimRafRef.current) cancelAnimationFrame(rollAnimRafRef.current);
    };
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

  const playRollSound = useCallback(
    (won: boolean) => {
      const ctx = getAudioCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        if (won) {
          [523.25, 659.25, 880].forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.045);
            gain.gain.setValueAtTime(0.07, now + idx * 0.045);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.045 + 0.19);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.045);
            osc.stop(now + idx * 0.045 + 0.21);
          });
        } else {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(240, now);
          osc.frequency.exponentialRampToValueAtTime(135, now + 0.14);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.18);
        }
      } catch {}
    },
    [getAudioCtx]
  );

  const selectedBet = betSteps[selectedBetIdx] ?? betSteps[0] ?? 500;
  const winChance = mode === 'over' ? 100 - target : target;
  const multiplier = Math.max(1.01, Math.round((97 / winChance) * 100) / 100);
  const potentialPayout = Math.round(selectedBet * multiplier);

  const animateRollNumber = (finalRoll: number) => {
    if (rollAnimRafRef.current) cancelAnimationFrame(rollAnimRafRef.current);
    const startVal = displayRollNum ?? 50;
    const startTime = performance.now();
    const duration = 220;

    const tick = (now: number) => {
      const p = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = startVal + (finalRoll - startVal) * eased;
      setDisplayRollNum(Math.round(current * 100) / 100);
      if (p < 1) {
        rollAnimRafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayRollNum(finalRoll);
        rollAnimRafRef.current = 0;
      }
    };
    rollAnimRafRef.current = requestAnimationFrame(tick);
  };

  const handleRollDice = async () => {
    if (isRolling) return;
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

    setIsRolling(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch('/api/games/dice/play', {
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
          mode,
          target,
        }),
      });
      const data = await res.json();
      if (!data?.success) {
        setErrorMsg(data?.message || (isAr ? 'تعذر تنفيذ الرمية' : 'Could not roll dice'));
        if (typeof data?.currentCoins === 'number') {
          onCoinsBalanceSync(data.currentCoins);
        }
        return;
      }

      const rollVal = typeof data.roll === 'number' ? data.roll : 50;
      const won = Boolean(data.won);
      playRollSound(won);
      animateRollNumber(rollVal);

      if (typeof data.newCoinsBalance === 'number') {
        onCoinsBalanceSync(data.newCoinsBalance);
      }

      const item: DiceRollHistoryItem = {
        id: nextHistoryIdRef.current++,
        roll: rollVal,
        won,
        multiplier: data.multiplier ?? multiplier,
        payout: data.payout ?? 0,
        netProfit: data.netProfit ?? -selectedBet,
      };
      setLastRoll(item);
      setHistory((prev) => [item, ...prev].slice(0, 8));
    } catch {
      setErrorMsg(isAr ? 'حدث خطأ في الاتصال بالخادم' : 'Network error connecting to server');
    } finally {
      setIsRolling(false);
    }
  };

  return (
    <div
      className="flex-1 min-h-0 w-full max-w-2xl mx-auto px-2.5 sm:px-5 py-2 flex flex-col gap-2 overflow-hidden select-none animate-in fade-in duration-300"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Main Interactive Dice Board Card — Fits fixed height between Top & Bottom bars */}
      <div className="flex-1 min-h-0 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 shadow-sm flex flex-col overflow-hidden">
        {/* Compact Board Header + Inline History */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2 border-b border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto no-scrollbar">
            <span className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white tracking-tight shrink-0">
              Dice
            </span>

            {history.slice(0, 6).map((h) => (
              <span
                key={h.id}
                className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-black shrink-0 border ${
                  h.won
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                }`}
                dir="ltr"
              >
                {h.roll.toFixed(2)}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsMuted((m) => !m)}
            className="p-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors cursor-pointer shrink-0"
            title={isMuted ? (isAr ? 'تشغيل الصوت' : 'Unmute') : (isAr ? 'كتم الصوت' : 'Mute')}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-cyan-500" />}
          </button>
        </div>

        {/* Center Roll Display & Target Track */}
        <div className="flex-1 min-h-0 px-4 sm:px-6 py-3 flex flex-col justify-between gap-3 bg-neutral-50/40 dark:bg-neutral-950/35">
          {/* Rolled Result Readout */}
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-1.5">
            <div
              className={`px-6 py-3 rounded-2xl border font-mono text-3xl sm:text-4xl font-black tracking-tight transition-colors ${
                lastRoll === null
                  ? 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500'
                  : lastRoll.won
                  ? 'bg-emerald-500/12 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
              }`}
              dir="ltr"
            >
              {displayRollNum !== null ? displayRollNum.toFixed(2) : '00.00'}
            </div>

            <div className="text-xs font-bold h-4 flex items-center justify-center">
              {lastRoll ? (
                <span
                  className={
                    lastRoll.won
                      ? 'text-emerald-600 dark:text-emerald-400 font-black'
                      : 'text-rose-500 dark:text-rose-400 font-bold'
                  }
                >
                  {lastRoll.won
                    ? isAr
                      ? `فزت +${lastRoll.payout.toLocaleString()} Coins (${lastRoll.multiplier}x)`
                      : `Won +${lastRoll.payout.toLocaleString()} Coins (${lastRoll.multiplier}x)`
                    : isAr
                    ? `خسرت ${Math.abs(lastRoll.netProfit).toLocaleString()} Coins`
                    : `Lost ${Math.abs(lastRoll.netProfit).toLocaleString()} Coins`}
                </span>
              ) : (
                <span className="text-neutral-500 dark:text-neutral-400">
                  {isAr ? 'حدّد الرقم المستهدف واضغط رمي النرد' : 'Set target and press Roll Dice'}
                </span>
              )}
            </div>
          </div>

          {/* Interactive Target Slider + Visual Win/Loss Zones */}
          <div className="shrink-0 space-y-2.5" dir="ltr">
            <div className="relative pt-5 pb-1">
              {/* Floating Target Tooltip */}
              <div
                className="absolute top-0 -translate-x-1/2 px-2 py-0.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-mono text-[11px] font-black shadow-xs pointer-events-none"
                style={{ left: `${target}%` }}
              >
                {target}
              </div>

              {/* Dual-Tone Track Background */}
              <div className="relative h-4 rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800 border border-neutral-300/70 dark:border-neutral-700/80">
                {mode === 'over' ? (
                  <>
                    <div
                      className="absolute inset-y-0 left-0 bg-rose-500/75 transition-all duration-100"
                      style={{ width: `${target}%` }}
                    />
                    <div
                      className="absolute inset-y-0 right-0 bg-emerald-500/85 transition-all duration-100"
                      style={{ width: `${100 - target}%` }}
                    />
                  </>
                ) : (
                  <>
                    <div
                      className="absolute inset-y-0 left-0 bg-emerald-500/85 transition-all duration-100"
                      style={{ width: `${target}%` }}
                    />
                    <div
                      className="absolute inset-y-0 right-0 bg-rose-500/75 transition-all duration-100"
                      style={{ width: `${100 - target}%` }}
                    />
                  </>
                )}

                {/* Result Pin Marker */}
                {displayRollNum !== null && (
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-5 rounded-sm border-2 transition-all duration-150 ${
                      lastRoll?.won
                        ? 'bg-white border-emerald-600 shadow-md'
                        : 'bg-white border-rose-600 shadow-md'
                    }`}
                    style={{ left: `${Math.max(1, Math.min(99, displayRollNum))}%` }}
                  />
                )}
              </div>

              {/* Transparent Full-Range Input Over Track */}
              <input
                type="range"
                min={2}
                max={98}
                step={1}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                disabled={isRolling}
                aria-label="Target Roll Value"
                className="absolute inset-x-0 bottom-0 h-6 w-full opacity-0 cursor-pointer z-20"
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-neutral-400 px-0.5">
              <span>0</span>
              <span>25</span>
              <span>50</span>
              <span>75</span>
              <span>100</span>
            </div>
          </div>

          {/* Mode & Live Odds Strip */}
          <div className="shrink-0 grid grid-cols-3 gap-2">
            {/* Roll Over / Under Toggle */}
            <button
              type="button"
              disabled={isRolling}
              onClick={() => setMode((m) => (m === 'over' ? 'under' : 'over'))}
              className="p-2 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-cyan-500/50 text-start transition-colors cursor-pointer active:scale-[0.98]"
            >
              <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 block">
                {mode === 'over'
                  ? isAr
                    ? 'أعلى من'
                    : 'Roll Over'
                  : isAr
                  ? 'أقل من'
                  : 'Roll Under'}
              </span>
              <span className="font-mono text-sm font-black text-neutral-900 dark:text-white inline-flex items-center gap-1 mt-0.5">
                {mode === 'over' ? (
                  <ArrowUp className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5 text-cyan-500" />
                )}
                <span>{target}</span>
              </span>
            </button>

            {/* Multiplier */}
            <div className="p-2 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 block">
                {isAr ? 'المضاعف' : 'Multiplier'}
              </span>
              <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400 block mt-0.5" dir="ltr">
                {multiplier}x
              </span>
            </div>

            {/* Win Chance */}
            <div className="p-2 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <span className="text-[10px] font-bold text-neutral-500 dark:text-neutral-400 block">
                {isAr ? 'نسبة الفوز' : 'Win Chance'}
              </span>
              <span className="font-mono text-sm font-black text-emerald-600 dark:text-emerald-400 block mt-0.5" dir="ltr">
                {winChance}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Control Dock: Shared Bet Wheel + Roll CTA */}
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
          disabled={isRolling}
          onOpenWallet={onOpenWallet}
        />

        {errorMsg && (
          <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center justify-between gap-2">
            <span className="truncate">{errorMsg}</span>
            {coinsBalance < selectedBet && (
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
          onClick={handleRollDice}
          disabled={isRolling}
          className="w-full h-11 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-black text-sm shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Dices className="w-4 h-4" />
          <span>{isRolling ? (isAr ? 'جاري الرمي...' : 'Rolling...') : (isAr ? 'رمي النرد' : 'Roll Dice')}</span>
          <span
            className="font-mono text-xs px-2 py-0.5 rounded-lg bg-neutral-950/15 text-neutral-950 inline-flex items-center gap-1"
            dir="ltr"
          >
            <span>→ {potentialPayout.toLocaleString()}</span>
            <CoinIcon className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>
    </div>
  );
};
