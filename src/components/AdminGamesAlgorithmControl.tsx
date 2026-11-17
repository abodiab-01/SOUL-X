import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Gamepad2,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sliders,
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

interface SimulationPreviewRound {
  round: number;
  outcome: 'loss' | 'small_win' | 'medium_win';
  multiplier: number;
  net: number;
  reason: string;
}

interface SimulationResult {
  previewRounds: SimulationPreviewRound[];
  monteCarlo: {
    rounds: number;
    wins: number;
    losses: number;
    winRatePercent: number;
    houseEdgePercent: number;
    avgWinMultiplier: number;
    projectedHouseProfit: number;
  };
}

interface AdminGamesAlgorithmControlProps {
  lang: Language;
  getAdminHeaders: () => Record<string, string>;
  showToast: (type: 'success' | 'error', message: string) => void;
  externalRefreshSignal?: number;
}

const DEFAULT_ALGORITHM: SmartAlgorithmSettings = {
  algorithmMode: 'smart_cycle',
  targetWinRatePercent: 25,
  maxAllowedMultiplier: 3,
  smallWinBiasPercent: 85,
  cycleWinsCount: 1,
  cycleLossesCount: 3,
  cycleOrderPattern: 'smart_shuffle',
  maxConsecutiveWins: 1,
  highBetThreshold: 10000,
  highBetLossBoostPercent: 75,
  sessionProfitCapCoins: 25000,
  lossRecoveryIntensity: 75,
};

interface StrategyPreset {
  id: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  profitLevel: number;
  algorithm: SmartAlgorithmSettings;
}

const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    id: 'smart_drain_recommended',
    titleAr: 'ربح قليل وخسارة أكثر',
    titleEn: 'Small Wins · More Losses',
    descAr: 'دورة 1 ربح صغير مقابل 3 خسائر · حد 3x · حماية تلقائية',
    descEn: '1 small win per 3 losses · 3x cap · auto recovery',
    profitLevel: 3,
    algorithm: {
      algorithmMode: 'smart_cycle',
      targetWinRatePercent: 25,
      maxAllowedMultiplier: 3,
      smallWinBiasPercent: 85,
      cycleWinsCount: 1,
      cycleLossesCount: 3,
      cycleOrderPattern: 'smart_shuffle',
      maxConsecutiveWins: 1,
      highBetThreshold: 10000,
      highBetLossBoostPercent: 75,
      sessionProfitCapCoins: 25000,
      lossRecoveryIntensity: 75,
    },
  },
  {
    id: 'strict_house_drain',
    titleAr: 'استنزاف عالٍ للمنصة',
    titleEn: 'Strict House Drain',
    descAr: 'دورة 1 ربح مقابل 6 خسائر · سقف 2x · تشديد الرهان الكبير',
    descEn: '1 win per 6 losses · 2x cap · strict high-bet guard',
    profitLevel: 2,
    algorithm: {
      algorithmMode: 'smart_cycle',
      targetWinRatePercent: 15,
      maxAllowedMultiplier: 2,
      smallWinBiasPercent: 95,
      cycleWinsCount: 1,
      cycleLossesCount: 6,
      cycleOrderPattern: 'loss_first',
      maxConsecutiveWins: 1,
      highBetThreshold: 5000,
      highBetLossBoostPercent: 90,
      sessionProfitCapCoins: 10000,
      lossRecoveryIntensity: 90,
    },
  },
  {
    id: 'hook_then_recover',
    titleAr: 'ربح تشجيعي ثم سحب',
    titleEn: 'Early Hook & Recover',
    descAr: 'ربحان صغيران بالبداية ثم 4 خسائر متتالية · حد 4x',
    descEn: '2 early small wins then 4 losses · 4x cap',
    profitLevel: 4,
    algorithm: {
      algorithmMode: 'custom_sequence',
      targetWinRatePercent: 33,
      maxAllowedMultiplier: 4,
      smallWinBiasPercent: 80,
      cycleWinsCount: 2,
      cycleLossesCount: 4,
      cycleOrderPattern: 'win_first',
      maxConsecutiveWins: 1,
      highBetThreshold: 15000,
      highBetLossBoostPercent: 70,
      sessionProfitCapCoins: 30000,
      lossRecoveryIntensity: 70,
    },
  },
  {
    id: 'balanced_mode',
    titleAr: 'متوازن نسبياً',
    titleEn: 'Balanced Odds',
    descAr: 'نسبة 46% · مضاعفات حتى 15x · توزيع مفتوح',
    descEn: '46% win rate · up to 15x · lighter guardrails',
    profitLevel: 5,
    algorithm: {
      algorithmMode: 'house_edge',
      targetWinRatePercent: 46,
      maxAllowedMultiplier: 15,
      smallWinBiasPercent: 55,
      cycleWinsCount: 1,
      cycleLossesCount: 1,
      cycleOrderPattern: 'smart_shuffle',
      maxConsecutiveWins: 2,
      highBetThreshold: 50000,
      highBetLossBoostPercent: 35,
      sessionProfitCapCoins: 100000,
      lossRecoveryIntensity: 35,
    },
  },
];

function translateDecisionReason(reason: string, isAr: boolean): string {
  const map: Record<string, { ar: string; en: string }> = {
    cycle_loss: { ar: 'خسارة مجدولة بالدورة', en: 'Scheduled cycle loss' },
    cycle_win: { ar: 'ربح بالدورة', en: 'Cycle win' },
    cycle_win_small: { ar: 'ربح قليل مجدول', en: 'Small cycle win' },
    smart_rate_throttle: { ar: 'تقليص ذكي لنسبة الفوز', en: 'Smart win-rate throttle' },
    consecutive_wins_cap: { ar: 'منع الفوز المتتالي', en: 'Consecutive win cap' },
    profit_cap_recovery: { ar: 'سقف صافي ربح اللاعب', en: 'Player profit cap' },
    high_bet_protection: { ar: 'حماية الرهان الكبير', en: 'High-bet guard' },
    recovery_drain: { ar: 'استرداد لصالح المنصة', en: 'House recovery drain' },
    multiplier_cap_guard: { ar: 'تجاوز سقف المضاعف', en: 'Multiplier cap guard' },
    house_edge_win: { ar: 'ربح بأفضلية المنصة', en: 'House-edge win' },
    house_edge_win_small: { ar: 'ربح قليل بأفضلية المنصة', en: 'Small house-edge win' },
    house_edge_loss: { ar: 'خسارة بأفضلية المنصة', en: 'House-edge loss' },
    profit_level_zero: { ar: 'المستوى 0 (خسارة)', en: 'Level 0 (Loss)' },
    classic_level: { ar: 'المستوى التقليدي', en: 'Classic level' },
    win_rate_zero: { ar: 'نسبة الفوز 0%', en: '0% win rate' },
  };
  const entry = map[reason];
  if (entry) return isAr ? entry.ar : entry.en;
  return reason;
}

export const AdminGamesAlgorithmControl: React.FC<AdminGamesAlgorithmControlProps> = ({
  lang,
  getAdminHeaders,
  showToast,
  externalRefreshSignal = 0,
}) => {
  const isAr = lang === 'ar';

  const [profitLevelInput, setProfitLevelInput] = useState<string>('3');
  const [algorithm, setAlgorithm] = useState<SmartAlgorithmSettings>(DEFAULT_ALGORITHM);
  const [telemetry, setTelemetry] = useState<GamesAlgorithmTelemetry | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isResettingTelemetry, setIsResettingTelemetry] = useState<boolean>(false);

  const runSimulation = useCallback(
    async (levelOverride?: number, algoOverride?: SmartAlgorithmSettings) => {
      setIsSimulating(true);
      try {
        const res = await fetch('/api/admin/games/algorithm/simulate', {
          method: 'POST',
          headers: getAdminHeaders(),
          body: JSON.stringify({
            profitLevel: levelOverride ?? Number(profitLevelInput),
            algorithm: algoOverride ?? algorithm,
            sampleBet: 1000,
          }),
        });
        const data = await res.json();
        if (data?.success && Array.isArray(data.previewRounds)) {
          setSimulation({
            previewRounds: data.previewRounds,
            monteCarlo: data.monteCarlo,
          });
        }
      } catch (err) {
        console.warn('Simulation error:', err);
      } finally {
        setIsSimulating(false);
      }
    },
    [algorithm, getAdminHeaders, profitLevelInput]
  );

  const fetchSettingsAndTelemetry = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/games/settings', {
        headers: getAdminHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (data?.success && data?.settings) {
        const lvl =
          data.settings.plinkoProfitLevel ??
          data.settings.minesProfitLevel ??
          data.settings.diceProfitLevel ??
          data.settings.olympusProfitLevel ??
          data.settings.boxesProfitLevel ??
          data.settings.winterSlotsProfitLevel ??
          5;
        const algo: SmartAlgorithmSettings = {
          ...DEFAULT_ALGORITHM,
          ...(data.algorithm || data.settings.algorithm || {}),
        };
        setProfitLevelInput(String(lvl));
        setAlgorithm(algo);
        if (data.telemetry) {
          setTelemetry(data.telemetry);
        }
        runSimulation(Number(lvl), algo);
      }
    } catch (err) {
      console.warn('Failed to fetch games algorithm settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getAdminHeaders]);

  useEffect(() => {
    fetchSettingsAndTelemetry();
  }, [externalRefreshSignal]);

  const handleApplyPreset = (preset: StrategyPreset) => {
    setProfitLevelInput(String(preset.profitLevel));
    setAlgorithm({ ...preset.algorithm });
    runSimulation(preset.profitLevel, preset.algorithm);
  };

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const numLevel = Number(profitLevelInput);
    if (!Number.isFinite(numLevel) || numLevel < 0 || numLevel > 10) {
      showToast('error', isAr ? 'أدخل رقماً بين 0 و 10 فقط لمستوى الربح' : 'Enter a profit level between 0 and 10');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/games/settings', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          unifiedProfitLevel: numLevel,
          plinkoProfitLevel: numLevel,
          minesProfitLevel: numLevel,
          diceProfitLevel: numLevel,
          olympusProfitLevel: numLevel,
          boxesProfitLevel: numLevel,
          winterSlotsProfitLevel: numLevel,
          algorithm,
        }),
      });
      const data = await res.json();
      if (data?.success && data?.settings) {
        const savedLevel = data.settings.plinkoProfitLevel ?? numLevel;
        const savedAlgo = data.algorithm || data.settings.algorithm || algorithm;
        setProfitLevelInput(String(savedLevel));
        setAlgorithm(savedAlgo);
        if (data.telemetry) setTelemetry(data.telemetry);
        showToast(
          'success',
          data.message || (isAr ? 'تم حفظ إعدادات الخوارزمية الذكية بنجاح' : 'Smart algorithm saved')
        );
        runSimulation(savedLevel, savedAlgo);
      } else {
        showToast('error', data?.message || (isAr ? 'فشل حفظ الإعدادات' : 'Failed to save settings'));
      }
    } catch (err: any) {
      showToast('error', err?.message || (isAr ? 'خطأ في الاتصال بالخادم' : 'Network error'));
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
      if (data?.success) {
        setTelemetry(data.telemetry);
        showToast('success', data.message || (isAr ? 'تم تصفير الإحصائيات بنجاح' : 'Telemetry reset'));
      } else {
        showToast('error', data?.message || (isAr ? 'فشل تصفير الإحصائيات' : 'Failed to reset telemetry'));
      }
    } catch (err: any) {
      showToast('error', err?.message || (isAr ? 'خطأ في الاتصال بالخادم' : 'Network error'));
    } finally {
      setIsResettingTelemetry(false);
    }
  };

  const totalRounds = telemetry?.totalRounds ?? 0;
  const actualWinRate =
    totalRounds > 0 ? Math.round(((telemetry?.totalWins ?? 0) / totalRounds) * 1000) / 10 : 0;
  const houseProfit = telemetry?.houseNetProfitCoins ?? 0;

  return (
    <div className="space-y-5">
      {/* Main Smart Algorithm Workspace Surface */}
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Header Bar */}
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20 shrink-0">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-white leading-tight">
                {isAr ? 'خوارزمية التحكم الذكي بالألعاب' : 'Smart Games Algorithm Control'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                {isAr
                  ? 'يشمل جميع الألعاب: Winter Slots · صناديق الحظ · Plinko · Mines · Dice · Olympus Gates'
                  : 'Governs all games: Winter Slots · Mystery Boxes · Plinko · Mines · Dice · Olympus Gates'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchSettingsAndTelemetry}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isAr ? 'تحديث' : 'Refresh'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSaveSettings()}
              disabled={isSaving || isLoading}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{isAr ? 'حفظ وتطبيق الخوارزمية' : 'Save & Apply'}</span>
            </button>
          </div>
        </div>

        {/* Real-Time House Telemetry Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x rtl:lg:divide-x-reverse divide-neutral-200 dark:divide-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 border-b border-neutral-200 dark:border-neutral-800">
          <div className="p-4 sm:px-6">
            <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              {isAr ? 'إجمالي الجولات الفعلية' : 'Total Real Rounds'}
            </div>
            <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-neutral-900 dark:text-white mt-1">
              {totalRounds.toLocaleString()}
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono tabular-nums mt-0.5">
              {isAr
                ? `فوز: ${(telemetry?.totalWins ?? 0).toLocaleString()} · خسارة: ${(telemetry?.totalLosses ?? 0).toLocaleString()}`
                : `W: ${(telemetry?.totalWins ?? 0).toLocaleString()} · L: ${(telemetry?.totalLosses ?? 0).toLocaleString()}`}
            </div>
          </div>

          <div className="p-4 sm:px-6">
            <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              {isAr ? 'نسبة فوز اللاعبين الفعلية' : 'Actual Player Win Rate'}
            </div>
            <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-neutral-900 dark:text-white mt-1">
              {actualWinRate}%
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono tabular-nums mt-0.5">
              {isAr ? `الهدف: ${algorithm.targetWinRatePercent}%` : `Target: ${algorithm.targetWinRatePercent}%`}
            </div>
          </div>

          <div className="p-4 sm:px-6">
            <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
              {isAr ? 'الرهانات مقابل المدفوعات' : 'Wagered vs Paid Out'}
            </div>
            <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-neutral-900 dark:text-white mt-1">
              {(telemetry?.totalWageredCoins ?? 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono tabular-nums mt-0.5">
              {isAr
                ? `المصروف للاعبين: ${(telemetry?.totalPayoutCoins ?? 0).toLocaleString()} Coin`
                : `Paid: ${(telemetry?.totalPayoutCoins ?? 0).toLocaleString()} Coin`}
            </div>
          </div>

          <div className="p-4 sm:px-6 flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                {isAr ? 'صافي ربح المنصة' : 'House Net Profit'}
              </div>
              <div
                className={`text-lg sm:text-xl font-black font-mono tabular-nums mt-1 ${
                  houseProfit >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {houseProfit >= 0 ? `+${houseProfit.toLocaleString()}` : houseProfit.toLocaleString()}
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                {houseProfit >= 0
                  ? isAr
                    ? 'صالح المنصة (ربح)'
                    : 'Net house gain'
                  : isAr
                  ? 'صالح اللاعبين (عجز)'
                  : 'Net house deficit'}
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetTelemetry}
              disabled={isResettingTelemetry}
              title={isAr ? 'تصفير سجل الإحصائيات ودورات اللاعبين' : 'Reset telemetry & player cycles'}
              className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 dark:text-neutral-400 transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResettingTelemetry ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveSettings} className="p-5 sm:p-6 space-y-6">
          {/* Strategy Presets Row */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                {isAr ? 'استراتيجيات جاهزة (تطبيق سريع)' : 'Quick Strategy Presets'}
              </span>
              <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {isAr ? 'اضغط لتعبئة الإعدادات ثم اضغط حفظ' : 'Click to load preset, then save'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {STRATEGY_PRESETS.map((preset) => {
                const isSelected =
                  algorithm.algorithmMode === preset.algorithm.algorithmMode &&
                  algorithm.cycleWinsCount === preset.algorithm.cycleWinsCount &&
                  algorithm.cycleLossesCount === preset.algorithm.cycleLossesCount &&
                  algorithm.maxAllowedMultiplier === preset.algorithm.maxAllowedMultiplier &&
                  Number(profitLevelInput) === preset.profitLevel;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`p-3.5 rounded-xl border text-start transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 text-neutral-900 dark:text-white'
                        : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 hover:border-amber-500/40 text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    <div className="text-xs font-bold leading-snug">
                      {isAr ? preset.titleAr : preset.titleEn}
                    </div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                      {isAr ? preset.descAr : preset.descEn}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2-Column Configuration Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            {/* Column 1: Mode, Master Profit Slider, Win Rate & Small Win Bias */}
            <div className="space-y-5">
              {/* Algorithm Mode Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-500" />
                  <span>{isAr ? 'طريقة عمل الخوارزمية' : 'Algorithm Mode'}</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                  {(
                    [
                      { id: 'smart_cycle', ar: 'الترتيب الذكي', en: 'Smart Cycle' },
                      { id: 'custom_sequence', ar: 'دورة مخصصة', en: 'Custom Cycle' },
                      { id: 'house_edge', ar: 'أفضلية المنصة', en: 'House Edge' },
                      { id: 'classic_level', ar: 'تقليدي 0–10', en: 'Classic 0–10' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setAlgorithm((prev) => ({ ...prev, algorithmMode: m.id }))}
                      className={`px-2.5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap truncate ${
                        algorithm.algorithmMode === m.id
                          ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                          : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                      }`}
                    >
                      {isAr ? m.ar : m.en}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {algorithm.algorithmMode === 'smart_cycle'
                    ? isAr
                      ? 'يدير دورات ربح قليل وخسارة أكثر تلقائياً مع حماية الرهانات الكبيرة وسقف الربح.'
                      : 'Automates small-win / high-loss cycles with high-bet & profit-cap protection.'
                    : algorithm.algorithmMode === 'custom_sequence'
                    ? isAr
                      ? 'يلتزم بدقة بعدد مرات الربح والخسارة المحددة في كل دورة مع احترام قواعد الحماية.'
                      : 'Enforces exact wins vs losses per cycle while respecting safety guardrails.'
                    : algorithm.algorithmMode === 'house_edge'
                    ? isAr
                      ? 'سحب تدريجي مبني على نسبة الفوز المستهدفة وسقف المضاعف دون دورة مقيدة.'
                      : 'Continuous house-edge weighting tuned by target win rate & multiplier cap.'
                    : isAr
                    ? 'يستخدم مقبض الربح الكلاسيكي المباشر من 0 إلى 10 فقط.'
                    : 'Uses the classic 0–10 slider weighting directly.'}
                </p>
              </div>

              {/* Unified Master Profit Level (0-10) */}
              <div className="space-y-2.5 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    {isAr ? 'مقبض الربح العام لجميع الألعاب (0–10)' : 'Master Profit Level (0–10)'}
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={1}
                      value={profitLevelInput}
                      onChange={(e) => setProfitLevelInput(e.target.value)}
                      className="w-16 h-9 px-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-mono tabular-nums text-sm font-black text-center text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                      dir="ltr"
                    />
                    <span className="text-xs font-mono text-neutral-400">/10</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={Math.max(0, Math.min(10, Number(profitLevelInput) || 0))}
                  onChange={(e) => setProfitLevelInput(e.target.value)}
                  className="w-full accent-amber-500 cursor-pointer"
                  dir="ltr"
                />
                <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                  <span>{isAr ? '0 — خسارة كاملة' : '0 — Zero Win'}</span>
                  <span>{isAr ? '3 — تشديد ذكي' : '3 — House Favor'}</span>
                  <span>{isAr ? '10 — ربح مرتفع' : '10 — High Win'}</span>
                </div>
              </div>

              {/* Target Win Rate & Small-Win Focus */}
              {algorithm.algorithmMode !== 'classic_level' && (
                <div className="space-y-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        {isAr ? 'نسبة فوز اللاعب المستهدفة' : 'Target Player Win Rate'}
                      </label>
                      <span className="text-xs font-mono tabular-nums font-black text-amber-600 dark:text-amber-400">
                        {algorithm.targetWinRatePercent}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={85}
                      step={1}
                      value={algorithm.targetWinRatePercent}
                      onChange={(e) =>
                        setAlgorithm((prev) => ({ ...prev, targetWinRatePercent: Number(e.target.value) }))
                      }
                      className="w-full accent-amber-500 cursor-pointer"
                      dir="ltr"
                    />
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span>{isAr ? '0% (خسارة دائمة)' : '0%'}</span>
                      <span>{isAr ? '25% (ربح قليل)' : '25% (Recommended)'}</span>
                      <span>{isAr ? '85% (سخي)' : '85%'}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                        {isAr ? 'تركيز الأرباح على القيم الصغيرة (1.2x – 2.5x)' : 'Small-Win Bias (1.2x – 2.5x)'}
                      </label>
                      <span className="text-xs font-mono tabular-nums font-black text-neutral-900 dark:text-white">
                        {algorithm.smallWinBiasPercent}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={algorithm.smallWinBiasPercent}
                      onChange={(e) =>
                        setAlgorithm((prev) => ({ ...prev, smallWinBiasPercent: Number(e.target.value) }))
                      }
                      className="w-full accent-amber-500 cursor-pointer"
                      dir="ltr"
                    />
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {isAr
                        ? 'كلما ارتفعت النسبة، تقتصر أرباح المستخدم على مبالغ صغيرة ومغرية دون جوائز كبرى.'
                        : 'Higher values keep player wins small and modest rather than hitting top payouts.'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Smart Cycle Pattern, Max Multiplier Cap & Risk Guardrails */}
            {algorithm.algorithmMode !== 'classic_level' ? (
              <div className="space-y-5">
                {/* Cycle Sequence Ordering */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200 block">
                    {isAr ? 'ترتيب الدورة الذكي (كم ربح مقابل كم خسارة)' : 'Smart Cycle Win / Loss Ratio & Order'}
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block">
                        {isAr ? 'مرات الربح بالدورة (0–5)' : 'Wins per Cycle (0–5)'}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        value={algorithm.cycleWinsCount}
                        onChange={(e) =>
                          setAlgorithm((prev) => ({
                            ...prev,
                            cycleWinsCount: Math.max(0, Math.min(5, Number(e.target.value) || 0)),
                          }))
                        }
                        className="w-full h-10 px-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-mono tabular-nums text-sm font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block">
                        {isAr ? 'مرات الخسارة بالدورة (1–15)' : 'Losses per Cycle (1–15)'}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={15}
                        value={algorithm.cycleLossesCount}
                        onChange={(e) =>
                          setAlgorithm((prev) => ({
                            ...prev,
                            cycleLossesCount: Math.max(1, Math.min(15, Number(e.target.value) || 1)),
                          }))
                        }
                        className="w-full h-10 px-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-mono tabular-nums text-sm font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                    {(
                      [
                        { id: 'smart_shuffle', ar: 'توزيع ذكي متغير', en: 'Smart Shuffle' },
                        { id: 'win_first', ar: 'ربح ثم خسارة', en: 'Win Then Loss' },
                        { id: 'loss_first', ar: 'خسارة ثم ربح', en: 'Loss Then Win' },
                      ] as const
                    ).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setAlgorithm((prev) => ({ ...prev, cycleOrderPattern: p.id }))}
                        className={`px-2 py-2 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap truncate ${
                          algorithm.cycleOrderPattern === p.id
                            ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-xs'
                            : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
                        }`}
                      >
                        {isAr ? p.ar : p.en}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Allowed Multiplier Cap */}
                <div className="space-y-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                      {isAr ? 'سقف المضاعف الأقصى للربح' : 'Max Allowed Win Multiplier'}
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={50}
                        step={0.5}
                        value={algorithm.maxAllowedMultiplier}
                        onChange={(e) =>
                          setAlgorithm((prev) => ({
                            ...prev,
                            maxAllowedMultiplier: Math.max(1, Math.min(50, Number(e.target.value) || 1)),
                          }))
                        }
                        className="w-20 h-9 px-2 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-mono tabular-nums text-sm font-black text-center text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                        dir="ltr"
                      />
                      <span className="text-xs font-mono font-bold text-neutral-400">x</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[1.5, 2, 3, 5, 10, 25, 50].map((cap) => (
                      <button
                        key={cap}
                        type="button"
                        onClick={() => setAlgorithm((prev) => ({ ...prev, maxAllowedMultiplier: cap }))}
                        className={`px-2.5 py-1.5 rounded-lg font-mono tabular-nums text-xs font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                          algorithm.maxAllowedMultiplier === cap
                            ? 'bg-amber-500 text-neutral-950 border-amber-500'
                            : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-amber-500/40'
                        }`}
                      >
                        {cap}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Risk & Recovery Guardrails */}
                <div className="space-y-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-800 dark:text-neutral-200">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                    <span>{isAr ? 'حماية المنصة ومنع الاستنزاف' : 'House Guardrails & Recovery'}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block">
                        {isAr ? 'أقصى ربح متتالي مسموح' : 'Max Consecutive Wins'}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={algorithm.maxConsecutiveWins}
                        onChange={(e) =>
                          setAlgorithm((prev) => ({
                            ...prev,
                            maxConsecutiveWins: Math.max(1, Math.min(5, Number(e.target.value) || 1)),
                          }))
                        }
                        className="w-full h-10 px-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-mono tabular-nums text-sm font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block">
                        {isAr ? 'قوة استرداد المنصة بعد فوز اللاعب (%)' : 'Post-Win Recovery Intensity (%)'}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={algorithm.lossRecoveryIntensity}
                        onChange={(e) =>
                          setAlgorithm((prev) => ({
                            ...prev,
                            lossRecoveryIntensity: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          }))
                        }
                        className="w-full h-10 px-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-mono tabular-nums text-sm font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block">
                        {isAr ? 'حد الرهان الكبير (Coin)' : 'High-Bet Threshold (Coin)'}
                      </span>
                      <input
                        type="number"
                        min={500}
                        max={1000000}
                        step={500}
                        value={algorithm.highBetThreshold}
                        onChange={(e) =>
                          setAlgorithm((prev) => ({
                            ...prev,
                            highBetThreshold: Math.max(500, Math.min(1000000, Number(e.target.value) || 500)),
                          }))
                        }
                        className="w-full h-10 px-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-mono tabular-nums text-sm font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                        dir="ltr"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block">
                        {isAr ? 'تشديد خسارة الرهان الكبير (%)' : 'High-Bet Loss Boost (%)'}
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={5}
                        value={algorithm.highBetLossBoostPercent}
                        onChange={(e) =>
                          setAlgorithm((prev) => ({
                            ...prev,
                            highBetLossBoostPercent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                          }))
                        }
                        className="w-full h-10 px-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-mono tabular-nums text-sm font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                        dir="ltr"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 block">
                      {isAr
                        ? 'سقف صافي ربح اللاعب قبل التشديد التلقائي (0 = معطّل)'
                        : 'Player Net Profit Cap Before Auto-Throttle (0 = Off)'}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={10000000}
                      step={1000}
                      value={algorithm.sessionProfitCapCoins}
                      onChange={(e) =>
                        setAlgorithm((prev) => ({
                          ...prev,
                          sessionProfitCapCoins: Math.max(0, Math.min(10000000, Number(e.target.value) || 0)),
                        }))
                      }
                      className="w-full h-10 px-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 font-mono tabular-nums text-sm font-bold text-neutral-900 dark:text-white focus:outline-none focus:border-amber-500"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex flex-col justify-center">
                <div className="text-sm font-bold text-neutral-900 dark:text-white">
                  {isAr ? 'الوضع التقليدي المباشر نشط' : 'Classic Slider Mode Active'}
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5 leading-relaxed">
                  {isAr
                    ? 'يتم احتساب احتمالات الألعاب اعتماداً على مقبض 0–10 فقط. يمكنك التبديل إلى "الترتيب الذكي" أو "دورة مخصصة" لتفعيل التحكم بالدورات وسقف المضاعف وحماية الرهانات الكبيرة.'
                    : 'Outcomes are weighted strictly via the 0–10 level. Switch to Smart Cycle or Custom Cycle for win/loss ordering and risk guardrails.'}
                </p>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Live 20-Round Simulation & 1,000-Round Projection */}
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
              {isAr ? 'محاكاة ترتيب الجولات القادمة (20 جولة · 1,000 اختبار)' : 'Smart Sequence Simulator (Next 20 · 1,000-Round Projection)'}
            </h4>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
              {isAr
                ? 'معاينة سلوك الخوارزمية وفق الإعدادات المحددة أعلاه دون التأثير على أي رصيد'
                : 'Dry-run simulation of current settings without affecting any live player balances'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => runSimulation()}
            disabled={isSimulating}
            className="px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-950 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            {isSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isAr ? 'تشغيل محاكاة جديدة' : 'Run Simulation'}</span>
          </button>
        </div>

        {simulation ? (
          <div className="p-5 space-y-4">
            {/* Projection Summary Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <div className="text-neutral-500 dark:text-neutral-400">
                  {isAr ? 'نسبة فوز اللاعب المتوقعة' : 'Projected Player Win %'}
                </div>
                <div className="text-base font-black font-mono tabular-nums text-neutral-900 dark:text-white mt-0.5">
                  {simulation.monteCarlo.winRatePercent}%
                </div>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <div className="text-neutral-500 dark:text-neutral-400">
                  {isAr ? 'أفضلية المنصة المتوقعة' : 'Projected House Edge'}
                </div>
                <div
                  className={`text-base font-black font-mono tabular-nums mt-0.5 ${
                    simulation.monteCarlo.houseEdgePercent >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {simulation.monteCarlo.houseEdgePercent}%
                </div>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <div className="text-neutral-500 dark:text-neutral-400">
                  {isAr ? 'متوسط مضاعف الفوز' : 'Avg Win Multiplier'}
                </div>
                <div className="text-base font-black font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                  {simulation.monteCarlo.avgWinMultiplier}x
                </div>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                <div className="text-neutral-500 dark:text-neutral-400">
                  {isAr ? 'صافي المنصة (1,000 × 1,000)' : 'Projected Net (1k rounds)'}
                </div>
                <div
                  className={`text-base font-black font-mono tabular-nums mt-0.5 ${
                    simulation.monteCarlo.projectedHouseProfit >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {simulation.monteCarlo.projectedHouseProfit >= 0
                    ? `+${simulation.monteCarlo.projectedHouseProfit.toLocaleString()}`
                    : simulation.monteCarlo.projectedHouseProfit.toLocaleString()}
                </div>
              </div>
            </div>

            {/* 20-Round Ordered Tiles */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-10 gap-2">
              {simulation.previewRounds.map((r) => {
                const isLoss = r.outcome === 'loss';
                return (
                  <div
                    key={r.round}
                    title={`#${r.round} · ${translateDecisionReason(r.reason, isAr)}`}
                    className={`p-2 rounded-xl border text-center ${
                      isLoss
                        ? 'bg-rose-500/8 border-rose-500/25 text-rose-600 dark:text-rose-400'
                        : r.outcome === 'small_win'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    <div className="text-[10px] font-mono tabular-nums opacity-70">#{r.round}</div>
                    <div className="text-xs font-black font-mono tabular-nums mt-0.5">{r.multiplier}x</div>
                    <div className="text-[10px] font-bold truncate mt-0.5">
                      {isLoss
                        ? isAr
                          ? 'خسارة'
                          : 'Loss'
                        : r.outcome === 'small_win'
                        ? isAr
                          ? 'ربح قليل'
                          : 'Small'
                        : isAr
                        ? 'ربح'
                        : 'Win'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
            {isAr ? 'جاري تحميل محاكاة الخوارزمية...' : 'Loading simulation...'}
          </div>
        )}
      </div>

      {/* Real Recent Outcomes Log Table */}
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-neutral-900 dark:text-white">
            {isAr ? 'سجل آخر القرارات والنتائج الفعلية' : 'Recent Live Algorithm Decisions'}
          </h4>
          <span className="text-[11px] font-mono tabular-nums text-neutral-500 dark:text-neutral-400">
            {isAr
              ? `آخر ${telemetry?.recentOutcomes?.length ?? 0} جولة`
              : `Last ${telemetry?.recentOutcomes?.length ?? 0} rounds`}
          </span>
        </div>

        {telemetry?.recentOutcomes && telemetry.recentOutcomes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-neutral-50 dark:bg-neutral-950 border-b border-neutral-200 dark:border-neutral-800 text-neutral-500 dark:text-neutral-400">
                <tr>
                  <th className="py-2.5 px-4 font-semibold text-start">{isAr ? 'اللعبة' : 'Game'}</th>
                  <th className="py-2.5 px-4 font-semibold text-start">{isAr ? 'الرهان' : 'Bet'}</th>
                  <th className="py-2.5 px-4 font-semibold text-start">{isAr ? 'المضاعف' : 'Mult'}</th>
                  <th className="py-2.5 px-4 font-semibold text-start">{isAr ? 'المدفوع' : 'Payout'}</th>
                  <th className="py-2.5 px-4 font-semibold text-start">{isAr ? 'قرار الخوارزمية' : 'Decision'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {telemetry.recentOutcomes.slice(0, 12).map((item, idx) => (
                  <tr key={`${item.timestamp}-${idx}`} className="hover:bg-neutral-50/70 dark:hover:bg-neutral-950/50">
                    <td className="py-2.5 px-4 font-bold text-neutral-900 dark:text-white whitespace-nowrap">
                      {item.game}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                      {item.betAmount.toLocaleString()}
                    </td>
                    <td
                      className={`py-2.5 px-4 font-mono tabular-nums font-bold whitespace-nowrap ${
                        item.won ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {item.multiplier}x
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-neutral-900 dark:text-white whitespace-nowrap">
                      {item.payout.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-neutral-600 dark:text-neutral-400 whitespace-nowrap">
                      {translateDecisionReason(item.reason, isAr)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs text-neutral-500 dark:text-neutral-400">
            {isAr
              ? 'لا توجد جولات مسجلة حتى الآن — ستظهر قرارات الخوارزمية الفعلية هنا فور لعب المستخدمين.'
              : 'No live rounds recorded yet — algorithm decisions will appear here as players play.'}
          </div>
        )}
      </div>
    </div>
  );
};
