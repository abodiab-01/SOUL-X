import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PackageOpen, Volume2, VolumeX, Coins, Ban, Trophy } from 'lucide-react';
import { AuthUser, Language } from '../types';
import { CoinIcon } from './CurrencyIcons';
import { GameBetWheel } from './GameBetWheel';
import { getStoredAuthToken } from '../lib/authStorage';
import { GAME_BET_AMOUNTS } from '../lib/gamesConfig';

interface BoxesGameProps {
  lang: Language;
  currentUser: AuthUser | null;
  coinsBalance: number;
  betAmounts?: readonly number[];
  onCoinsBalanceSync: (nextBalance: number) => void;
  onOpenWallet: () => void;
}

type BoxesPhase = 'idle' | 'picking' | 'revealed';

interface RevealedBox {
  index: number;
  empty: boolean;
  multiplier: number;
}

interface BoxesHistoryItem {
  id: number;
  won: boolean;
  multiplier: number;
  payout: number;
  netProfit: number;
}

const BOXES_COUNT = 8;

const ClosedChestSvg: React.FC<{ active: boolean; isOpening?: boolean }> = ({
  active,
  isOpening,
}) => (
  <svg
    viewBox="0 0 64 64"
    className={`w-10 h-10 sm:w-13 sm:h-13 transition-transform duration-150 ${
      isOpening ? 'scale-110 -rotate-3' : active ? 'group-hover:scale-105' : ''
    }`}
    fill="none"
    aria-hidden="true"
  >
    <rect
      x="10"
      y="24"
      width="44"
      height="28"
      rx="5"
      fill={active ? '#1E293B' : '#334155'}
      stroke={active ? '#F59E0B' : '#64748B'}
      strokeWidth="2.5"
    />
    <path
      d="M10 24C10 16.5 16 12 32 12C48 12 54 16.5 54 24H10Z"
      fill={active ? '#293548' : '#3F4E63'}
      stroke={active ? '#FBBF24' : '#64748B'}
      strokeWidth="2.5"
    />
    <rect x="17" y="13" width="6" height="39" rx="1.5" fill={active ? '#D97706' : '#475569'} opacity="0.85" />
    <rect x="41" y="13" width="6" height="39" rx="1.5" fill={active ? '#D97706' : '#475569'} opacity="0.85" />
    <rect
      x="27"
      y="22"
      width="10"
      height="11"
      rx="3"
      fill={active ? '#FBBF24' : '#94A3B8'}
      stroke="#0F172A"
      strokeWidth="1.5"
    />
    <circle cx="32" cy="27.5" r="2" fill="#0F172A" />
  </svg>
);

const OpenPrizeChestSvg: React.FC<{ highlight: boolean }> = ({ highlight }) => (
  <svg viewBox="0 0 64 64" className="w-9 h-9 sm:w-11 sm:h-11" fill="none" aria-hidden="true">
    <path
      d="M11 22L15 11C16 9 20 8 32 8C44 8 48 9 49 11L53 22H11Z"
      fill="#293548"
      stroke="#FBBF24"
      strokeWidth="2.2"
    />
    <ellipse cx="32" cy="26" rx="15" ry="5" fill="#FDE68A" opacity={highlight ? '0.95' : '0.65'} />
    <circle cx="26" cy="25" r="4" fill="#F59E0B" stroke="#FEF3C7" strokeWidth="1.2" />
    <circle cx="33" cy="23" r="4.5" fill="#FBBF24" stroke="#FEF3C7" strokeWidth="1.2" />
    <circle cx="39" cy="26" r="4" fill="#F59E0B" stroke="#FEF3C7" strokeWidth="1.2" />
    <rect
      x="11"
      y="27"
      width="42"
      height="25"
      rx="5"
      fill="#1E293B"
      stroke={highlight ? '#10B981' : '#F59E0B'}
      strokeWidth="2.5"
    />
    <rect x="28" y="27" width="8" height="9" rx="2" fill="#FBBF24" />
  </svg>
);

const OpenEmptyChestSvg: React.FC = () => (
  <svg viewBox="0 0 64 64" className="w-9 h-9 sm:w-11 sm:h-11" fill="none" aria-hidden="true">
    <path
      d="M12 23L15 13C16 11 20 10 32 10C44 10 48 11 49 13L52 23H12Z"
      fill="#1E293B"
      stroke="#64748B"
      strokeWidth="2"
    />
    <ellipse cx="32" cy="27" rx="16" ry="4" fill="#0F172A" />
    <rect
      x="12"
      y="28"
      width="40"
      height="23"
      rx="5"
      fill="#334155"
      stroke="#64748B"
      strokeWidth="2"
    />
    <path d="M27 36L37 44M37 36L27 44" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const BoxesGame: React.FC<BoxesGameProps> = ({
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

  const [phase, setPhase] = useState<BoxesPhase>('idle');
  const [roundId, setRoundId] = useState<string | null>(null);
  const [activeBetAmount, setActiveBetAmount] = useState<number>(0);
  const [openingIndex, setOpeningIndex] = useState<number | null>(null);
  const [chosenBox, setChosenBox] = useState<RevealedBox | null>(null);
  const [lastOutcome, setLastOutcome] = useState<{
    won: boolean;
    multiplier: number;
    payout: number;
    netProfit: number;
    betAmount: number;
  } | null>(null);
  const [history, setHistory] = useState<BoxesHistoryItem[]>([]);

  const [isLoadingReq, setIsLoadingReq] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const nextHistoryIdRef = useRef<number>(1);
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

  const playBoxStart = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.08);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    } catch {}
  }, [getAudioCtx]);

  const playBoxResult = useCallback(
    (won: boolean, multiplier: number) => {
      const ctx = getAudioCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        if (won) {
          const notes =
            multiplier >= 15
              ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
              : multiplier >= 5
              ? [523.25, 659.25, 783.99, 1046.5]
              : [440, 554.37, 659.25];
          notes.forEach((f, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now + idx * 0.045);
            gain.gain.setValueAtTime(0.075, now + idx * 0.045);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.045 + 0.22);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.045);
            osc.stop(now + idx * 0.045 + 0.24);
          });
        } else {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(220, now);
          osc.frequency.exponentialRampToValueAtTime(115, now + 0.16);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.19);
        }
      } catch {}
    },
    [getAudioCtx]
  );

  // Sync config and resume any active unpicked round on mount
  useEffect(() => {
    const token = getStoredAuthToken();
    const qs = new URLSearchParams();
    if (currentUser?.id) qs.set('userId', currentUser.id);
    if (currentUser?.displayId) qs.set('displayId', currentUser.displayId);
    if (currentUser?.email) qs.set('email', currentUser.email);

    fetch(`/api/games/boxes/config?${qs.toString()}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.betAmounts) && data.betAmounts.length > 0) {
          setBetSteps(data.betAmounts);
        }
        if (data?.success && data.activeRound) {
          setRoundId(data.activeRound.roundId);
          setActiveBetAmount(data.activeRound.betAmount);
          setPhase('picking');
          setChosenBox(null);
          setLastOutcome(null);
          const idx = (data.betAmounts || GAME_BET_AMOUNTS).indexOf(data.activeRound.betAmount);
          if (idx >= 0) setSelectedBetIdx(idx);
        }
      })
      .catch(() => {});
  }, [currentUser?.id, currentUser?.displayId, currentUser?.email]);

  const selectedBet = betSteps[selectedBetIdx] ?? betSteps[0] ?? 500;

  const handleStartRound = async () => {
    if (isLoadingReq || phase === 'picking') return;
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

    setIsLoadingReq(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch('/api/games/boxes/start', {
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
      if (!data?.success) {
        setErrorMsg(data?.message || (isAr ? 'تعذر بدء الجولة' : 'Could not start round'));
        if (typeof data?.currentCoins === 'number') {
          onCoinsBalanceSync(data.currentCoins);
        }
        return;
      }

      playBoxStart();
      if (typeof data.newCoinsBalance === 'number') {
        onCoinsBalanceSync(data.newCoinsBalance);
      }
      setRoundId(data.roundId);
      setActiveBetAmount(data.betAmount ?? selectedBet);
      setChosenBox(null);
      setOpeningIndex(null);
      setLastOutcome(null);
      setPhase('picking');
    } catch {
      setErrorMsg(isAr ? 'حدث خطأ في الاتصال بالخادم' : 'Network error connecting to server');
    } finally {
      setIsLoadingReq(false);
    }
  };

  const handlePickBox = async (boxIndex: number) => {
    if (phase !== 'picking' || !roundId || isLoadingReq || openingIndex !== null) return;
    setErrorMsg(null);
    setOpeningIndex(boxIndex);
    setIsLoadingReq(true);

    try {
      const token = getStoredAuthToken();
      const res = await fetch('/api/games/boxes/pick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: currentUser?.id,
          displayId: currentUser?.displayId,
          email: currentUser?.email,
          roundId,
          boxIndex,
        }),
      });
      const data = await res.json();
      if (!data?.success) {
        setErrorMsg(data?.message || (isAr ? 'تعذر فتح الصندوق' : 'Could not open box'));
        setOpeningIndex(null);
        return;
      }

      const won = Boolean(data.won);
      const mult = typeof data.multiplier === 'number' ? data.multiplier : 0;
      const payout = typeof data.payout === 'number' ? data.payout : 0;
      const betAmt = typeof data.betAmount === 'number' ? data.betAmount : activeBetAmount;
      const netProfit = typeof data.netProfit === 'number' ? data.netProfit : payout - betAmt;

      playBoxResult(won, mult);
      if (typeof data.newCoinsBalance === 'number') {
        onCoinsBalanceSync(data.newCoinsBalance);
      }

      const resolvedBox: RevealedBox =
        data?.chosenBox && typeof data.chosenBox.index === 'number'
          ? data.chosenBox
          : {
              index: boxIndex,
              empty: !won,
              multiplier: mult,
            };

      setChosenBox(resolvedBox);
      setLastOutcome({
        won,
        multiplier: mult,
        payout,
        netProfit,
        betAmount: betAmt,
      });
      setHistory((prev) => [
        {
          id: nextHistoryIdRef.current++,
          won,
          multiplier: mult,
          payout,
          netProfit,
        },
        ...prev,
      ].slice(0, 8));
      setRoundId(null);
      setPhase('revealed');
    } catch {
      setErrorMsg(isAr ? 'حدث خطأ في الاتصال بالخادم' : 'Network error connecting to server');
    } finally {
      setOpeningIndex(null);
      setIsLoadingReq(false);
    }
  };

  return (
    <div
      className="flex-1 min-h-0 w-full max-w-2xl mx-auto px-2.5 sm:px-5 py-2 flex flex-col gap-2 overflow-hidden select-none animate-in fade-in duration-300"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Main Interactive Boxes Board Card */}
      <div className="flex-1 min-h-0 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 shadow-sm flex flex-col overflow-hidden">
        {/* Compact Board Header + Inline History */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2 border-b border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-x-auto no-scrollbar">
            <span className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white tracking-tight whitespace-nowrap shrink-0">
              {isAr ? 'صناديق الحظ' : 'Mystery Boxes'}
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
                {h.won ? `${h.multiplier}x` : isAr ? 'فارغ' : 'Empty'}
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

        {/* Status / Outcome Strip */}
        <div className="shrink-0 px-4 py-2 border-b border-neutral-100 dark:border-neutral-800/70 bg-neutral-50/70 dark:bg-neutral-950/40 flex items-center justify-between gap-2 text-xs">
          {phase === 'picking' ? (
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
              <PackageOpen className="w-4 h-4 shrink-0" />
              <span>
                {isAr
                  ? 'اختر صندوقاً واحداً من الصناديق الثمانية'
                  : 'Choose 1 of the 8 mystery boxes'}
              </span>
            </div>
          ) : phase === 'revealed' && lastOutcome ? (
            lastOutcome.won ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black">
                <Trophy className="w-4 h-4 shrink-0" />
                <span className="font-mono tabular-nums">
                  {isAr
                    ? `مضاعف ${lastOutcome.multiplier}x · ربحت +${lastOutcome.payout.toLocaleString()} Coins`
                    : `${lastOutcome.multiplier}x Multiplier · Won +${lastOutcome.payout.toLocaleString()} Coins`}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold">
                <Ban className="w-4 h-4 shrink-0" />
                <span className="font-mono tabular-nums">
                  {isAr
                    ? `الصندوق فارغ · -${lastOutcome.betAmount.toLocaleString()} Coins`
                    : `Box is Empty · -${lastOutcome.betAmount.toLocaleString()} Coins`}
                </span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 font-semibold truncate">
              <span>{isAr ? '8 صناديق' : '8 Boxes'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {isAr ? 'فارغ أو مضاعف 1x – 50x' : 'Empty or 1x – 50x'}
              </span>
            </div>
          )}

          <div
            className="text-[11px] font-mono tabular-nums font-bold text-neutral-500 dark:text-neutral-400 shrink-0"
            dir="ltr"
          >
            {phase === 'picking'
              ? `${activeBetAmount.toLocaleString()} Coins`
              : '1x – 50x'}
          </div>
        </div>

        {/* 8 Interactive Boxes Grid (2 Rows x 4 Columns) */}
        <div className="flex-1 min-h-0 p-3 sm:p-5 flex items-center justify-center bg-neutral-50/40 dark:bg-neutral-950/35">
          <div className="w-full max-w-lg grid grid-cols-4 gap-2 sm:gap-3">
            {Array.from({ length: BOXES_COUNT }, (_, idx) => {
              const isChosen = phase === 'revealed' && chosenBox?.index === idx;
              const boxData = isChosen ? chosenBox : null;
              const isInteractive = phase === 'picking' && !isLoadingReq;
              const isOpening = openingIndex === idx;

              let cardClasses =
                'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800';
              if (phase === 'idle') {
                cardClasses =
                  'bg-white dark:bg-neutral-900/80 border-neutral-200/80 dark:border-neutral-800/80 opacity-80';
              } else if (phase === 'picking') {
                cardClasses =
                  'bg-white dark:bg-neutral-900 border-amber-500/45 hover:border-amber-500 hover:-translate-y-0.5 shadow-sm hover:shadow-md cursor-pointer active:scale-95';
              } else if (phase === 'revealed') {
                if (boxData) {
                  cardClasses = !boxData.empty
                    ? 'bg-emerald-500/12 dark:bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/30 shadow-md'
                    : 'bg-rose-500/10 dark:bg-rose-500/15 border-rose-500/70 ring-2 ring-rose-500/20 shadow-sm';
                } else {
                  cardClasses =
                    'bg-neutral-100/60 dark:bg-neutral-900/50 border-neutral-200/80 dark:border-neutral-800/80 opacity-50';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!isInteractive}
                  onClick={() => handlePickBox(idx)}
                  aria-label={
                    boxData
                      ? boxData.empty
                        ? isAr
                          ? `صندوق ${idx + 1}: فارغ`
                          : `Box ${idx + 1}: Empty`
                        : isAr
                        ? `صندوق ${idx + 1}: مضاعف ${boxData.multiplier}x`
                        : `Box ${idx + 1}: ${boxData.multiplier}x`
                      : phase === 'revealed'
                      ? isAr
                        ? `صندوق ${idx + 1}: مغلق`
                        : `Box ${idx + 1}: Closed`
                      : isAr
                      ? `اختيار الصندوق ${idx + 1}`
                      : `Choose Box ${idx + 1}`
                  }
                  className={`group relative rounded-2xl border p-2 sm:p-3 min-h-[88px] sm:min-h-[118px] flex flex-col items-center justify-center gap-1 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${cardClasses} ${
                    !isInteractive && phase !== 'revealed' ? 'cursor-default' : ''
                  }`}
                >
                  {/* Box index number */}
                  <span className="absolute top-1.5 start-2 font-mono tabular-nums text-[10px] font-bold text-neutral-400 dark:text-neutral-500">
                    {idx + 1}
                  </span>

                  {boxData ? (
                    boxData.empty ? (
                      <>
                        <OpenEmptyChestSvg />
                        <span className="text-[11px] sm:text-xs font-bold text-rose-600 dark:text-rose-400">
                          {isAr ? 'فارغ' : 'Empty'}
                        </span>
                      </>
                    ) : (
                      <>
                        <OpenPrizeChestSvg highlight />
                        <span
                          className="font-mono tabular-nums text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400"
                          dir="ltr"
                        >
                          {boxData.multiplier}x
                        </span>
                      </>
                    )
                  ) : (
                    <>
                      <ClosedChestSvg active={phase === 'picking'} isOpening={isOpening} />
                      <span
                        className={`text-[10px] sm:text-[11px] font-bold ${
                          phase === 'picking'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-neutral-400 dark:text-neutral-500'
                        }`}
                      >
                        {isOpening
                          ? isAr
                            ? 'يفتح...'
                            : 'Opening...'
                          : phase === 'picking'
                          ? isAr
                            ? 'اختر'
                            : 'Open'
                          : isAr
                          ? 'مغلق'
                          : 'Locked'}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Control Dock: Shared Bet Wheel + Primary Action CTA */}
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
          disabled={phase === 'picking' || isLoadingReq}
          lockedNotice={
            phase === 'picking' ? (isAr ? 'الرهان مقفل' : 'Bet locked') : undefined
          }
          onOpenWallet={onOpenWallet}
        />

        {errorMsg && (
          <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center justify-between gap-2">
            <span className="truncate">{errorMsg}</span>
            {coinsBalance < selectedBet && phase !== 'picking' && (
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

        {phase === 'picking' ? (
          <div className="w-full h-11 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 whitespace-nowrap">
            <PackageOpen className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              {isLoadingReq
                ? isAr
                  ? 'جاري فتح الصندوق...'
                  : 'Opening box...'
                : isAr
                ? 'اضغط على أحد الصناديق الـ 8 لفتحه'
                : 'Tap 1 of the 8 boxes above to open'}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStartRound}
            disabled={isLoadingReq}
            className="w-full h-11 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-black text-sm shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <Coins className="w-4 h-4 shrink-0" />
            <span>
              {isLoadingReq
                ? isAr
                  ? 'جاري البدء...'
                  : 'Starting...'
                : phase === 'revealed'
                ? isAr
                  ? 'لعب مرة أخرى'
                  : 'Play Again'
                : isAr
                ? 'وضع الرهان وفتح الصناديق'
                : 'Place Bet & Show Boxes'}
            </span>
            <span
              className="font-mono tabular-nums text-xs px-2 py-0.5 rounded-lg bg-neutral-950/15 text-neutral-950 inline-flex items-center gap-1 shrink-0"
              dir="ltr"
            >
              <span>{selectedBet.toLocaleString()}</span>
              <CoinIcon className="w-3.5 h-3.5" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
