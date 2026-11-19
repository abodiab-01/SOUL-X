import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Brain,
  CheckCircle2,
  Gamepad2,
  Link2,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { Language } from '../types';

export type GameAlgorithmMode =
  | 'smart_cycle'
  | 'custom_sequence'
  | 'house_edge'
  | 'classic_level';

export type CycleOrderPattern = 'smart_shuffle' | 'win_first' | 'loss_first';

export type AiStrategyProfile =
  | 'smart_retention'
  | 'aggressive_drain'
  | 'high_engagement'
  | 'fortress_protection'
  | 'custom';

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

export interface AiGameMonitorConfig {
  enabled: boolean;
  aiVersion: string;
  strategyProfile: AiStrategyProfile;
  bigWinMultiplierTrigger: number;
  bigWinBalanceGainPercent: number;
  postBigWinDrainRounds: number;
  postBigWinLossFocusPercent: number;
  heavyLossStreakTrigger: number;
  heavyLossDrawdownPercent: number;
  comebackMinPercent: number;
  comebackMaxPercent: number;
  comebackTriggerChancePercent: number;
  comebackCooldownRounds: number;
  nearMissTeaserPercent: number;
  antiBoredomSensitivity: number;
  logicalHitIntervalRounds: number;
  logicalHitMinMultiplier: number;
  logicalHitMaxMultiplier: number;
  platformProtectionStrength: number;
  evolutionNotes: string;
  lastEvolvedAt?: string;
}

export interface GameMaintenanceEntry {
  enabled: boolean;
  reasonAr: string;
  reasonEn: string;
  updatedAt?: string;
}

export interface AiMonitoredPlayerRow {
  playerId: string;
  displayId: string;
  userName: string;
  initialBaselineCoins: number;
  currentBalanceCoins: number;
  sessionNetProfit: number;
  rollingNetProfit: number;
  totalRounds: number;
  consecutiveLosses: number;
  consecutiveWins: number;
  postBigWinDrainRemaining: number;
  boredomScore: number;
  aiPhase: string;
  lastOutcomeReason: string;
  lastPlayedAt: string;
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

const DEFAULT_AI_CONFIG: AiGameMonitorConfig = {
  enabled: true,
  aiVersion: '2.0',
  strategyProfile: 'smart_retention',
  bigWinMultiplierTrigger: 3.5,
  bigWinBalanceGainPercent: 25,
  postBigWinDrainRounds: 8,
  postBigWinLossFocusPercent: 80,
  heavyLossStreakTrigger: 5,
  heavyLossDrawdownPercent: 45,
  comebackMinPercent: 20,
  comebackMaxPercent: 70,
  comebackTriggerChancePercent: 38,
  comebackCooldownRounds: 7,
  nearMissTeaserPercent: 32,
  antiBoredomSensitivity: 65,
  logicalHitIntervalRounds: 12,
  logicalHitMinMultiplier: 2.2,
  logicalHitMaxMultiplier: 5.5,
  platformProtectionStrength: 80,
  evolutionNotes:
    'النموذج الافتراضي: مراقبة ذكية للاستنزاف بعد الربح الكبير وتعويض محسوب 20%–70% عند الخسارة المتكررة مع حماية المنصة.',
};

const FALLBACK_AI_PRESETS: Record<
  Exclude<AiStrategyProfile, 'custom'>,
  Partial<AiGameMonitorConfig>
> = {
  smart_retention: {
    bigWinMultiplierTrigger: 3.5,
    bigWinBalanceGainPercent: 25,
    postBigWinDrainRounds: 8,
    postBigWinLossFocusPercent: 80,
    heavyLossStreakTrigger: 5,
    heavyLossDrawdownPercent: 45,
    comebackMinPercent: 20,
    comebackMaxPercent: 70,
    comebackTriggerChancePercent: 38,
    comebackCooldownRounds: 7,
    nearMissTeaserPercent: 32,
    antiBoredomSensitivity: 65,
    logicalHitIntervalRounds: 12,
    logicalHitMinMultiplier: 2.2,
    logicalHitMaxMultiplier: 5.5,
    platformProtectionStrength: 80,
  },
  aggressive_drain: {
    bigWinMultiplierTrigger: 2.5,
    bigWinBalanceGainPercent: 15,
    postBigWinDrainRounds: 12,
    postBigWinLossFocusPercent: 88,
    heavyLossStreakTrigger: 6,
    heavyLossDrawdownPercent: 55,
    comebackMinPercent: 20,
    comebackMaxPercent: 45,
    comebackTriggerChancePercent: 26,
    comebackCooldownRounds: 10,
    nearMissTeaserPercent: 22,
    antiBoredomSensitivity: 55,
    logicalHitIntervalRounds: 16,
    logicalHitMinMultiplier: 1.8,
    logicalHitMaxMultiplier: 3.5,
    platformProtectionStrength: 92,
  },
  high_engagement: {
    bigWinMultiplierTrigger: 4.0,
    bigWinBalanceGainPercent: 35,
    postBigWinDrainRounds: 6,
    postBigWinLossFocusPercent: 72,
    heavyLossStreakTrigger: 4,
    heavyLossDrawdownPercent: 38,
    comebackMinPercent: 25,
    comebackMaxPercent: 70,
    comebackTriggerChancePercent: 48,
    comebackCooldownRounds: 5,
    nearMissTeaserPercent: 45,
    antiBoredomSensitivity: 80,
    logicalHitIntervalRounds: 9,
    logicalHitMinMultiplier: 2.5,
    logicalHitMaxMultiplier: 7.0,
    platformProtectionStrength: 68,
  },
  fortress_protection: {
    bigWinMultiplierTrigger: 2.0,
    bigWinBalanceGainPercent: 10,
    postBigWinDrainRounds: 14,
    postBigWinLossFocusPercent: 92,
    heavyLossStreakTrigger: 7,
    heavyLossDrawdownPercent: 60,
    comebackMinPercent: 20,
    comebackMaxPercent: 35,
    comebackTriggerChancePercent: 20,
    comebackCooldownRounds: 12,
    nearMissTeaserPercent: 18,
    antiBoredomSensitivity: 45,
    logicalHitIntervalRounds: 20,
    logicalHitMinMultiplier: 1.6,
    logicalHitMaxMultiplier: 2.8,
    platformProtectionStrength: 98,
  },
};

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
  const [absoluteStopProfit, setAbsoluteStopProfit] = useState<boolean>(false);
  const [aiMonitor, setAiMonitor] = useState<AiGameMonitorConfig>(DEFAULT_AI_CONFIG);
  const [aiPresets, setAiPresets] =
    useState<Record<Exclude<AiStrategyProfile, 'custom'>, Partial<AiGameMonitorConfig>>>(
      FALLBACK_AI_PRESETS
    );
  const [maintenanceGames, setMaintenanceGames] = useState<Record<string, GameMaintenanceEntry>>(
    {}
  );
  const [maintenanceDraftReasons, setMaintenanceDraftReasons] = useState<
    Record<string, { reasonAr: string; reasonEn: string }>
  >({});
  const [monitoredPlayers, setMonitoredPlayers] = useState<AiMonitoredPlayerRow[]>([]);
  const [connectedGames, setConnectedGames] = useState<ConnectedGameMeta[]>(
    FALLBACK_CONNECTED_GAMES
  );
  const [telemetry, setTelemetry] = useState<GamesAlgorithmTelemetry | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingStopProfit, setIsTogglingStopProfit] = useState(false);
  const [isEvolvingAi, setIsEvolvingAi] = useState(false);
  const [togglingMaintenanceGame, setTogglingMaintenanceGame] = useState<string | null>(null);
  const [resettingPlayerId, setResettingPlayerId] = useState<string | null>(null);
  const [isResettingTelemetry, setIsResettingTelemetry] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showAdvancedAiTuning, setShowAdvancedAiTuning] = useState(true);

  const syncFromPayload = useCallback((data: any) => {
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
    if (typeof data.absoluteStopProfit === 'boolean') {
      setAbsoluteStopProfit(data.absoluteStopProfit);
    } else if (typeof s?.absoluteStopProfit === 'boolean') {
      setAbsoluteStopProfit(s.absoluteStopProfit);
    }

    const nextAi = data.aiMonitor || s?.aiMonitor;
    if (nextAi && typeof nextAi === 'object') {
      setAiMonitor({ ...DEFAULT_AI_CONFIG, ...nextAi });
    }
    if (data.aiPresets && typeof data.aiPresets === 'object') {
      setAiPresets(data.aiPresets);
    }

    const nextMaint = data.maintenanceGames || s?.maintenanceGames;
    if (nextMaint && typeof nextMaint === 'object') {
      setMaintenanceGames(nextMaint);
      setMaintenanceDraftReasons((prev) => {
        const merged = { ...prev };
        for (const [gid, entry] of Object.entries(
          nextMaint as Record<string, GameMaintenanceEntry>
        )) {
          if (!merged[gid]) {
            merged[gid] = {
              reasonAr: entry.reasonAr || 'اللعبة تحت الصيانة والتطوير حالياً، يرجى المحاولة لاحقاً',
              reasonEn:
                entry.reasonEn ||
                'This game is currently under maintenance for development. Please check back soon.',
            };
          }
        }
        return merged;
      });
    }

    if (Array.isArray(data.monitoredPlayers)) {
      setMonitoredPlayers(data.monitoredPlayers);
    }
    if (Array.isArray(data.connectedGames) && data.connectedGames.length > 0) {
      setConnectedGames(data.connectedGames);
    }
    if (data.telemetry) {
      setTelemetry(data.telemetry);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/games/settings', {
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        syncFromPayload(data);
        setHasUnsavedChanges(false);
      }
    } catch {
      // silent fallback
    } finally {
      setIsLoading(false);
    }
  }, [getAdminHeaders, syncFromPayload]);

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
          absoluteStopProfit,
          aiMonitor,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        showToast('error', data?.message || (isAr ? 'فشل حفظ الإعدادات' : 'Failed to save settings'));
        return;
      }
      syncFromPayload(data);
      setHasUnsavedChanges(false);
      showToast(
        'success',
        data.message ||
          (isAr
            ? 'تم حفظ خوارزمية الربح ونظام الذكاء الاصطناعي على جميع الألعاب بنجاح'
            : 'Unified algorithm and AI Monitor applied to all games')
      );
    } catch {
      showToast('error', isAr ? 'تعذر الاتصال بالسيرفر' : 'Server connection failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAbsoluteStopProfit = async () => {
    const nextEnabled = !absoluteStopProfit;
    setIsTogglingStopProfit(true);
    try {
      const res = await fetch('/api/admin/games/absolute-stop-profit', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        showToast(
          'error',
          data?.message || (isAr ? 'فشل تغيير إيقاف الربح القطعي' : 'Failed to toggle stop profit')
        );
        return;
      }
      setAbsoluteStopProfit(Boolean(data.absoluteStopProfit));
      showToast('success', data.message);
    } catch {
      showToast('error', isAr ? 'تعذر الاتصال بالسيرفر' : 'Server connection failed');
    } finally {
      setIsTogglingStopProfit(false);
    }
  };

  const handleToggleMaintenance = async (gameId: string, nextEnabled: boolean) => {
    setTogglingMaintenanceGame(gameId);
    const draft = maintenanceDraftReasons[gameId];
    const currentEntry = maintenanceGames[gameId];
    try {
      const res = await fetch('/api/admin/games/maintenance', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          gameId,
          enabled: nextEnabled,
          reasonAr:
            draft?.reasonAr ||
            currentEntry?.reasonAr ||
            'اللعبة تحت الصيانة والتطوير حالياً، يرجى المحاولة لاحقاً',
          reasonEn:
            draft?.reasonEn ||
            currentEntry?.reasonEn ||
            'This game is currently under maintenance for development. Please check back soon.',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        showToast(
          'error',
          data?.message || (isAr ? 'فشل تحديث وضع الصيانة' : 'Failed to update maintenance')
        );
        return;
      }
      if (data.maintenanceGames) {
        setMaintenanceGames(data.maintenanceGames);
      }
      showToast('success', data.message);
    } catch {
      showToast('error', isAr ? 'تعذر الاتصال بالسيرفر' : 'Server connection failed');
    } finally {
      setTogglingMaintenanceGame(null);
    }
  };

  const handleAutoEvolveAi = async (profileOverride?: AiStrategyProfile) => {
    setIsEvolvingAi(true);
    try {
      const res = await fetch('/api/admin/games/ai/evolve', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(
          profileOverride && profileOverride !== 'custom'
            ? { strategyProfile: profileOverride }
            : {}
        ),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        showToast(
          'error',
          data?.message || (isAr ? 'فشل تطوير نظام الذكاء الاصطناعي' : 'AI evolution failed')
        );
        return;
      }
      if (data.aiMonitor) {
        setAiMonitor({ ...DEFAULT_AI_CONFIG, ...data.aiMonitor });
      }
      setHasUnsavedChanges(false);
      showToast('success', isAr ? data.message : data.summaryEn || data.message);
    } catch {
      showToast('error', isAr ? 'تعذر الاتصال بالسيرفر' : 'Server connection failed');
    } finally {
      setIsEvolvingAi(false);
    }
  };

  const handleResetAiPlayer = async (playerId?: string) => {
    setResettingPlayerId(playerId || '__ALL__');
    try {
      const res = await fetch('/api/admin/games/ai/reset-player', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(playerId ? { playerId } : {}),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        if (Array.isArray(data.monitoredPlayers)) {
          setMonitoredPlayers(data.monitoredPlayers);
        }
        showToast('success', data.message);
      } else {
        showToast('error', data?.message || (isAr ? 'فشل إعادة الضبط' : 'Reset failed'));
      }
    } catch {
      showToast('error', isAr ? 'تعذر الاتصال بالسيرفر' : 'Server connection failed');
    } finally {
      setResettingPlayerId(null);
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
        setMonitoredPlayers([]);
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

  const updateAiField = <K extends keyof AiGameMonitorConfig>(
    key: K,
    value: AiGameMonitorConfig[K],
    markCustom = true
  ) => {
    setAiMonitor((prev) => ({
      ...prev,
      [key]: value,
      ...(markCustom && key !== 'enabled' && key !== 'strategyProfile'
        ? { strategyProfile: 'custom' as AiStrategyProfile }
        : {}),
    }));
    setHasUnsavedChanges(true);
  };

  const selectAiProfile = (profile: AiStrategyProfile) => {
    if (profile === 'custom') {
      updateAiField('strategyProfile', 'custom', false);
      return;
    }
    const presetValues = aiPresets[profile] || FALLBACK_AI_PRESETS[profile] || {};
    setAiMonitor((prev) => ({
      ...prev,
      ...presetValues,
      strategyProfile: profile,
    }));
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

  const aiProfileCards: Array<{
    id: Exclude<AiStrategyProfile, 'custom'>;
    titleAr: string;
    titleEn: string;
    descAr: string;
    descEn: string;
  }> = [
    {
      id: 'smart_retention',
      titleAr: 'الاحتفاظ الذكي (متوازن)',
      titleEn: 'Smart Retention',
      descAr: 'استنزاف بعد الربح الكبير + تعويض 20%–70% عند الخسارة المتكررة',
      descEn: 'Post-win drain + 20%–70% calculated comeback',
    },
    {
      id: 'aggressive_drain',
      titleAr: 'استنزاف وحماية مشددة',
      titleEn: 'Aggressive Drain',
      descAr: 'تركيز 88% على الخسارة بعد أي ربح + تعويضات محدودة',
      descEn: '88% post-win loss focus + tighter comebacks',
    },
    {
      id: 'high_engagement',
      titleAr: 'إثارة عالية ومنع ملل',
      titleEn: 'High Engagement',
      descAr: 'شعور دائم بالربح القريب وضربات منطقية متقاربة',
      descEn: 'Frequent near-win teasers & logical hits',
    },
    {
      id: 'fortress_protection',
      titleAr: 'حماية الحصن للمنصة',
      titleEn: 'Fortress Protection',
      descAr: 'درع حماية 98% لرأس مال المنصة مع طُعم خفيف',
      descEn: '98% platform shield with minimal teasers',
    },
  ];

  const getAiPhaseBadge = (phase: string) => {
    switch (phase) {
      case 'absolute_stop_profit':
        return {
          label: isAr ? 'إيقاف قطعي 0%' : 'Kill Switch 0%',
          cls: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25',
        };
      case 'post_big_win_drain':
        return {
          label: isAr ? 'استنزاف بعد ربح كبير' : 'Post-Big-Win Drain',
          cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
        };
      case 'comeback_recovery':
        return {
          label: isAr ? 'تعويض 20–70% محسوب' : 'Comeback 20–70%',
          cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
        };
      case 'logical_hit':
        return {
          label: isAr ? 'ضربة منطقية' : 'Logical Hit',
          cls: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/25',
        };
      case 'near_miss_teaser':
        return {
          label: isAr ? 'شعور بالربح القريب' : 'Near-Win Teaser',
          cls: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/25',
        };
      case 'platform_shield':
        return {
          label: isAr ? 'درع حماية المنصة' : 'Platform Shield',
          cls: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/25',
        };
      default:
        return {
          label: isAr ? 'مراقبة نشطة' : 'Observing',
          cls: 'bg-neutral-500/15 text-neutral-600 dark:text-neutral-300 border-neutral-500/25',
        };
    }
  };

  return (
    <div className="space-y-5">
      {/* =================================================================== */}
      {/* 1. ABSOLUTE ZERO-PROFIT KILL SWITCH (FINAL OVERRIDE ACROSS ALL GAMES) */}
      {/* =================================================================== */}
      <div
        className={`p-5 rounded-3xl border transition-all ${
          absoluteStopProfit
            ? 'bg-rose-500/10 dark:bg-rose-950/30 border-rose-500/50 shadow-sm'
            : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                absoluteStopProfit
                  ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-500/25'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
              }`}
            >
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-neutral-900 dark:text-white">
                  {isAr
                    ? 'زر الإيقاف القطعي والنهائي للربح (جميع الألعاب)'
                    : 'Absolute Zero-Profit Kill Switch (All Games)'}
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                    absoluteStopProfit
                      ? 'bg-rose-600 text-white border-rose-500'
                      : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                  }`}
                >
                  {absoluteStopProfit
                    ? isAr
                      ? 'مُفعّل — ربح 0% نهائياً'
                      : 'ACTIVE — 0% PROFIT'
                    : isAr
                    ? 'غير مُفعّل — الربح يعمل حسب الخوارزمية'
                    : 'INACTIVE — Normal Algorithm'}
                </span>
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 mt-1 leading-relaxed">
                {isAr
                  ? 'عند التفعيل يتم إيقاف أي ربح أو عائد بشكل نهائي وقطعي في كافة الألعاب (بما فيها البونص وشراء البونص وفتح الصناديق والألغام) وتصبح نسبة الربح 0% فوراً دون الحاجة لتعديل الخوارزمية.'
                  : 'When enabled, ALL payouts and wins are strictly forced to 0% permanently across every game (including Free Spins, Buy Bonus, Mines, and Boxes).'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleAbsoluteStopProfit}
            disabled={isTogglingStopProfit || isLoading}
            className={`px-5 py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shrink-0 transition-all cursor-pointer disabled:opacity-50 ${
              absoluteStopProfit
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-500/20'
            }`}
          >
            {isTogglingStopProfit ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4" />
            )}
            <span>
              {absoluteStopProfit
                ? isAr
                  ? 'إلغاء الإيقاف القطعي وإعادة التشغيل'
                  : 'Disable Kill Switch'
                : isAr
                ? 'إيقاف الربح نهائياً وقطعياً'
                : 'Stop All Profit Now'}
            </span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. MAIN UNIFIED PROFIT ALGORITHM CARD                               */}
      {/* =================================================================== */}
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
                {absoluteStopProfit && (
                  <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                    {isAr ? 'متجاوز حالياً بالإيقاف القطعي' : 'Overridden by Kill Switch'}
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
                  ? `الألعاب المرتبطة بالخوارزمية والذكاء الاصطناعي (${connectedGames.length})`
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
            {connectedGames.map((g) => {
              const inMaint = Boolean(maintenanceGames[g.id]?.enabled);
              return (
                <span
                  key={g.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                    inMaint
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                      : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      inMaint ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                  />
                  <span>{isAr ? g.nameAr : g.nameEn}</span>
                  {inMaint && (
                    <span className="text-[10px] font-extrabold opacity-90">
                      ({isAr ? 'صيانة' : 'Maint.'})
                    </span>
                  )}
                </span>
              );
            })}
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
                  className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
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

      {/* =================================================================== */}
      {/* 3. AI PLAYER MONITORING & EVOLUTION SYSTEM                          */}
      {/* =================================================================== */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/25 shrink-0">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                  {isAr
                    ? 'نظام الذكاء الاصطناعي لمراقبة اللاعب واللعب'
                    : 'AI Player Behavior Monitor & Adaptive Engine'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25">
                  v{aiMonitor.aiVersion || '2.0'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                    aiMonitor.enabled
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25'
                      : 'bg-neutral-500/15 text-neutral-500 dark:text-neutral-400 border-neutral-500/25'
                  }`}
                >
                  {aiMonitor.enabled
                    ? isAr
                      ? 'مُفعّل بجانب الخوارزمية'
                      : 'Active Alongside Algorithm'
                    : isAr
                    ? 'معطّل حالياً'
                    : 'Disabled'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                {isAr
                  ? 'يراقب رصيد كل لاعب البدائي وحالته: بعد الربح الكبير يركز على الخسارة مع أرباح صغيرة/متوسطة، وعند الخسارة الكبيرة والمتكررة يعوّض أحياناً بين 20%–70% من رصيده البدائي مع زرع الشعور الدائم بالربح القريب وحماية المنصة.'
                  : 'Monitors baseline balance and gameplay: shifts to drain after big wins, delivers occasional 20%–70% baseline comebacks on heavy repeated losses, prevents boredom with near-win feels and calculated logical hits.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => updateAiField('enabled', !aiMonitor.enabled, false)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition-all cursor-pointer ${
                aiMonitor.enabled
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {aiMonitor.enabled
                  ? isAr
                    ? 'إلغاء تفعيل الذكاء'
                    : 'Disable AI'
                  : isAr
                  ? 'تفعيل الذكاء الاصطناعي'
                  : 'Enable AI'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleAutoEvolveAi()}
              disabled={isEvolvingAi || isLoading}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isEvolvingAi ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              <span>{isAr ? 'تطوير الذكاء الاصطناعي تلقائياً' : 'Auto-Evolve AI'}</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="px-4 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:opacity-90 text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isAr ? 'حفظ التعديلات' : 'Save AI'}</span>
            </button>
          </div>
        </div>

        {/* Evolution Notes Banner */}
        {aiMonitor.evolutionNotes && (
          <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2.5 text-xs text-indigo-900 dark:text-indigo-200">
              <Sparkles className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">
                  {isAr ? 'ملاحظات التطوير الحالية: ' : 'Current AI Evolution Notes: '}
                </span>
                <span>{aiMonitor.evolutionNotes}</span>
              </div>
            </div>
            {aiMonitor.lastEvolvedAt && (
              <span className="text-[11px] font-medium text-indigo-600/80 dark:text-indigo-300/80">
                {new Date(aiMonitor.lastEvolvedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
              </span>
            )}
          </div>
        )}

        {/* Strategy Profiles */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
              {isAr ? 'أنماط سلوك الذكاء الاصطناعي (قابلة للتطوير والتخصيص)' : 'AI Behavior Profiles'}
            </span>
            <button
              type="button"
              onClick={() => setShowAdvancedAiTuning((v) => !v)}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              {showAdvancedAiTuning
                ? isAr
                  ? 'إخفاء مؤشرات التطوير التفصيلية'
                  : 'Hide Tuning Sliders'
                : isAr
                ? 'إظهار مؤشرات التطوير التفصيلية'
                : 'Show Tuning Sliders'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {aiProfileCards.map((card) => {
              const selected = aiMonitor.strategyProfile === card.id;
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => selectAiProfile(card.id)}
                  className={`p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                    selected
                      ? 'bg-indigo-500/10 border-indigo-500 text-indigo-950 dark:text-indigo-100 shadow-sm'
                      : 'bg-neutral-50 dark:bg-neutral-800/40 border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/40 text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  <div className="text-xs font-extrabold">
                    {isAr ? card.titleAr : card.titleEn}
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                    {isAr ? card.descAr : card.descEn}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Tunable AI Parameters */}
        {showAdvancedAiTuning && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Group A: Post-Big-Win Drain */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-amber-700 dark:text-amber-300">
                <Activity className="w-4 h-4" />
                <span>{isAr ? 'أ) الاستنزاف بعد الربح الكبير' : 'A) Post-Big-Win Drain'}</span>
              </div>

              <label className="block space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                  <span>{isAr ? 'مضاعف الربح الكبير (x)' : 'Big Win Trigger (x)'}</span>
                  <span className="text-neutral-900 dark:text-white">
                    {aiMonitor.bigWinMultiplierTrigger}x
                  </span>
                </div>
                <input
                  type="range"
                  min={1.5}
                  max={15}
                  step={0.5}
                  value={aiMonitor.bigWinMultiplierTrigger}
                  onChange={(e) =>
                    updateAiField('bigWinMultiplierTrigger', Number(e.target.value))
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                  <span>{isAr ? 'أو زيادة الرصيد البدائي (%)' : 'Or Balance Gain (%)'}</span>
                  <span className="text-neutral-900 dark:text-white">
                    +{aiMonitor.bigWinBalanceGainPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={aiMonitor.bigWinBalanceGainPercent}
                  onChange={(e) =>
                    updateAiField('bigWinBalanceGainPercent', Number(e.target.value))
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                  <span>{isAr ? 'جولات التركيز على الخسارة' : 'Drain Rounds Count'}</span>
                  <span className="text-neutral-900 dark:text-white">
                    {aiMonitor.postBigWinDrainRounds}
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={25}
                  step={1}
                  value={aiMonitor.postBigWinDrainRounds}
                  onChange={(e) =>
                    updateAiField('postBigWinDrainRounds', Number(e.target.value))
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                  <span>{isAr ? 'شدة التركيز على الخسارة (%)' : 'Loss Focus Intensity (%)'}</span>
                  <span className="text-neutral-900 dark:text-white">
                    {aiMonitor.postBigWinLossFocusPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={96}
                  step={2}
                  value={aiMonitor.postBigWinLossFocusPercent}
                  onChange={(e) =>
                    updateAiField('postBigWinLossFocusPercent', Number(e.target.value))
                  }
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </label>
            </div>

            {/* Group B: Heavy Loss Comeback (20% - 70% of initial baseline) */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-700 dark:text-emerald-300">
                <Sparkles className="w-4 h-4" />
                <span>
                  {isAr ? 'ب) تعويض الخسارة من الرصيد البدائي' : 'B) Baseline Loss Comeback'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 block">
                    {isAr ? 'أدنى تعويض %' : 'Min Comeback %'}
                  </span>
                  <input
                    type="number"
                    min={5}
                    max={65}
                    value={aiMonitor.comebackMinPercent}
                    onChange={(e) =>
                      updateAiField(
                        'comebackMinPercent',
                        Math.max(5, Math.min(65, Number(e.target.value) || 20))
                      )
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs font-black text-neutral-900 dark:text-white"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 block">
                    {isAr ? 'أقصى تعويض %' : 'Max Comeback %'}
                  </span>
                  <input
                    type="number"
                    min={15}
                    max={85}
                    value={aiMonitor.comebackMaxPercent}
                    onChange={(e) =>
                      updateAiField(
                        'comebackMaxPercent',
                        Math.max(
                          aiMonitor.comebackMinPercent,
                          Math.min(85, Number(e.target.value) || 70)
                        )
                      )
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs font-black text-neutral-900 dark:text-white"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                  <span>{isAr ? 'سلسلة خسائر محفزة' : 'Loss Streak Trigger'}</span>
                  <span className="text-neutral-900 dark:text-white">
                    {aiMonitor.heavyLossStreakTrigger}
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={12}
                  step={1}
                  value={aiMonitor.heavyLossStreakTrigger}
                  onChange={(e) =>
                    updateAiField('heavyLossStreakTrigger', Number(e.target.value))
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                  <span>{isAr ? 'أو هبوط من البدائي (%)' : 'Or Drawdown (%)'}</span>
                  <span className="text-neutral-900 dark:text-white">
                    -{aiMonitor.heavyLossDrawdownPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={85}
                  step={5}
                  value={aiMonitor.heavyLossDrawdownPercent}
                  onChange={(e) =>
                    updateAiField('heavyLossDrawdownPercent', Number(e.target.value))
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                  <span>{isAr ? 'احتمال التعويض أحياناً (%)' : 'Comeback Chance (%)'}</span>
                  <span className="text-neutral-900 dark:text-white">
                    {aiMonitor.comebackTriggerChancePercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={85}
                  step={1}
                  value={aiMonitor.comebackTriggerChancePercent}
                  onChange={(e) =>
                    updateAiField('comebackTriggerChancePercent', Number(e.target.value))
                  }
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </label>
            </div>

            {/* Group C: Anti-Boredom, Near-Win, Logical Hits & Platform Shield */}
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/50 border border-neutral-200 dark:border-neutral-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-indigo-700 dark:text-indigo-300">
                <Brain className="w-4 h-4" />
                <span>
                  {isAr ? 'ج) منع الملل وحماية المنصة' : 'C) Anti-Boredom & Shield'}
                </span>
              </div>

              <label className="block space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                  <span>{isAr ? 'شعور الربح القريب (%)' : 'Near-Win Teaser (%)'}</span>
                  <span className="text-neutral-900 dark:text-white">
                    {aiMonitor.nearMissTeaserPercent}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={70}
                  step={2}
                  value={aiMonitor.nearMissTeaserPercent}
                  onChange={(e) =>
                    updateAiField('nearMissTeaserPercent', Number(e.target.value))
                  }
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                  <span>{isAr ? 'فاصل الضربة المنطقية (جولات)' : 'Logical Hit Interval'}</span>
                  <span className="text-neutral-900 dark:text-white">
                    {aiMonitor.logicalHitIntervalRounds}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={30}
                  step={1}
                  value={aiMonitor.logicalHitIntervalRounds}
                  onChange={(e) =>
                    updateAiField('logicalHitIntervalRounds', Number(e.target.value))
                  }
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 block">
                    {isAr ? 'أدنى ضربة (x)' : 'Min Hit (x)'}
                  </span>
                  <input
                    type="number"
                    min={1.3}
                    max={10}
                    step={0.1}
                    value={aiMonitor.logicalHitMinMultiplier}
                    onChange={(e) =>
                      updateAiField(
                        'logicalHitMinMultiplier',
                        Math.max(1.3, Math.min(10, Number(e.target.value) || 2.2))
                      )
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs font-black text-neutral-900 dark:text-white"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 block">
                    {isAr ? 'أقصى ضربة (x)' : 'Max Hit (x)'}
                  </span>
                  <input
                    type="number"
                    min={1.8}
                    max={20}
                    step={0.1}
                    value={aiMonitor.logicalHitMaxMultiplier}
                    onChange={(e) =>
                      updateAiField(
                        'logicalHitMaxMultiplier',
                        Math.max(
                          aiMonitor.logicalHitMinMultiplier,
                          Math.min(20, Number(e.target.value) || 5.5)
                        )
                      )
                    }
                    className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-300 dark:border-neutral-700 text-xs font-black text-neutral-900 dark:text-white"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                  <span>{isAr ? 'قوة حماية المنصة (%)' : 'Platform Shield (%)'}</span>
                  <span className="text-neutral-900 dark:text-white">
                    {aiMonitor.platformProtectionStrength}%
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={2}
                  value={aiMonitor.platformProtectionStrength}
                  onChange={(e) =>
                    updateAiField('platformProtectionStrength', Number(e.target.value))
                  }
                  className="w-full accent-purple-600 cursor-pointer"
                />
              </label>
            </div>
          </div>
        )}

        {/* Monitored Players Real-time Table */}
        <div className="space-y-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-extrabold text-neutral-800 dark:text-neutral-100">
              <Users className="w-4 h-4 text-indigo-500" />
              <span>
                {isAr
                  ? `اللاعبون تحت مراقبة الذكاء الاصطناعي (${monitoredPlayers.length})`
                  : `AI Monitored Players (${monitoredPlayers.length})`}
              </span>
            </div>
            {monitoredPlayers.length > 0 && (
              <button
                type="button"
                onClick={() => handleResetAiPlayer()}
                disabled={resettingPlayerId === '__ALL__'}
                className="px-3 py-1 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-[11px] font-bold text-neutral-600 dark:text-neutral-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{isAr ? 'إعادة ضبط الكل' : 'Reset All Profiles'}</span>
              </button>
            )}
          </div>

          {monitoredPlayers.length === 0 ? (
            <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-500 dark:text-neutral-400 text-center">
              {isAr
                ? 'لا توجد جلسات لعب نشطة قيد المراقبة حالياً — ستظهر هنا تلقائياً فور بدء أي لاعب بالجولة الأولى.'
                : 'No active player sessions recorded yet — players will appear here as soon as they play.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-xs text-start">
                <thead className="bg-neutral-50 dark:bg-neutral-950/80 text-neutral-500 dark:text-neutral-400">
                  <tr>
                    <th className="py-2.5 px-3 font-bold">{isAr ? 'اللاعب' : 'Player'}</th>
                    <th className="py-2.5 px-3 font-bold">
                      {isAr ? 'الرصيد البدائي' : 'Initial Baseline'}
                    </th>
                    <th className="py-2.5 px-3 font-bold">
                      {isAr ? 'الرصيد الحالي' : 'Current Bal.'}
                    </th>
                    <th className="py-2.5 px-3 font-bold">{isAr ? 'صافي الجلسة' : 'Session Net'}</th>
                    <th className="py-2.5 px-3 font-bold">{isAr ? 'الملل / الخسائر' : 'Boredom / Streak'}</th>
                    <th className="py-2.5 px-3 font-bold">{isAr ? 'الحالة الذكية' : 'AI Phase'}</th>
                    <th className="py-2.5 px-3 font-bold text-center">
                      {isAr ? 'إجراء' : 'Action'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {monitoredPlayers.slice(0, 15).map((p) => {
                    const phaseBadge = getAiPhaseBadge(p.aiPhase);
                    return (
                      <tr
                        key={p.playerId}
                        className="bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                      >
                        <td className="py-2 px-3">
                          <div className="font-bold text-neutral-900 dark:text-white">
                            {p.userName}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            #{p.displayId} · {p.totalRounds} {isAr ? 'جولة' : 'r'}
                          </div>
                        </td>
                        <td className="py-2 px-3 font-semibold text-neutral-700 dark:text-neutral-200">
                          {p.initialBaselineCoins.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 font-semibold text-neutral-900 dark:text-white">
                          {p.currentBalanceCoins.toLocaleString()}
                        </td>
                        <td
                          className={`py-2 px-3 font-black ${
                            p.sessionNetProfit >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {p.sessionNetProfit >= 0 ? '+' : ''}
                          {p.sessionNetProfit.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-neutral-600 dark:text-neutral-300">
                          <div>{p.boredomScore}% {isAr ? 'ملل' : 'boredom'}</div>
                          <div className="text-[10px] text-neutral-500">
                            {p.consecutiveLosses > 0
                              ? `${p.consecutiveLosses} ${isAr ? 'خسارة متتالية' : 'losses'}`
                              : `${p.consecutiveWins} ${isAr ? 'ربح متتالي' : 'wins'}`}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${phaseBadge.cls}`}
                          >
                            {phaseBadge.label}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleResetAiPlayer(p.playerId)}
                            disabled={resettingPlayerId === p.playerId}
                            className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-indigo-500/15 hover:text-indigo-600 text-[11px] font-bold text-neutral-600 dark:text-neutral-300 cursor-pointer disabled:opacity-50"
                          >
                            {isAr ? 'تصفير' : 'Reset'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4. PER-GAME MAINTENANCE MODE CONTROL                                */}
      {/* =================================================================== */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/25 shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-neutral-900 dark:text-white">
                {isAr
                  ? 'وضع الصيانة والتطوير لكل لعبة على حدة'
                  : 'Per-Game Maintenance & Development Mode'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {isAr
                  ? 'أوقف أي لعبة مؤقتاً عن المستخدمين أثناء الصيانة أو التطوير وأعد تشغيلها بضغطة زر'
                  : 'Temporarily pause any specific game for users during maintenance or development'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {connectedGames.map((game) => {
            const entry = maintenanceGames[game.id];
            const isInMaint = Boolean(entry?.enabled);
            const draft = maintenanceDraftReasons[game.id] || {
              reasonAr:
                entry?.reasonAr || 'اللعبة تحت الصيانة والتطوير حالياً، يرجى المحاولة لاحقاً',
              reasonEn:
                entry?.reasonEn ||
                'This game is currently under maintenance for development. Please check back soon.',
            };
            const busy = togglingMaintenanceGame === game.id;

            return (
              <div
                key={game.id}
                className={`p-4 rounded-2xl border space-y-3 transition-all ${
                  isInMaint
                    ? 'bg-amber-500/5 border-amber-500/40'
                    : 'bg-neutral-50 dark:bg-neutral-950/50 border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        isInMaint ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                      }`}
                    />
                    <span className="text-sm font-black text-neutral-900 dark:text-white truncate">
                      {isAr ? game.nameAr : game.nameEn}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black border shrink-0 ${
                        isInMaint
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                      }`}
                    >
                      {isInMaint
                        ? isAr
                          ? 'تحت الصيانة'
                          : 'Maintenance'
                        : isAr
                        ? 'متاحة للاعبين'
                        : 'Live'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleMaintenance(game.id, !isInMaint)}
                    disabled={busy}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer disabled:opacity-50 shrink-0 ${
                      isInMaint
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                    }`}
                  >
                    {busy ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : isInMaint ? (
                      isAr ? (
                        'إلغاء الصيانة'
                      ) : (
                        'Resume Game'
                      )
                    ) : isAr ? (
                      'تفعيل الصيانة'
                    ) : (
                      'Set Maintenance'
                    )}
                  </button>
                </div>

                <input
                  type="text"
                  value={isAr ? draft.reasonAr : draft.reasonEn}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMaintenanceDraftReasons((prev) => ({
                      ...prev,
                      [game.id]: {
                        ...draft,
                        ...(isAr ? { reasonAr: val } : { reasonEn: val }),
                      },
                    }));
                  }}
                  placeholder={
                    isAr ? 'رسالة الصيانة للمستخدمين...' : 'Maintenance notice shown to users...'
                  }
                  className="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-xs text-neutral-700 dark:text-neutral-200"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 5. COMPACT LIVE TELEMETRY + RECENT ROUNDS                           */}
      {/* =================================================================== */}
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
            <table className="w-full text-xs text-start">
              <thead className="bg-neutral-50 dark:bg-neutral-950/80 text-neutral-500 dark:text-neutral-400">
                <tr>
                  <th className="py-2.5 px-3 font-bold">{isAr ? 'اللعبة' : 'Game'}</th>
                  <th className="py-2.5 px-3 font-bold">{isAr ? 'الرهان' : 'Bet'}</th>
                  <th className="py-2.5 px-3 font-bold">{isAr ? 'المضاعف' : 'Multiplier'}</th>
                  <th className="py-2.5 px-3 font-bold">{isAr ? 'العائد' : 'Payout'}</th>
                  <th className="py-2.5 px-3 font-bold">{isAr ? 'القرار الذكي' : 'AI Decision'}</th>
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
                    <td className="py-2 px-3 text-[11px] font-mono text-neutral-500 dark:text-neutral-400">
                      {row.reason || '-'}
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
