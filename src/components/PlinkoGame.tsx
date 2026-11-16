import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  Sparkles,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AuthUser, Language } from '../types';
import { CoinIcon } from './CurrencyIcons';
import { getStoredAuthToken } from '../lib/authStorage';
import { GAME_BET_AMOUNTS } from '../lib/gamesConfig';

interface PlinkoGameProps {
  lang: Language;
  currentUser: AuthUser | null;
  coinsBalance: number;
  betAmounts?: readonly number[];
  onCoinsBalanceSync: (nextBalance: number) => void;
  onOpenWallet: () => void;
}

const ROWS = 10;
const DEFAULT_MULTIPLIERS = [15, 5, 2, 1.2, 0.5, 0.2, 0.5, 1.2, 2, 5, 15];
const WHEEL_ITEM_WIDTH = 118;

interface ActiveBall {
  id: number;
  path: ('L' | 'R')[];
  targetSlot: number;
  multiplier: number;
  betAmount: number;
  payout: number;
  netProfit: number;
  serverBalanceAfter: number;
  startTime: number;
  durationMs: number;
  lastPegRow: number;
  settled: boolean;
  trail: { x: number; y: number }[];
}

interface PegFlash {
  key: string;
  x: number;
  y: number;
  startTime: number;
}

interface BucketImpact {
  slot: number;
  multiplier: number;
  payout: number;
  netProfit: number;
  startTime: number;
}

interface DropHistoryItem {
  id: number;
  multiplier: number;
  betAmount: number;
  payout: number;
  netProfit: number;
}

export const PlinkoGame: React.FC<PlinkoGameProps> = ({
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
  const betStepsRef = useRef<readonly number[]>(betSteps);

  const [multipliers, setMultipliers] = useState<number[]>(DEFAULT_MULTIPLIERS);
  const [selectedBetIdx, setSelectedBetIdx] = useState<number>(0); // Default 500 Coins
  const [wheelVisualIdx, setWheelVisualIdx] = useState<number>(0);

  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDroppingReq, setIsDroppingReq] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [history, setHistory] = useState<DropHistoryItem[]>([]);
  const [lastResult, setLastResult] = useState<DropHistoryItem | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wheelTrackRef = useRef<HTMLDivElement | null>(null);
  const activeBallsRef = useRef<ActiveBall[]>([]);
  const pegFlashesRef = useRef<PegFlash[]>([]);
  const bucketImpactsRef = useRef<BucketImpact[]>([]);
  const nextBallIdRef = useRef<number>(1);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const isMutedRef = useRef<boolean>(isMuted);

  // Wheel drag & snap refs
  const wheelVisualIdxRef = useRef<number>(0);
  const isDraggingWheelRef = useRef<boolean>(false);
  const capturedPointerIdRef = useRef<number | null>(null);
  const dragStartXRef = useRef<number>(0);
  const dragStartIdxRef = useRef<number>(0);
  const dragMovedRef = useRef<boolean>(false);
  const lastDragXRef = useRef<number>(0);
  const lastDragTimeRef = useRef<number>(0);
  const velocityIdxRef = useRef<number>(0);
  const snapRafRef = useRef<number>(0);
  const lastTickIdxRef = useRef<number>(0);

  // Track visual vs authoritative balance while balls are mid-flight
  const settledBalanceRef = useRef<number>(coinsBalance);
  const pendingReservedRef = useRef<number>(0);
  const latestServerBalanceRef = useRef<number>(coinsBalance);
  const coinsBalanceRef = useRef<number>(coinsBalance);
  const onCoinsBalanceSyncRef = useRef(onCoinsBalanceSync);

  useEffect(() => {
    onCoinsBalanceSyncRef.current = onCoinsBalanceSync;
  }, [onCoinsBalanceSync]);

  useEffect(() => {
    coinsBalanceRef.current = coinsBalance;
    if (activeBallsRef.current.length === 0) {
      settledBalanceRef.current = coinsBalance;
      latestServerBalanceRef.current = coinsBalance;
      pendingReservedRef.current = 0;
    }
  }, [coinsBalance]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Reconcile server balance if user navigates away mid-drop
  useEffect(() => {
    return () => {
      if (snapRafRef.current) cancelAnimationFrame(snapRafRef.current);
      if (activeBallsRef.current.length > 0) {
        onCoinsBalanceSyncRef.current(latestServerBalanceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const resolved = betAmounts && betAmounts.length > 0 ? betAmounts : GAME_BET_AMOUNTS;
    setBetSteps(resolved);
    betStepsRef.current = resolved;
  }, [betAmounts]);

  useEffect(() => {
    fetch('/api/games/plinko/config')
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.multipliers) && data.multipliers.length === ROWS + 1) {
          setMultipliers(data.multipliers);
        }
        if (data?.success && Array.isArray(data.betAmounts) && data.betAmounts.length > 0) {
          setBetSteps(data.betAmounts);
          betStepsRef.current = data.betAmounts;
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

  const playPegTick = useCallback(
    (row: number) => {
      const ctx = getAudioCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const baseFreq = 520 + row * 38;
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.35, now + 0.045);
        gain.gain.setValueAtTime(0.055, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
      } catch {}
    },
    [getAudioCtx]
  );

  const playBucketSound = useCallback(
    (multiplier: number) => {
      const ctx = getAudioCtx();
      if (!ctx) return;
      try {
        const now = ctx.currentTime;
        if (multiplier >= 2) {
          const freqs =
            multiplier >= 5 ? [523.25, 659.25, 783.99, 1046.5] : [440, 554.37, 659.25];
          freqs.forEach((f, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, now + idx * 0.05);
            gain.gain.setValueAtTime(0.08, now + idx * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.24);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + idx * 0.05);
            osc.stop(now + idx * 0.05 + 0.26);
          });
        } else if (multiplier >= 1) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, now);
          osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.12);
          gain.gain.setValueAtTime(0.07, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.2);
        } else {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(210, now);
          osc.frequency.exponentialRampToValueAtTime(125, now + 0.11);
          gain.gain.setValueAtTime(0.05, now);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.14);
        }
      } catch {}
    },
    [getAudioCtx]
  );

  // Smoothly animate rotary wheel to target index
  const animateWheelTo = useCallback(
    (targetIdx: number, initialVelocity = 0) => {
      if (snapRafRef.current) cancelAnimationFrame(snapRafRef.current);
      const maxIdx = Math.max(0, betStepsRef.current.length - 1);
      const clampedTarget = Math.max(0, Math.min(maxIdx, targetIdx));
      setSelectedBetIdx(clampedTarget);
      setErrorMsg(null);

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
    if (!isDraggingWheelRef.current) return;
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
      setSelectedBetIdx(rounded);
      setErrorMsg(null);
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

    if (!dragMovedRef.current) return;
    const maxIdx = Math.max(0, betStepsRef.current.length - 1);
    const projected = wheelVisualIdxRef.current + velocityIdxRef.current * 0.11;
    const target = Math.max(0, Math.min(maxIdx, Math.round(projected)));
    animateWheelTo(target, velocityIdxRef.current * 0.35);
  };

  useEffect(() => {
    const el = wheelTrackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(dir) < 2) return;
      const step = dir > 0 ? 1 : -1;
      animateWheelTo(Math.round(wheelVisualIdxRef.current) + step);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [animateWheelTo]);

  // Canvas animation & rendering loop — dynamically fits any container height between top & bottom bars
  useEffect(() => {
    let rafId = 0;

    const getBoardMetrics = (width: number, height: number) => {
      const effectiveW = Math.min(width, Math.max(300, height * 1.32));
      const offsetX = (width - effectiveW) / 2;
      const topPad = Math.max(24, height * 0.11);
      const bottomPad = Math.max(44, height * 0.175);
      const playableH = Math.max(110, height - topPad - bottomPad);
      const rowGap = playableH / ROWS;
      const maxCols = ROWS + 2;
      const horizontalMargin = effectiveW * 0.05;
      const spacingX = (effectiveW - horizontalMargin * 2) / maxCols;
      return { effectiveW, offsetX, topPad, bottomPad, rowGap, spacingX };
    };

    const getPegPosition = (row: number, col: number, width: number, height: number) => {
      const m = getBoardMetrics(width, height);
      const pegsInRow = row + 3;
      const rowWidth = (pegsInRow - 1) * m.spacingX;
      const startX = m.offsetX + (m.effectiveW - rowWidth) / 2;
      return {
        x: startX + col * m.spacingX,
        y: m.topPad + row * m.rowGap,
        spacingX: m.spacingX,
        rowGap: m.rowGap,
      };
    };

    const getSlotCenter = (slotIndex: number, width: number, height: number) => {
      const m = getBoardMetrics(width, height);
      const totalSlots = ROWS + 1;
      const rowWidth = (totalSlots - 1) * m.spacingX;
      const startX = m.offsetX + (m.effectiveW - rowWidth) / 2;
      const bucketH = Math.max(24, Math.min(34, height * 0.088));
      return {
        x: startX + slotIndex * m.spacingX,
        y: height - bucketH - Math.max(8, height * 0.032),
        slotW: m.spacingX * 0.88,
        bucketH,
      };
    };

    const renderFrame = (now: number) => {
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssW = canvas.clientWidth || 500;
        const cssH = canvas.clientHeight || 340;
        if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
          canvas.width = Math.round(cssW * dpr);
          canvas.height = Math.round(cssH * dpr);
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.save();
          ctx.scale(dpr, dpr);

          const isDark = document.documentElement.classList.contains('dark');
          ctx.clearRect(0, 0, cssW, cssH);

          // Radial ambient glow behind pyramid
          const bgGrad = ctx.createRadialGradient(
            cssW / 2,
            cssH * 0.44,
            10,
            cssW / 2,
            cssH * 0.48,
            Math.max(cssW, cssH) * 0.55
          );
          if (isDark) {
            bgGrad.addColorStop(0, 'rgba(6, 182, 212, 0.11)');
            bgGrad.addColorStop(0.6, 'rgba(15, 23, 42, 0.35)');
            bgGrad.addColorStop(1, 'rgba(10, 10, 14, 0)');
          } else {
            bgGrad.addColorStop(0, 'rgba(6, 182, 212, 0.09)');
            bgGrad.addColorStop(0.65, 'rgba(241, 245, 249, 0.4)');
            bgGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          }
          ctx.fillStyle = bgGrad;
          ctx.fillRect(0, 0, cssW, cssH);

          const m = getBoardMetrics(cssW, cssH);

          // Top drop funnel indicator
          const funnelY = Math.max(12, m.topPad * 0.44);
          ctx.beginPath();
          ctx.arc(cssW / 2, funnelY, Math.max(6, Math.min(9, cssH * 0.022)), 0, Math.PI * 2);
          ctx.fillStyle = isDark ? 'rgba(34, 211, 238, 0.22)' : 'rgba(6, 182, 212, 0.16)';
          ctx.fill();
          ctx.strokeStyle = isDark ? 'rgba(34, 211, 238, 0.6)' : 'rgba(8, 145, 178, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          pegFlashesRef.current = pegFlashesRef.current.filter((f) => now - f.startTime < 340);
          bucketImpactsRef.current = bucketImpactsRef.current.filter((b) => now - b.startTime < 520);

          // Draw pegs
          const pegRadius = Math.max(2.8, Math.min(4.8, m.spacingX * 0.14));
          for (let r = 0; r < ROWS; r++) {
            const pegsInRow = r + 3;
            for (let c = 0; c < pegsInRow; c++) {
              const pos = getPegPosition(r, c, cssW, cssH);
              const flash = pegFlashesRef.current.find((f) => f.key === `${r}-${c}`);
              if (flash) {
                const elapsed = (now - flash.startTime) / 340;
                const rippleR = pegRadius + elapsed * 12;
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, rippleR, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(251, 191, 36, ${Math.max(0, 0.75 * (1 - elapsed))})`;
                ctx.lineWidth = 2;
                ctx.stroke();
              }

              ctx.beginPath();
              ctx.arc(pos.x, pos.y, pegRadius, 0, Math.PI * 2);
              ctx.fillStyle = flash ? '#FBBF24' : isDark ? '#E2E8F0' : '#334155';
              ctx.fill();

              ctx.beginPath();
              ctx.arc(
                pos.x - pegRadius * 0.28,
                pos.y - pegRadius * 0.28,
                pegRadius * 0.32,
                0,
                Math.PI * 2
              );
              ctx.fillStyle = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.75)';
              ctx.fill();
            }
          }

          // Draw multiplier buckets along bottom
          for (let s = 0; s < multipliers.length; s++) {
            const mult = multipliers[s];
            const { x, y, slotW, bucketH } = getSlotCenter(s, cssW, cssH);
            const impact = bucketImpactsRef.current.find((b) => b.slot === s);
            const bounceOffset = impact
              ? Math.sin(((now - impact.startTime) / 520) * Math.PI) * 5
              : 0;

            const bx = x - slotW / 2;
            const by = y + bounceOffset;

            let bgCol = '#475569';
            let borderCol = '#64748B';
            const textCol = '#FFFFFF';
            if (mult >= 10) {
              bgCol = '#DC2626';
              borderCol = '#F87171';
            } else if (mult >= 5) {
              bgCol = '#EA580C';
              borderCol = '#FB923C';
            } else if (mult >= 2) {
              bgCol = '#D97706';
              borderCol = '#FBBF24';
            } else if (mult >= 1) {
              bgCol = '#059669';
              borderCol = '#34D399';
            } else if (mult >= 0.5) {
              bgCol = isDark ? '#334155' : '#64748B';
              borderCol = isDark ? '#475569' : '#94A3B8';
            } else {
              bgCol = isDark ? '#1E293B' : '#475569';
              borderCol = isDark ? '#334155' : '#64748B';
            }

            ctx.save();
            if (impact) {
              ctx.shadowColor = borderCol;
              ctx.shadowBlur = 14;
            }
            ctx.beginPath();
            ctx.roundRect(bx, by, slotW, bucketH, 6);
            ctx.fillStyle = bgCol;
            ctx.fill();
            ctx.lineWidth = impact ? 2 : 1;
            ctx.strokeStyle = borderCol;
            ctx.stroke();

            ctx.fillStyle = textCol;
            ctx.font = `800 ${slotW < 30 ? 8.5 : slotW < 36 ? 9.5 : 11}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${mult}x`, x, by + bucketH / 2 + 0.5);
            ctx.restore();
          }

          // Update and draw active balls
          const nextActive: ActiveBall[] = [];
          const ballRadius = Math.max(5.2, Math.min(8.5, m.spacingX * 0.25));

          for (const ball of activeBallsRef.current) {
            const elapsed = Math.max(0, now - ball.startTime);
            const totalSteps = ROWS + 1;
            const progress = Math.min(1, elapsed / ball.durationMs);

            const firstPeg = getPegPosition(0, 1, cssW, cssH);
            const waypoints: { x: number; y: number; pegKey?: string; row?: number }[] = [
              { x: firstPeg.x, y: funnelY },
            ];

            let rightSteps = 0;
            for (let r = 0; r < ROWS; r++) {
              const pegCol = 1 + rightSteps;
              const pegPos = getPegPosition(r, pegCol, cssW, cssH);
              waypoints.push({
                x: pegPos.x,
                y: pegPos.y - pegRadius - ballRadius * 0.85,
                pegKey: `${r}-${pegCol}`,
                row: r,
              });
              if (ball.path[r] === 'R') {
                rightSteps += 1;
              }
            }

            const finalBucket = getSlotCenter(ball.targetSlot, cssW, cssH);
            waypoints.push({ x: finalBucket.x, y: finalBucket.y + 4 });

            const exactIdx = progress * totalSteps;
            const segIdx = Math.min(totalSteps - 1, Math.floor(exactIdx));
            const t = exactIdx - segIdx;

            if (segIdx > ball.lastPegRow && segIdx <= ROWS) {
              const hitWaypoint = waypoints[segIdx];
              if (hitWaypoint?.pegKey) {
                pegFlashesRef.current.push({
                  key: hitWaypoint.pegKey,
                  x: hitWaypoint.x,
                  y: hitWaypoint.y + pegRadius + ballRadius * 0.85,
                  startTime: now,
                });
                playPegTick(hitWaypoint.row ?? segIdx);
              }
              ball.lastPegRow = segIdx;
            }

            const p0 = waypoints[segIdx];
            const p1 = waypoints[segIdx + 1];

            const arcHeight =
              segIdx === 0 ? 0 : Math.sin(t * Math.PI) * Math.min(10, m.rowGap * 0.45);
            const easeY =
              segIdx === 0 ? t * t : t < 0.3 ? t * 0.8 : 0.24 + ((t - 0.3) / 0.7) * 0.76;
            const curX = p0.x + (p1.x - p0.x) * t;
            const curY = p0.y + (p1.y - p0.y) * easeY - arcHeight;

            ball.trail.push({ x: curX, y: curY });
            if (ball.trail.length > 9) ball.trail.shift();

            for (let i = 0; i < ball.trail.length - 1; i++) {
              const alpha = ((i + 1) / ball.trail.length) * 0.35;
              const rTrail = ballRadius * ((i + 1) / ball.trail.length) * 0.85;
              ctx.beginPath();
              ctx.arc(ball.trail[i].x, ball.trail[i].y, rTrail, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(245, 158, 11, ${alpha})`;
              ctx.fill();
            }

            ctx.save();
            ctx.shadowColor = 'rgba(245, 158, 11, 0.75)';
            ctx.shadowBlur = 11;
            const ballGrad = ctx.createRadialGradient(
              curX - ballRadius * 0.3,
              curY - ballRadius * 0.3,
              ballRadius * 0.15,
              curX,
              curY,
              ballRadius
            );
            ballGrad.addColorStop(0, '#FEF3C7');
            ballGrad.addColorStop(0.45, '#FBBF24');
            ballGrad.addColorStop(1, '#D97706');
            ctx.beginPath();
            ctx.arc(curX, curY, ballRadius, 0, Math.PI * 2);
            ctx.fillStyle = ballGrad;
            ctx.fill();
            ctx.restore();

            if (progress >= 1 && !ball.settled) {
              ball.settled = true;
              bucketImpactsRef.current.push({
                slot: ball.targetSlot,
                multiplier: ball.multiplier,
                payout: ball.payout,
                netProfit: ball.netProfit,
                startTime: now,
              });
              playBucketSound(ball.multiplier);

              pendingReservedRef.current = Math.max(0, pendingReservedRef.current - ball.betAmount);
              settledBalanceRef.current = Math.max(
                0,
                settledBalanceRef.current + ball.payout - ball.betAmount
              );
              const remainingBalls = activeBallsRef.current.filter((b) => !b.settled).length;
              const finalVisibleBalance =
                remainingBalls === 0
                  ? ball.serverBalanceAfter
                  : Math.max(0, ball.serverBalanceAfter - pendingReservedRef.current);

              if (remainingBalls === 0) {
                settledBalanceRef.current = ball.serverBalanceAfter;
              }
              onCoinsBalanceSyncRef.current(finalVisibleBalance);

              const item: DropHistoryItem = {
                id: ball.id,
                multiplier: ball.multiplier,
                betAmount: ball.betAmount,
                payout: ball.payout,
                netProfit: ball.netProfit,
              };
              setLastResult(item);
              setHistory((prev) => [item, ...prev].slice(0, 8));
            } else {
              nextActive.push(ball);
            }
          }

          activeBallsRef.current = nextActive;
          ctx.restore();
        }
      }
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [multipliers, playBucketSound, playPegTick]);

  const selectedBet = betSteps[selectedBetIdx] ?? betSteps[0] ?? 500;

  const handleDropBall = async () => {
    setErrorMsg(null);
    if (!currentUser) {
      setErrorMsg(isAr ? 'يجب تسجيل الدخول أولاً للعب' : 'Please sign in first to play');
      return;
    }
    if (coinsBalanceRef.current < selectedBet) {
      setErrorMsg(
        isAr
          ? `رصيدك (${coinsBalanceRef.current.toLocaleString()}) أقل من مبلغ الرهان (${selectedBet.toLocaleString()})`
          : `Insufficient Coins (${coinsBalanceRef.current.toLocaleString()} < ${selectedBet.toLocaleString()})`
      );
      return;
    }
    if (activeBallsRef.current.length >= 12) {
      return;
    }

    setIsDroppingReq(true);
    try {
      const token = getStoredAuthToken();
      const res = await fetch('/api/games/plinko/play', {
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
        setErrorMsg(data?.message || (isAr ? 'تعذر بدء الجولة' : 'Could not drop ball'));
        if (typeof data?.currentCoins === 'number') {
          onCoinsBalanceSync(data.currentCoins);
        }
        return;
      }

      if (Array.isArray(data.multipliers) && data.multipliers.length === ROWS + 1) {
        setMultipliers(data.multipliers);
      }

      const path: ('L' | 'R')[] =
        Array.isArray(data.path) && data.path.length === ROWS
          ? data.path
          : Array.from({ length: ROWS }, () => (Math.random() < 0.5 ? 'L' : 'R'));

      pendingReservedRef.current += selectedBet;
      latestServerBalanceRef.current = data.newCoinsBalance;
      onCoinsBalanceSync(Math.max(0, coinsBalanceRef.current - selectedBet));

      activeBallsRef.current.push({
        id: nextBallIdRef.current++,
        path,
        targetSlot: typeof data.targetSlot === 'number' ? data.targetSlot : 5,
        multiplier: typeof data.multiplier === 'number' ? data.multiplier : 0,
        betAmount: data.betAmount ?? selectedBet,
        payout: data.payout ?? 0,
        netProfit: data.netProfit ?? -selectedBet,
        serverBalanceAfter: data.newCoinsBalance,
        startTime: performance.now(),
        durationMs: 2100,
        lastPegRow: -1,
        settled: false,
        trail: [],
      });
    } catch {
      setErrorMsg(isAr ? 'حدث خطأ في الاتصال بالخادم' : 'Network error connecting to server');
    } finally {
      setIsDroppingReq(false);
    }
  };

  return (
    <div
      className="flex-1 min-h-0 w-full max-w-2xl mx-auto px-2.5 sm:px-5 py-2 flex flex-col gap-2 overflow-hidden select-none animate-in fade-in duration-300"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Plinko Canvas Board — Fills remaining vertical space cleanly between Top & Bottom bars */}
      <div className="flex-1 min-h-0 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 shadow-sm flex flex-col overflow-hidden">
        {/* Compact Board Header + Inline History */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-2 border-b border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-x-auto no-scrollbar">
            <span className="text-xs sm:text-sm font-black text-neutral-900 dark:text-white tracking-tight shrink-0">
              Plinko
            </span>

            {lastResult && (
              <span
                className={`text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-lg border shrink-0 ${
                  lastResult.netProfit > 0
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                    : lastResult.netProfit === 0
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                }`}
              >
                {lastResult.multiplier}x (
                {lastResult.netProfit >= 0
                  ? `+${lastResult.netProfit.toLocaleString()}`
                  : lastResult.netProfit.toLocaleString()}
                )
              </span>
            )}

            {history.slice(1, 6).map((h) => (
              <span
                key={h.id}
                className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold shrink-0 border ${
                  h.multiplier >= 5
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                    : h.multiplier >= 2
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                    : h.multiplier >= 1
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                }`}
              >
                {h.multiplier}x
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

        {/* Flexible Responsive Canvas Container */}
        <div className="flex-1 min-h-0 w-full relative">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
      </div>

      {/* Fixed Bottom Control Dock: Rotatable Bet Wheel Strip + Drop Button (No custom input) */}
      <div className="shrink-0 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 px-3 py-2.5 shadow-sm space-y-2">
        {/* Clear Selected Bet Readout Header */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-300">
              {isAr ? 'مبلغ الرهان:' : 'Selected Bet:'}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-lg font-mono text-xs sm:text-sm font-black inline-flex items-center gap-1 border ${
                coinsBalance >= selectedBet
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/35'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/35'
              }`}
              dir="ltr"
            >
              <CoinIcon className="w-3.5 h-3.5" />
              <span>{selectedBet.toLocaleString()}</span>
            </span>
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
        <div className="relative flex items-center gap-1.5" dir="ltr">
          <button
            type="button"
            onClick={() => animateWheelTo(selectedBetIdx - 1)}
            disabled={selectedBetIdx <= 0}
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
            {/* Subtle Rim Tick Marks along bottom edge */}
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

            {/* Side Cylindrical Edge Fade Masks */}
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
                const isAffordable = coinsBalance >= amount;

                return (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => {
                      if (!dragMovedRef.current) {
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
            disabled={selectedBetIdx >= betSteps.length - 1}
            className="w-9 h-13 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center shrink-0 transition-colors disabled:opacity-35 cursor-pointer active:scale-95"
            aria-label="Increase bet"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Inline Error Notice */}
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

        {/* Primary Drop CTA */}
        <button
          type="button"
          onClick={handleDropBall}
          disabled={isDroppingReq}
          className="w-full h-11 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-black text-sm shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isDroppingReq ? (isAr ? 'جاري الإطلاق...' : 'Dropping...') : (isAr ? 'إسقاط الكرة' : 'Drop Ball')}</span>
          <span
            className="font-mono text-xs px-2 py-0.5 rounded-lg bg-neutral-950/15 text-neutral-950 inline-flex items-center gap-1"
            dir="ltr"
          >
            <span>{selectedBet.toLocaleString()}</span>
            <CoinIcon className="w-3.5 h-3.5" />
          </span>
        </button>
      </div>
    </div>
  );
};
