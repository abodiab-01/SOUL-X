import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Gamepad2,
  Link2,
  RefreshCw,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { Language } from '../types';

export type GameAlgorithmMode =
  | 'smart_cycle'
  | 'custom_sequence'
  | 'house_edge'
  | 'classic_level';

export type CycleOrderPattern = 'smart_shuffle' | 'win_first' | 'loss_first';

export interface SmartAlgorithmSettings {
  algorithmMode: GameAlgorithmMode;
  targetWinRatePercent: number;
  maxAllowedMultiplier: number;
  smallWinBiasPercent: number;
  cycleWinsCount: number;
  cycleLossesCount: number;
  cycleOrderPattern: CycleOrderPattern;
  maxConsecutiveWins: number;
  highBetThreshold: number;
  highBetLossBoostPercent: number;
  sessionProfitCapCoins: number;
  lossRecoveryIntensity: number;
}

export interface RecentGameOutcomeLog {
  game: string;
  betAmount: number;
  payout: number;
  multiplier: number;
  won: boolean;
  reason: string;
  timestamp: string;
}

export interface GamesAlgorithmTelemetry {
  totalRounds: number;
  totalWins: number;
  totalLosses: number;
  totalWageredCoins: number;
  totalPayoutCoins: number;
  houseNetProfitCoins: number;
  recentOutcomes: RecentGameOutcomeLog[];
  updatedAt: string;
}

export interface ConnectedGameMeta {
  id: string;
  nameAr: string;
  nameEn: string;
}

interface AdminGamesAlgorithmControlProps {
  lang: Language;
  getAdminHeaders: () => Record<string, string>;
  showToast: (type: 'success' | 'error', message: string) => void;
  externalRefreshSignal?: number;
}

const FALLBACK_CONNECTED_GAMES: ConnectedGameMeta[] = [
  { id: 'golden-tree', nameAr: 'Golden Tree', nameEn: 'Golden Tree' },
  { id: 'winter-slots', nameAr: 'Winter Slots', nameEn: 'Winter Slots' },
  { id: 'boxes', nameAr: 'صناديق الحظ', nameEn: 'Mystery Boxes' },
  { id: 'olympus', nameAr: 'Olympus Gates', nameEn: 'Olympus Gates' },
  { id: 'plinko', nameAr: 'Plinko', nameEn: 'Plinko' },
  { id: 'mines', nameAr: 'Mines', nameEn: 'Mines' },
  { id: 'dice', nameAr: 'Dice', nameEn: 'Dice' },
];

interface SimplePreset {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  profitLevel: number;
  targetWinRatePercent: number;
  maxAllowedMultiplier: number;
}

const SIMPLE_PRESETS: SimplePreset[] = [
  {
    id: 'high_house_drain',
    titleAr: 'استنزاف عالٍ للمنصة',
    titleEn: 'High House Edge',
    descAr: 'مستوى 1 · فوز 12% · حد 2x',
    descEn: 'Level 1 · 12% Win · 2x Cap',
    profitLevel: 1,
    targetWinRatePercent: 12,
    maxAllowedMultiplier: 2,
  },
  {
    id: 'smart_drain_recommended',
    titleAr: 'ربح قليل وخسارة أكثر',
    titleEn: 'Low Wins · More Losses',
    descAr: 'مستوى 3 · فوز 25% · حد 3x (موصى به)',
    descEn: 'Level 3 · 25% Win · 3x Cap (Recommended)',
    profitLevel: 3,
    targetWinRatePercent: 25,
    maxAllowedMultiplier: 3,
  },
  {
    id: 'balanced',
    titleAr: 'متوازن',
    titleEn: 'Balanced',
    descAr: 'مستوى 5 · فوز 45% · حد 8x',
    descEn: 'Level 5 · 45% Win · 8x Cap',
    profitLevel: 5,
    targetWinRatePercent: 45,
    maxAllowedMultiplier: 8,
  },
  {
    id: 'player_friendly',
    titleAr: 'ربح مرتفع للاعبين',
    titleEn: 'Player Friendly',
    descAr: 'مستوى 8 · فوز 65% · حد 25x',
    descEn: 'Level 8 · 65% Win · 25x Cap',
    profitLevel: 8,
    targetWinRatePercent: 65,
    maxAllowedMultiplier: 25,
  },
];

const QUICK_MULTIPLIERS = [2, 3, 5, 10, 25, 50] as const;

export const AdminGamesAlgorithmControl: React.FC<AdminGamesAlgorithmControlProps> = ({
  lang,
  getAdminHeaders,
  showToast,
  externalRefreshSignal,
}) => {
  const isAr = lang === 'ar';

  const [profitLevel, setProfitLevel] = useState<number>(3);
  const [targetWinRatePercent, setTargetWinRatePercent] = useState<number>(25);
  const [maxAllowedMultiplier, setMaxAllowedMultiplier] = useState<number>(3);
  const [connectedGames, setConnectedGames] = useState<ConnectedGameMeta[]>(FALLBACK_CONNECTED_GAMES);
  const [telemetry, setTelemetry] = useState<GamesAlgorithmTelemetry | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResettingTelemetry, setIsResettingTelemetry] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/games/settings', {
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        const s = data.settings;
        const algo = data.algorithm || s?.algorithm;
        if (s && typeof s.plinkoProfitLevel === 'number') {
          setProfitLevel(s.plinkoProfitLevel);
        }
        if (algo) {
          if (typeof algo.targetWinRatePercent === 'number') {
            setTargetWinRatePercent(algo.targetWinRatePercent);
          }
          if (typeof algo.maxAllowedMultiplier === 'number') {
            setMaxAllowedMultiplier(algo.maxAllowedMultiplier);
          }
        }
        if (Array.isArray(data.connectedGames) && data.connectedGames.length > 0) {
          setConnectedGames(data.connectedGames);
        }
        if (data.telemetry) {
          setTelemetry(data.telemetry);
        }
        setHasUnsavedChanges(false);
      }
    } catch {
      // silent fallback
    } finally {
      setIsLoading(false);
    }
  }, [getAdminHeaders]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings, externalRefreshSignal]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/games/settings', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          simplified: true,
          unifiedProfitLevel: profitLevel,
          targetWinRatePercent,
          maxAllowedMultiplier,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        showToast('error', data?.message || (isAr ? 'فشل حفظ الإعدادات' : 'Failed to save settings'));
        return;
      }
      if (data.settings && typeof data.settings.plinkoProfitLevel === 'number') {
        setProfitLevel(data.settings.plinkoProfitLevel);
      }
      if (data.algorithm) {
        setTargetWinRatePercent(data.algorithm.targetWinRatePercent);
        setMaxAllowedMultiplier(data.algorithm.maxAllowedMultiplier);
      }
      if (Array.isArray(data.connectedGames) && data.connectedGames.length > 0) {
        setConnectedGames(data.connectedGames);
      }
      if (data.telemetry) {
        setTelemetry(data.telemetry);
      }
      setHasUnsavedChanges(false);
      showToast(
        'success',
        data.message ||
          (isAr
            ? 'تم تطبيق خوارزمية الربح الموحدة على جميع الألعاب بنجاح'
            : 'Unified profit algorithm applied to all games')
      );
    } catch {
      showToast('error', isAr ? 'تعذر الاتصال بالسيرفر' : 'Server connection failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetTelemetry = async () => {
    setIsResettingTelemetry(true);
    try {
      const res = await fetch('/api/admin/games/telemetry/reset', {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setTelemetry(data.telemetry);
        setConfirmResetOpen(false);
        showToast('success', isAr ? 'تم تصفير الإحصائيات بنجاح' : 'Telemetry reset successfully');
      } else {
        showToast('error', data?.message || (isAr ? 'فشل التصفير' : 'Reset failed'));
      }
    } catch {
      showToast('error', isAr ? 'تعذر الاتصال بالسيرفر' : 'Server connection failed');
    } finally {
      setIsResettingTelemetry(false);
    }
  };

  const applyPreset = (preset: SimplePreset) => {
    setProfitLevel(preset.profitLevel);
    setTargetWinRatePercent(preset.targetWinRatePercent);
    setMaxAllowedMultiplier(preset.maxAllowedMultiplier);
    setHasUnsavedChanges(true);
  };

  const activePresetId = SIMPLE_PRESETS.find(
    (p) =>
      p.profitLevel === profitLevel &&
      p.targetWinRatePercent === targetWinRatePercent &&
      p.maxAllowedMultiplier === maxAllowedMultiplier
  )?.id;

  const actualWinRate =
    telemetry && telemetry.totalRounds > 0
      ? Math.round((telemetry.totalWins / telemetry.totalRounds) * 1000) / 10
      : 0;

  const profitLevelLabel =
    profitLevel <= 0
      ? isAr
        ? '0 (إيقاف الربح — خسارة كاملة)'
        : '0 (No Wins — Full House)'
      : profitLevel <= 3
      ? isAr
        ? `${profitLevel} / 10 (أرباح قليلة وحماية عالية)`
        : `${profitLevel} / 10 (Strict House Edge)`
      : profitLevel <= 6
      ? isAr
        ? `${profitLevel} / 10 (متوازن)`
        : `${profitLevel} / 10 (Balanced)`
      : isAr
      ? `${profitLevel} / 10 (مواتٍ للاعبين)`
      : `${profitLevel} / 10 (Player Favorable)`;

  return (
    <div className="space-y-5">
      {/* Main Unified Control Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/25 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-neutral-900 dark:text-white flex items-center gap-2 flex-wrap">
                <span>
                  {isAr ? 'خوارزمية الربح الموحدة للألعاب' : 'Unified Games Profit Algorithm'}
                </span>
                {hasUnsavedChanges && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                    {isAr ? 'تعديلات غير محفوظة' : 'Unsaved'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {isAr
                  ? 'تحكم مبسط وموحد ينطبق تلقائياً على جميع الألعاب الحالية وأي لعبة تُضاف مستقبلاً'
                  : 'Simple unified control applied automatically to all current and future games'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchSettings}
              disabled={isLoading || isSaving}
              className="px-3.5 py-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isAr ? 'تحديث' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>{isAr ? 'حفظ وتطبيق على الكل' : 'Save & Apply to All'}</span>
            </button>
          </div>
        </div>

        {/* Connected Games Strip (Current + Future Auto-Link) */}
        <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-800 dark:text-neutral-200">
              <Gamepad2 className="w-4 h-4 text-emerald-500" />
              <span>
                {isAr
                  ? `الألعاب المرتبطة بالخوارزمية (${connectedGames.length})`
                  : `Connected Games (${connectedGames.length})`}
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-bold">
              <Link2 className="w-3 h-3" />
              <span>
                {isAr ? 'ربط تلقائي لأي لعبة جديدة مستقبلاً' : 'Auto-links future games'}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {connectedGames.map((g) => (
              <span
                key={g.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs font-semibold text-neutral-700 dark:text-neutral-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{isAr ? g.nameAr : g.nameEn}</span>
              </span>
            ))}
          </div>
        </div>

        {/* One-Click Presets */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{isAr ? 'أوضاع سريعة جاهزة' : 'Quick Presets'}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {SIMPLE_PRESETS.map((preset) => {
              const isSelected = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-100 shadow-sm'
                      : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-800 hover:border-emerald-500/40 text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  <div className="text-xs font-extrabold">
                    {isAr ? preset.titleAr : preset.titleEn}
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                    {isAr ? preset.descAr : preset.descEn}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3 Essential Unified Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Control 1: Master Profit Level */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-neutral-800 dark:text-neutral-100">
                {isAr ? '1. مستوى الربح العام' : '1. Master Profit Level'}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-black">
                {profitLevel} / 10
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={profitLevel}
              onChange={(e) => {
                setProfitLevel(Number(e.target.value));
                setHasUnsavedChanges(true);
              }}
              className="w-full accent-emerald-600 cursor-pointer"
            />
            <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {profitLevelLabel}
            </div>
          </div>

          {/* Control 2: Target Player Win Rate % */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-neutral-800 dark:text-neutral-100">
                {isAr ? '2. نسبة فوز اللاعبين' : '2. Player Win Rate'}
              </span>
              <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 text-xs font-black">
                {targetWinRatePercent}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={85}
              step={1}
              value={targetWinRatePercent}
              onChange={(e) => {
                setTargetWinRatePercent(Number(e.target.value));
                setHasUnsavedChanges(true);
              }}
              className="w-full accent-cyan-600 cursor-pointer"
            />
            <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              {isAr
                ? `فوز ${targetWinRatePercent}% مقابل خسارة ${100 - targetWinRatePercent}% تقريباً`
                : `~${targetWinRatePercent}% wins vs ${100 - targetWinRatePercent}% losses`}
            </div>
          </div>

          {/* Control 3: Max Multiplier Cap */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-neutral-800 dark:text-neutral-100">
                {isAr ? '3. أقصى مضاعف للربح' : '3. Max Win Multiplier'}
              </span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={50}
                  step={0.5}
                  value={maxAllowedMultiplier}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(50, Number(e.target.value) || 1));
                    setMaxAllowedMultiplier(val);
                    setHasUnsavedChanges(true);
                  }}
                  className="w-16 px-2 py-0.5 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs font-black text-center text-neutral-900 dark:text-white"
                />
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">x</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_MULTIPLIERS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMaxAllowedMultiplier(m);
                    setHasUnsavedChanges(true);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    maxAllowedMultiplier === m
                      ? 'bg-amber-500 text-white'
                      : 'bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-amber-500/50'
                  }`}
                >
                  {m}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Compact Live Telemetry + Recent Rounds */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h4 className="text-sm font-extrabold text-neutral-900 dark:text-white">
              {isAr ? 'إحصائيات الألعاب المباشرة (لجميع الألعاب)' : 'Live Cross-Game Telemetry'}
            </h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {isAr
                ? 'ملخص فوري للجولات الفعلية المسجلة عبر كل الألعاب'
                : 'Real-time summary of rounds across all connected games'}
            </p>
          </div>

          {!confirmResetOpen ? (
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-rose-500/10 hover:text-rose-600 text-xs font-bold text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{isAr ? 'تصفير السجل' : 'Reset Stats'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetTelemetry}
                disabled={isResettingTelemetry}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {isResettingTelemetry
                  ? isAr
                    ? 'جاري التصفير...'
                    : 'Resetting...'
                  : isAr
                  ? 'تأكيد التصفير'
                  : 'Confirm Reset'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-300 cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          )}
        </div>

        {/* 4 Summary Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800">
            <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              {isAr ? 'إجمالي الجولات' : 'Total Rounds'}
            </div>
            <div className="text-lg font-black text-neutral-900 dark:text-white mt-0.5">
              {(telemetry?.totalRounds || 0).toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800">
            <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              {isAr ? 'نسبة فوز اللاعبين الفعلية' : 'Actual Win Rate'}
            </div>
            <div className="text-lg font-black text-cyan-600 dark:text-cyan-400 mt-0.5">
              {actualWinRate}%
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800">
            <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              {isAr ? 'إجمالي الرهانات' : 'Total Wagered'}
            </div>
            <div className="text-lg font-black text-neutral-900 dark:text-white mt-0.5">
              {(telemetry?.totalWageredCoins || 0).toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800">
            <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              {isAr ? 'صافي ربح المنصة' : 'House Net Profit'}
            </div>
            <div
              className={`text-lg font-black mt-0.5 ${
                (telemetry?.houseNetProfitCoins || 0) >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {(telemetry?.houseNetProfitCoins || 0) >= 0 ? '+' : ''}
              {(telemetry?.houseNetProfitCoins || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Recent Outcomes Table */}
        {telemetry && telemetry.recentOutcomes && telemetry.recentOutcomes.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-xs text-right">
              <thead className="bg-neutral-50 dark:bg-neutral-950/80 text-neutral-500 dark:text-neutral-400">
                <tr>
                  <th className="py-2.5 px-3 font-bold">{isAr ? 'اللعبة' : 'Game'}</th>
                  <th className="py-2.5 px-3 font-bold">{isAr ? 'الرهان' : 'Bet'}</th>
                  <th className="py-2.5 px-3 font-bold">{isAr ? 'المضاعف' : 'Multiplier'}</th>
                  <th className="py-2.5 px-3 font-bold">{isAr ? 'العائد' : 'Payout'}</th>
                  <th className="py-2.5 px-3 font-bold">{isAr ? 'النتيجة' : 'Outcome'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {telemetry.recentOutcomes.slice(0, 12).map((row, idx) => (
                  <tr
                    key={`${row.timestamp}-${idx}`}
                    className="bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                  >
                    <td className="py-2 px-3 font-bold text-neutral-800 dark:text-neutral-100">
                      {row.game}
                    </td>
                    <td className="py-2 px-3 text-neutral-600 dark:text-neutral-300">
                      {row.betAmount.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-bold text-amber-600 dark:text-amber-400">
                      {row.multiplier}x
                    </td>
                    <td className="py-2 px-3 font-semibold text-neutral-800 dark:text-neutral-200">
                      {row.payout.toLocaleString()}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          row.won
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {row.won ? (isAr ? 'ربح' : 'Win') : isAr ? 'خسارة' : 'Loss'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
