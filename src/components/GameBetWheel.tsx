import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Wallet, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { Language } from '../types';
import { CoinIcon } from './CurrencyIcons';
import { GAME_BET_AMOUNTS } from '../lib/gamesConfig';

const WHEEL_ITEM_WIDTH = 118;

interface GameBetWheelProps {
  lang: Language;
  betAmounts?: readonly number[];
  selectedBetIdx: number;
  onSelectBetIdx: (idx: number) => void;
  coinsBalance: number;
  isMuted?: boolean;
  disabled?: boolean;
  lockedNotice?: string;
  onOpenWallet: () => void;
}

export const GameBetWheel: React.FC<GameBetWheelProps> = ({
  lang,
  betAmounts,
  selectedBetIdx,
  onSelectBetIdx,
  coinsBalance,
  isMuted = false,
  disabled = false,
  lockedNotice,
  onOpenWallet,
}) => {
  const isAr = lang === 'ar';
  const betSteps = betAmounts && betAmounts.length > 0 ? betAmounts : GAME_BET_AMOUNTS;
  const betStepsRef = useRef<readonly number[]>(betSteps);
  const onSelectBetIdxRef = useRef(onSelectBetIdx);
  const isMutedRef = useRef(isMuted);
  const disabledRef = useRef(disabled);

  const [wheelVisualIdx, setWheelVisualIdx] = useState<number>(selectedBetIdx);
  const wheelTrackRef = useRef<HTMLDivElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const wheelVisualIdxRef = useRef<number>(selectedBetIdx);
  const isDraggingWheelRef = useRef<boolean>(false);
  const capturedPointerIdRef = useRef<number | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartIdxRef = useRef<number>(0);
  const dragMovedRef = useRef<boolean>(false);
  const lastDragXRef = useRef<number>(0);
  const lastDragTimeRef = useRef<number>(0);
  const velocityIdxRef = useRef<number>(0);
  const snapRafRef = useRef<number>(0);
  const lastTickIdxRef = useRef<number>(selectedBetIdx);

  useEffect(() => {
    betStepsRef.current = betSteps;
  }, [betSteps]);

  useEffect(() => {
    onSelectBetIdxRef.current = onSelectBetIdx;
  }, [onSelectBetIdx]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    if (!isDraggingWheelRef.current && Math.abs(wheelVisualIdxRef.current - selectedBetIdx) > 0.05 && !snapRafRef.current) {
      wheelVisualIdxRef.current = selectedBetIdx;
      setWheelVisualIdx(selectedBetIdx);
    }
  }, [selectedBetIdx]);

  useEffect(() => {
    return () => {
      if (snapRafRef.current) cancelAnimationFrame(snapRafRef.current);
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

  const playWheelTick = useCallback(() => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.02);
      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch {}
  }, [getAudioCtx]);

  const animateWheelTo = useCallback(
    (targetIdx: number, initialVelocity = 0) => {
      if (disabledRef.current) return;
      if (snapRafRef.current) cancelAnimationFrame(snapRafRef.current);
      const maxIdx = Math.max(0, betStepsRef.current.length - 1);
      const clampedTarget = Math.max(0, Math.min(maxIdx, targetIdx));
      onSelectBetIdxRef.current(clampedTarget);

      let pos = wheelVisualIdxRef.current;
      let vel = initialVelocity;
      let lastTime = performance.now();

      const step = (now: number) => {
        const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        const force = (clampedTarget - pos) * 160;
        vel = (vel + force * dt) * Math.exp(-16 * dt);
        pos += vel * dt;

        const rounded = Math.round(pos);
        if (rounded !== lastTickIdxRef.current && rounded >= 0 && rounded < betStepsRef.current.length) {
          lastTickIdxRef.current = rounded;
          playWheelTick();
        }

        wheelVisualIdxRef.current = pos;
        setWheelVisualIdx(pos);

        if (Math.abs(clampedTarget - pos) < 0.003 && Math.abs(vel) < 0.02) {
          wheelVisualIdxRef.current = clampedTarget;
          setWheelVisualIdx(clampedTarget);
          snapRafRef.current = 0;
          return;
        }
        snapRafRef.current = requestAnimationFrame(step);
      };
      snapRafRef.current = requestAnimationFrame(step);
    },
    [playWheelTick]
  );

  const handleWheelPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabledRef.current) return;
    if (snapRafRef.current) {
      cancelAnimationFrame(snapRafRef.current);
      snapRafRef.current = 0;
    }
    isDraggingWheelRef.current = true;
    capturedPointerIdRef.current = null;
    dragStartXRef.current = e.clientX;
    dragStartIdxRef.current = wheelVisualIdxRef.current;
    dragMovedRef.current = false;
    lastDragXRef.current = e.clientX;
    lastDragTimeRef.current = performance.now();
    velocityIdxRef.current = 0;
  };

  const handleWheelPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingWheelRef.current || disabledRef.current) return;
    const dx = e.clientX - dragStartXRef.current;
    if (Math.abs(dx) > 4) {
      if (!dragMovedRef.current) {
        dragMovedRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
          capturedPointerIdRef.current = e.pointerId;
        } catch {}
      }
    } else {
      return;
    }

    const maxIdx = Math.max(0, betStepsRef.current.length - 1);
    const rawIdx = dragStartIdxRef.current - dx / WHEEL_ITEM_WIDTH;
    let nextIdx = rawIdx;
    if (rawIdx < 0) nextIdx = rawIdx * 0.25;
    else if (rawIdx > maxIdx) {
      nextIdx = maxIdx + (rawIdx - maxIdx) * 0.25;
    }

    const now = performance.now();
    const dt = Math.max(0.005, (now - lastDragTimeRef.current) / 1000);
    const stepDx = e.clientX - lastDragXRef.current;
    velocityIdxRef.current = -stepDx / WHEEL_ITEM_WIDTH / dt;
    lastDragXRef.current = e.clientX;
    lastDragTimeRef.current = now;

    const rounded = Math.max(0, Math.min(maxIdx, Math.round(nextIdx)));
    if (rounded !== lastTickIdxRef.current) {
      lastTickIdxRef.current = rounded;
      playWheelTick();
      onSelectBetIdxRef.current(rounded);
    }

    wheelVisualIdxRef.current = nextIdx;
    setWheelVisualIdx(nextIdx);
  };

  const handleWheelPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingWheelRef.current) return;
    isDraggingWheelRef.current = false;
    if (capturedPointerIdRef.current !== null) {
      try {
        e.currentTarget.releasePointerCapture(capturedPointerIdRef.current);
      } catch {}
      capturedPointerIdRef.current = null;
    }

    if (!dragMovedRef.current || disabledRef.current) return;
    const maxIdx = Math.max(0, betStepsRef.current.length - 1);
    const projected = wheelVisualIdxRef.current + velocityIdxRef.current * 0.11;
    const target = Math.max(0, Math.min(maxIdx, Math.round(projected)));
    animateWheelTo(target, velocityIdxRef.current * 0.35);
  };

  useEffect(() => {
    const el = wheelTrackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (disabledRef.current) return;
      e.preventDefault();
      const dir = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(dir) < 2) return;
      const step = dir > 0 ? 1 : -1;
      animateWheelTo(Math.round(wheelVisualIdxRef.current) + step);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [animateWheelTo]);

  const selectedBet = betSteps[selectedBetIdx] ?? betSteps[0] ?? 500;

  return (
    <div className="space-y-2">
      {/* Selected Bet Readout Header */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
            {isAr ? 'مبلغ الرهان:' : 'Selected Bet:'}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-lg font-mono text-xs sm:text-sm font-black inline-flex items-center gap-1 border shrink-0 ${
              coinsBalance >= selectedBet || disabled
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35'
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/35'
            }`}
            dir="ltr"
          >
            <CoinIcon className="w-3.5 h-3.5" />
            <span>{selectedBet.toLocaleString()}</span>
          </span>
          {disabled && lockedNotice && (
            <span className="text-[11px] font-bold text-neutral-400 dark:text-neutral-500 inline-flex items-center gap-1 truncate">
              <Lock className="w-3 h-3 shrink-0" />
              <span className="truncate">{lockedNotice}</span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenWallet}
          className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>{isAr ? 'شحن Coins' : 'Top up'}</span>
        </button>
      </div>

      {/* High-Contrast Rotatable Horizontal Bet Wheel Strip */}
      <div
        className={`relative flex items-center gap-1.5 transition-opacity ${
          disabled ? 'opacity-55 pointer-events-none' : ''
        }`}
        dir="ltr"
      >
        <button
          type="button"
          onClick={() => animateWheelTo(selectedBetIdx - 1)}
          disabled={disabled || selectedBetIdx <= 0}
          className="w-9 h-13 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center shrink-0 transition-colors disabled:opacity-35 cursor-pointer active:scale-95"
          aria-label="Decrease bet"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Cylindrical Rotary Track */}
        <div
          ref={wheelTrackRef}
          onPointerDown={handleWheelPointerDown}
          onPointerMove={handleWheelPointerMove}
          onPointerUp={handleWheelPointerUp}
          onPointerCancel={handleWheelPointerUp}
          className="relative flex-1 h-13 rounded-2xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 overflow-hidden cursor-grab active:cursor-grabbing touch-none"
        >
          {/* Subtle Rim Tick Marks */}
          <div className="absolute inset-x-0 bottom-0 h-1.5 flex items-end justify-between px-3 opacity-35 pointer-events-none">
            {Array.from({ length: 29 }).map((_, idx) => (
              <span
                key={idx}
                className={`w-px bg-neutral-400 dark:bg-neutral-600 ${
                  idx % 4 === 0 ? 'h-1.5' : 'h-0.5'
                }`}
              />
            ))}
          </div>

          {/* Top Center Triangle Indicator */}
          <div className="absolute left-1/2 top-0.5 -translate-x-1/2 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-amber-500 pointer-events-none z-30" />

          {/* Side Edge Fade Masks */}
          <div className="absolute inset-y-0 left-0 w-7 bg-gradient-to-r from-neutral-100 to-transparent dark:from-neutral-950 pointer-events-none z-20" />
          <div className="absolute inset-y-0 right-0 w-7 bg-gradient-to-l from-neutral-100 to-transparent dark:from-neutral-950 pointer-events-none z-20" />

          {/* 3D Perspective Rotating Value Items */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ perspective: '520px' }}
          >
            {betSteps.map((amount, idx) => {
              const delta = idx - wheelVisualIdx;
              if (Math.abs(delta) > 3.2) return null;

              const tx = delta * WHEEL_ITEM_WIDTH;
              const rotateY = Math.max(-46, Math.min(46, delta * 15));
              const scale = Math.max(0.78, 1 - Math.abs(delta) * 0.11);
              const opacity = Math.max(0.32, 1 - Math.abs(delta) * 0.28);
              const isCenter = Math.abs(delta) < 0.45;
              const isAffordable = coinsBalance >= amount || disabled;

              return (
                <button
                  key={amount}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (!dragMovedRef.current && !disabled) {
                      animateWheelTo(idx);
                    }
                  }}
                  style={{
                    transform: `translate3d(${tx}px, 0, 0) rotateY(${rotateY}deg) scale(${scale})`,
                    opacity: isCenter ? 1 : opacity,
                  }}
                  className={`absolute w-[110px] h-10 px-2 flex items-center justify-center gap-1 font-mono whitespace-nowrap rounded-xl cursor-pointer transition-colors ${
                    isCenter
                      ? isAffordable
                        ? 'z-30 bg-amber-500 text-neutral-950 font-black text-xs sm:text-sm shadow-md shadow-amber-500/25 ring-2 ring-amber-300 dark:ring-amber-400'
                        : 'z-30 bg-rose-500 text-white font-black text-xs sm:text-sm shadow-md shadow-rose-500/25 ring-2 ring-rose-300'
                      : 'z-10 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {isCenter && <CoinIcon className="w-3.5 h-3.5 shrink-0" />}
                  <span>{amount.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => animateWheelTo(selectedBetIdx + 1)}
          disabled={disabled || selectedBetIdx >= betSteps.length - 1}
          className="w-9 h-13 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center shrink-0 transition-colors disabled:opacity-35 cursor-pointer active:scale-95"
          aria-label="Increase bet"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
