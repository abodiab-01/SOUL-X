import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  Mail,
  Megaphone,
  Play,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  Users,
  Video,
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
  longTermHouseEdgePercent?: number;
  smartAntiBoredomEnabled?: boolean;
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

export type AdModeIntensity = 'balanced_drama' | 'high_climax' | 'steady_climb';

export interface AdModeConfig {
  enabled: boolean;
  targetEmails: string[];
  intensity: AdModeIntensity;
  balanceDropTriggerPercent: number;
  lossStreakForRebound: number;
  strongWinMinMultiplier: number;
  strongWinMaxMultiplier: number;
  bigHitMinMultiplier: number;
  bigHitMaxMultiplier: number;
  nearMissBeforeHitChance: number;
  maxWinCapMultiplier: number;
  notes?: string;
}

export interface AdModeResolvedUser {
  email: string;
  found: boolean;
  userId?: string;
  displayId?: string;
  name?: string;
  coinsBalance?: number;
}

export interface AiMonitoredPlayerRow {
  playerId: string;
  displayId: string;
  userName: string;
  email?: string;
  isAdModeTarget?: boolean;
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

interface SimulationPreviewResult {
  sequence: Array<{
    round: number;
    won: boolean;
    multiplier: number;
    payout: number;
    tier: string;
    reason: string;
  }>;
  summary1000: {
    rounds: number;
    wins: number;
    losses: number;
    winRatePercent: number;
    houseEdgePercent: number;
    projectedHouseProfitCoins: number;
    avgWinMultiplier: number;
  };
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

const DEFAULT_ALGORITHM: SmartAlgorithmSettings = {
  algorithmMode: 'smart_cycle',
  targetWinRatePercent: 40,
  maxAllowedMultiplier: 10,
  smallWinBiasPercent: 68,
  cycleWinsCount: 2,
  cycleLossesCount: 3,
  cycleOrderPattern: 'smart_shuffle',
  maxConsecutiveWins: 2,
  highBetThreshold: 10000,
  highBetLossBoostPercent: 50,
  sessionProfitCapCoins: 25000,
  lossRecoveryIntensity: 55,
  longTermHouseEdgePercent: 16,
  smartAntiBoredomEnabled: true,
};

const DEFAULT_AI_CONFIG: AiGameMonitorConfig = {
  enabled: true,
  aiVersion: '3.0',
  strategyProfile: 'smart_retention',
  bigWinMultiplierTrigger: 4.0,
  bigWinBalanceGainPercent: 35,
  postBigWinDrainRounds: 5,
  postBigWinLossFocusPercent: 65,
  heavyLossStreakTrigger: 4,
  heavyLossDrawdownPercent: 35,
  comebackMinPercent: 25,
  comebackMaxPercent: 60,
  comebackTriggerChancePercent: 42,
  comebackCooldownRounds: 5,
  nearMissTeaserPercent: 38,
  antiBoredomSensitivity: 78,
  logicalHitIntervalRounds: 8,
  logicalHitMinMultiplier: 1.8,
  logicalHitMaxMultiplier: 4.2,
  platformProtectionStrength: 65,
  evolutionNotes:
    'النموذج الذكي v3.0: وتيرة أرباح حيوية تمنع الملل مع ضامن خسارة مضمونة على المدى الطويل لصالح المنصة.',
};

const FALLBACK_AI_PRESETS: Record<
  Exclude<AiStrategyProfile, 'custom'>,
  Partial<AiGameMonitorConfig>
> = {
  smart_retention: {
    bigWinMultiplierTrigger: 4.0,
    bigWinBalanceGainPercent: 35,
    postBigWinDrainRounds: 5,
    postBigWinLossFocusPercent: 65,
    heavyLossStreakTrigger: 4,
    heavyLossDrawdownPercent: 35,
    comebackMinPercent: 25,
    comebackMaxPercent: 60,
    comebackTriggerChancePercent: 42,
    comebackCooldownRounds: 5,
    nearMissTeaserPercent: 38,
    antiBoredomSensitivity: 78,
    logicalHitIntervalRounds: 8,
    logicalHitMinMultiplier: 1.8,
    logicalHitMaxMultiplier: 4.2,
    platformProtectionStrength: 65,
  },
  aggressive_drain: {
    bigWinMultiplierTrigger: 3.0,
    bigWinBalanceGainPercent: 22,
    postBigWinDrainRounds: 7,
    postBigWinLossFocusPercent: 76,
    heavyLossStreakTrigger: 5,
    heavyLossDrawdownPercent: 45,
    comebackMinPercent: 20,
    comebackMaxPercent: 48,
    comebackTriggerChancePercent: 34,
    comebackCooldownRounds: 7,
    nearMissTeaserPercent: 30,
    antiBoredomSensitivity: 68,
    logicalHitIntervalRounds: 11,
    logicalHitMinMultiplier: 1.6,
    logicalHitMaxMultiplier: 3.2,
    platformProtectionStrength: 82,
  },
  high_engagement: {
    bigWinMultiplierTrigger: 5.5,
    bigWinBalanceGainPercent: 45,
    postBigWinDrainRounds: 4,
    postBigWinLossFocusPercent: 56,
    heavyLossStreakTrigger: 3,
    heavyLossDrawdownPercent: 28,
    comebackMinPercent: 35,
    comebackMaxPercent: 72,
    comebackTriggerChancePercent: 55,
    comebackCooldownRounds: 4,
    nearMissTeaserPercent: 48,
    antiBoredomSensitivity: 88,
    logicalHitIntervalRounds: 6,
    logicalHitMinMultiplier: 2.0,
    logicalHitMaxMultiplier: 5.2,
    platformProtectionStrength: 55,
  },
  fortress_protection: {
    bigWinMultiplierTrigger: 2.8,
    bigWinBalanceGainPercent: 18,
    postBigWinDrainRounds: 8,
    postBigWinLossFocusPercent: 80,
    heavyLossStreakTrigger: 5,
    heavyLossDrawdownPercent: 50,
    comebackMinPercent: 18,
    comebackMaxPercent: 42,
    comebackTriggerChancePercent: 28,
    comebackCooldownRounds: 8,
    nearMissTeaserPercent: 26,
    antiBoredomSensitivity: 62,
    logicalHitIntervalRounds: 12,
    logicalHitMinMultiplier: 1.4,
    logicalHitMaxMultiplier: 2.6,
    platformProtectionStrength: 88,
  },
};

const DEFAULT_AD_MODE: AdModeConfig = {
  enabled: true,
  targetEmails: ['abohaidar@soul-x.com'],
  intensity: 'balanced_drama',
  balanceDropTriggerPercent: 18,
  lossStreakForRebound: 2,
  strongWinMinMultiplier: 3.5,
  strongWinMaxMultiplier: 9.5,
  bigHitMinMultiplier: 7,
  bigHitMaxMultiplier: 20,
  nearMissBeforeHitChance: 60,
  maxWinCapMultiplier: 26,
  notes: 'وضع الإعلان والترويج لتصوير الفيديوهات.',
};

const FALLBACK_AD_MODE_PRESETS: Record<AdModeIntensity, Partial<AdModeConfig>> = {
  balanced_drama: {
    balanceDropTriggerPercent: 18,
    lossStreakForRebound: 2,
    strongWinMinMultiplier: 3.5,
    strongWinMaxMultiplier: 9.5,
    bigHitMinMultiplier: 7,
    bigHitMaxMultiplier: 20,
    nearMissBeforeHitChance: 60,
    maxWinCapMultiplier: 26,
  },
  high_climax: {
    balanceDropTriggerPercent: 12,
    lossStreakForRebound: 2,
    strongWinMinMultiplier: 5,
    strongWinMaxMultiplier: 14,
    bigHitMinMultiplier: 12,
    bigHitMaxMultiplier: 32,
    nearMissBeforeHitChance: 70,
    maxWinCapMultiplier: 40,
  },
  steady_climb: {
    balanceDropTriggerPercent: 22,
    lossStreakForRebound: 1,
    strongWinMinMultiplier: 2.5,
    strongWinMaxMultiplier: 6.5,
    bigHitMinMultiplier: 5,
    bigHitMaxMultiplier: 13,
    nearMissBeforeHitChance: 45,
    maxWinCapMultiplier: 16,
  },
};

interface SmartPreset {
  id: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  recommended?: boolean;
  algorithmMode: GameAlgorithmMode;
  profitLevel: number;
  targetWinRatePercent: number;
  maxAllowedMultiplier: number;
  longTermHouseEdgePercent: number;
  smallWinBiasPercent: number;
}

const SMART_PRESETS: SmartPreset[] = [
  {
    id: 'strict_profit',
    nameAr: 'ربح صارم للمنصة',
    nameEn: 'Strict House Margin',
    descAr: 'تحصيل سريع للمنصة مع نبضات ربح صغيرة تحفظ اللعب',
    descEn: 'Higher house margin with light micro-wins to keep sessions active',
    algorithmMode: 'smart_cycle',
    profitLevel: 3,
    targetWinRatePercent: 34,
    maxAllowedMultiplier: 6,
    longTermHouseEdgePercent: 22,
    smallWinBiasPercent: 76,
  },
  {
    id: 'smart_balanced',
    nameAr: 'توازن ذكي',
    nameEn: 'Smart Balanced',
    descAr: 'أرباح حيوية وتدفق مريح يمنع الملل مع خسارة مضمونة على المدى الطويل',
    descEn: 'Lively wins to prevent boredom with guaranteed long-term house margin',
    recommended: true,
    algorithmMode: 'smart_cycle',
    profitLevel: 5,
    targetWinRatePercent: 42,
    maxAllowedMultiplier: 12,
    longTermHouseEdgePercent: 16,
    smallWinBiasPercent: 68,
  },
  {
    id: 'high_excitement',
    nameAr: 'تشويق ومفاجآت',
    nameEn: 'High Excitement',
    descAr: 'وتيرة فوز عالية ومضاعفات ممتعة مع حماية ثابتة للمنصة',
    descEn: 'Frequent wins & exciting multipliers under a fixed house edge',
    algorithmMode: 'smart_cycle',
    profitLevel: 7,
    targetWinRatePercent: 48,
    maxAllowedMultiplier: 20,
    longTermHouseEdgePercent: 12,
    smallWinBiasPercent: 60,
  },
  {
    id: 'player_retention',
    nameAr: 'استبقاء اللاعبين',
    nameEn: 'Player Retention',
    descAr: 'أعلى وتيرة فوز وتنشيط للجلسات مع ربح طويل الأمد مضمون 10%',
    descEn: 'Maximum session warmth & retention with guaranteed 10% long-term edge',
    algorithmMode: 'house_edge',
    profitLevel: 7,
    targetWinRatePercent: 52,
    maxAllowedMultiplier: 15,
    longTermHouseEdgePercent: 10,
    smallWinBiasPercent: 72,
  },
];

const MULTIPLIER_QUICK_CHIPS = [3, 6, 10, 15, 25, 50];

export const AdminGamesAlgorithmControl: React.FC<AdminGamesAlgorithmControlProps> = ({
  lang,
  getAdminHeaders,
  showToast,
  externalRefreshSignal,
}) => {
  const isAr = lang === 'ar';

  const [profitLevel, setProfitLevel] = useState<number>(5);
  const [algorithm, setAlgorithm] = useState<SmartAlgorithmSettings>(DEFAULT_ALGORITHM);
  const [absoluteStopProfit, setAbsoluteStopProfit] = useState<boolean>(false);
  const [aiMonitor, setAiMonitor] = useState<AiGameMonitorConfig>(DEFAULT_AI_CONFIG);
  const [aiPresets, setAiPresets] =
    useState<Record<Exclude<AiStrategyProfile, 'custom'>, Partial<AiGameMonitorConfig>>>(
      FALLBACK_AI_PRESETS
    );
  const [adMode, setAdMode] = useState<AdModeConfig>(DEFAULT_AD_MODE);
  const [adModePresets, setAdModePresets] =
    useState<Record<AdModeIntensity, Partial<AdModeConfig>>>(FALLBACK_AD_MODE_PRESETS);
  const [adModeResolvedUsers, setAdModeResolvedUsers] = useState<AdModeResolvedUser[]>([]);
  const [newAdEmailInput, setNewAdEmailInput] = useState('');
  const [isUpdatingAdMode, setIsUpdatingAdMode] = useState(false);
  const [monitoredPlayers, setMonitoredPlayers] = useState<AiMonitoredPlayerRow[]>([]);
  const [maintenanceGames, setMaintenanceGames] = useState<Record<string, GameMaintenanceEntry>>({});
  const [maintenanceDraftReasons, setMaintenanceDraftReasons] = useState<
    Record<string, { reasonAr: string; reasonEn: string }>
  >({});
  const [connectedGames, setConnectedGames] = useState<ConnectedGameMeta[]>(FALLBACK_CONNECTED_GAMES);
  const [telemetry, setTelemetry] = useState<GamesAlgorithmTelemetry | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<'control' | 'ai' | 'ad_mode' | 'maintenance'>(
    'control'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTogglingStopProfit, setIsTogglingStopProfit] = useState(false);
  const [isEvolvingAi, setIsEvolvingAi] = useState(false);
  const [togglingMaintenanceGame, setTogglingMaintenanceGame] = useState<string | null>(null);
  const [resettingPlayerId, setResettingPlayerId] = useState<string | null>(null);
  const [isResettingTelemetry, setIsResettingTelemetry] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [showExpertControls, setShowExpertControls] = useState(false);
  const [showAdvancedAiTuning, setShowAdvancedAiTuning] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<SimulationPreviewResult | null>(null);

  const syncFromPayload = useCallback((data: any) => {
    const s = data.settings;
    const algo = data.algorithm || s?.algorithm;
    if (s && typeof s.plinkoProfitLevel === 'number') {
      setProfitLevel(s.plinkoProfitLevel);
    }
    if (algo && typeof algo === 'object') {
      setAlgorithm({
        ...DEFAULT_ALGORITHM,
        ...algo,
        longTermHouseEdgePercent:
          typeof algo.longTermHouseEdgePercent === 'number'
            ? algo.longTermHouseEdgePercent
            : DEFAULT_ALGORITHM.longTermHouseEdgePercent,
        smartAntiBoredomEnabled:
          typeof algo.smartAntiBoredomEnabled === 'boolean'
            ? algo.smartAntiBoredomEnabled
            : true,
      });
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

    const nextAd = data.adMode || s?.adMode;
    if (nextAd && typeof nextAd === 'object') {
      setAdMode({ ...DEFAULT_AD_MODE, ...nextAd });
    }
    if (data.adModePresets && typeof data.adModePresets === 'object') {
      setAdModePresets(data.adModePresets);
    }
    if (Array.isArray(data.adModeResolvedUsers)) {
      setAdModeResolvedUsers(data.adModeResolvedUsers);
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

  const updateAlgo = (patch: Partial<SmartAlgorithmSettings>) => {
    setAlgorithm((prev) => ({ ...prev, ...patch }));
    setHasUnsavedChanges(true);
  };

  const applyPreset = (preset: SmartPreset) => {
    const wins = preset.targetWinRatePercent >= 48 ? 3 : preset.targetWinRatePercent >= 32 ? 2 : 1;
    const losses = Math.max(
      1,
      Math.min(10, Math.round((wins * (100 - preset.targetWinRatePercent)) / Math.max(10, preset.targetWinRatePercent)))
    );
    setProfitLevel(preset.profitLevel);
    setAlgorithm((prev) => ({
      ...prev,
      algorithmMode: preset.algorithmMode,
      targetWinRatePercent: preset.targetWinRatePercent,
      maxAllowedMultiplier: preset.maxAllowedMultiplier,
      longTermHouseEdgePercent: preset.longTermHouseEdgePercent,
      smallWinBiasPercent: preset.smallWinBiasPercent,
      cycleWinsCount: wins,
      cycleLossesCount: losses,
      maxConsecutiveWins: preset.targetWinRatePercent >= 48 ? 3 : 2,
      smartAntiBoredomEnabled: true,
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/games/settings', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          simplified: !showExpertControls,
          unifiedProfitLevel: profitLevel,
          targetWinRatePercent: algorithm.targetWinRatePercent,
          maxAllowedMultiplier: algorithm.maxAllowedMultiplier,
          longTermHouseEdgePercent: algorithm.longTermHouseEdgePercent ?? 16,
          algorithm,
          absoluteStopProfit,
          aiMonitor,
          adMode,
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
            ? 'تم حفظ خوارزمية الألعاب وضامن الربح الطويل الأمد على جميع الألعاب بنجاح'
            : 'Smart algorithm and long-term house edge saved across all games')
      );
    } catch {
      showToast('error', isAr ? 'تعذر الاتصال بالسيرفر' : 'Server connection failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/admin/games/algorithm/simulate', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify({
          unifiedProfitLevel: profitLevel,
          algorithm,
          longTermHouseEdgePercent: algorithm.longTermHouseEdgePercent ?? 16,
          sampleBet: 1000,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setSimResult({
          sequence: Array.isArray(data.sequence) ? data.sequence : [],
          summary1000: data.summary1000,
        });
      } else {
        showToast('error', data?.message || (isAr ? 'فشل تشغيل المحاكاة' : 'Simulation failed'));
      }
    } catch {
      showToast('error', isAr ? 'تعذر الاتصال بالسيرفر' : 'Server connection failed');
    } finally {
      setIsSimulating(false);
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
          data?.message || (isAr ? 'فشل تغيير إيقاف الربح القطعي' : 'Failed to toggle kill switch')
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

  const handleUpdateAdMode = async (
    payload: Record<string, unknown>,
    clearInputOnSuccess = false
  ) => {
    setIsUpdatingAdMode(true);
    try {
      const res = await fetch('/api/admin/games/ad-mode', {
        method: 'POST',
        headers: getAdminHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        showToast(
          'error',
          data?.message || (isAr ? 'فشل تحديث وضع الإعلان' : 'Failed to update Ad Mode')
        );
        return;
      }
      if (data.adMode) {
        setAdMode({ ...DEFAULT_AD_MODE, ...data.adMode });
      }
      if (Array.isArray(data.adModeResolvedUsers)) {
        setAdModeResolvedUsers(data.adModeResolvedUsers);
      }
      if (Array.isArray(data.monitoredPlayers)) {
        setMonitoredPlayers(data.monitoredPlayers);
      }
      if (clearInputOnSuccess) {
        setNewAdEmailInput('');
      }
      showToast('success', data.message);
    } catch {
      showToast('error', isAr ? 'تعذر الاتصال بالسيرفر' : 'Server connection failed');
    } finally {
      setIsUpdatingAdMode(false);
    }
  };

  const handleSelectAdIntensity = (intensity: AdModeIntensity) => {
    const preset = adModePresets[intensity] || FALLBACK_AD_MODE_PRESETS[intensity] || {};
    setAdMode((prev) => ({
      ...prev,
      ...preset,
      intensity,
    }));
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

  const activePresetId = SMART_PRESETS.find(
    (p) =>
      p.targetWinRatePercent === algorithm.targetWinRatePercent &&
      p.maxAllowedMultiplier === algorithm.maxAllowedMultiplier &&
      p.longTermHouseEdgePercent === (algorithm.longTermHouseEdgePercent ?? 16) &&
      p.algorithmMode === algorithm.algorithmMode
  )?.id;

  const houseEdgePercent = Math.max(8, Math.min(40, Number(algorithm.longTermHouseEdgePercent ?? 16)));
  const maxRtpPercent = Math.max(60, Math.min(92, 100 - houseEdgePercent));

  const actualWinRate =
    telemetry && telemetry.totalRounds > 0
      ? Math.round((telemetry.totalWins / telemetry.totalRounds) * 1000) / 10
      : 0;
  const realizedHouseEdge =
    telemetry && telemetry.totalWageredCoins > 0
      ? Math.round((telemetry.houseNetProfitCoins / telemetry.totalWageredCoins) * 1000) / 10
      : 0;

  const activeMaintenanceCount = Object.values(maintenanceGames).filter((g) => g?.enabled).length;

  const phaseLabel = (phase: string) => {
    if (isAr) {
      switch (phase) {
        case 'ad_mode_showtime':
          return 'وضع الإعلان';
        case 'post_big_win_drain':
          return 'استنزاف بعد ربح';
        case 'comeback_recovery':
          return 'تعويض ذكي';
        case 'logical_hit':
          return 'نبضة تنشيط';
        case 'platform_shield':
          return 'حماية المنصة';
        default:
          return 'طبيعي متوازن';
      }
    }
    return phase.replace(/_/g, ' ');
  };

  const modeOptions: Array<{
    id: GameAlgorithmMode;
    titleAr: string;
    titleEn: string;
    hintAr: string;
    hintEn: string;
  }> = [
    {
      id: 'smart_cycle',
      titleAr: 'الدورة الذكية',
      titleEn: 'Smart Cycle',
      hintAr: 'توزيع ذكي متوازن للأرباح والخسائر يمنع الملل — موصى به',
      hintEn: 'Balanced win/loss cadence preventing player fatigue — Recommended',
    },
    {
      id: 'house_edge',
      titleAr: 'الأفضلية الاحتمالية',
      titleEn: 'Probabilistic Edge',
      hintAr: 'احتمال رياضي مرن مع شرارات كسر الملل وحماية الهامش',
      hintEn: 'Adaptive probability with anti-boredom sparks & margin lock',
    },
    {
      id: 'classic_level',
      titleAr: 'مستوى الحظ (0-10)',
      titleEn: 'Classic Level',
      hintAr: 'مستوى حظ كلاسيكي محكوم بهامش ربح طويل الأمد للمنصة',
      hintEn: 'Classic 0-10 luck curve governed by long-term house edge',
    },
    {
      id: 'custom_sequence',
      titleAr: 'دورة مخصصة',
      titleEn: 'Custom Sequence',
      hintAr: 'عدد فوز وخسارة ثابت في كل دورة مع ضمان ربح المنصة',
      hintEn: 'Fixed wins/losses per cycle with long-term profit protection',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Main Architectural Header Card */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Sliders className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-neutral-900 dark:text-white tracking-tight">
                  {isAr ? 'التحكم الذكي بخوارزمية الألعاب' : 'Smart Games Algorithm Studio'}
                </h2>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 tabular-nums">
                  {isAr
                    ? `ضامن ربح المنصة: ${houseEdgePercent}%`
                    : `House Edge Lock: ${houseEdgePercent}%`}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {isAr
                  ? 'أرباح حيوية وتدفق طبيعي يمنع ملل اللاعبين — مع خسارة مضمونة على المدى الطويل لصالح المنصة في جميع الأوضاع.'
                  : 'Engaging short-term win cadence to eliminate boredom — backed by guaranteed long-term house edge across all modes.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleToggleAbsoluteStopProfit}
              disabled={isTogglingStopProfit}
              className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 ${
                absoluteStopProfit
                  ? 'bg-red-600 text-white border-red-700'
                  : 'bg-neutral-50 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700 hover:border-red-400'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>
                {absoluteStopProfit
                  ? isAr
                    ? 'إيقاف قطعي مفعّل (0%)'
                    : 'Kill Switch ON (0%)'
                  : isAr
                  ? 'إيقاف الربح (0%)'
                  : 'Kill Switch'}
              </span>
            </button>

            <button
              type="button"
              onClick={fetchSettings}
              disabled={isLoading}
              title={isAr ? 'تحديث البيانات' : 'Refresh'}
              className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 ${
                hasUnsavedChanges
                  ? 'bg-amber-500 hover:bg-amber-600 text-neutral-950'
                  : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 hover:opacity-90'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>
                {isSaving
                  ? isAr
                    ? 'جاري الحفظ...'
                    : 'Saving...'
                  : hasUnsavedChanges
                  ? isAr
                    ? 'حفظ وتطبيق الآن'
                    : 'Save & Apply'
                  : isAr
                  ? 'حفظ الإعدادات'
                  : 'Save Settings'}
              </span>
            </button>
          </div>
        </div>

        {/* Connected Games Strip */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-neutral-100 dark:border-neutral-800 text-[11px] text-neutral-500">
          <span className="font-semibold text-neutral-700 dark:text-neutral-300 me-1">
            {isAr ? 'الألعاب المتصلة:' : 'Connected:'}
          </span>
          {connectedGames.map((g) => {
            const underMaint = Boolean(maintenanceGames[g.id]?.enabled);
            return (
              <span
                key={g.id}
                className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${
                  underMaint
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                    : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                {isAr ? g.nameAr : g.nameEn}
                {underMaint ? (isAr ? ' (صيانة)' : ' (Maint)') : ''}
              </span>
            );
          })}
        </div>

        {/* Top Telemetry KPI Strip (4 Clean Flat Cells) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60">
            <div className="text-[11px] font-medium text-neutral-500">
              {isAr ? 'إجمالي الجولات' : 'Total Rounds'}
            </div>
            <div className="text-lg font-extrabold text-neutral-900 dark:text-white tabular-nums mt-0.5">
              {(telemetry?.totalRounds || 0).toLocaleString()}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60">
            <div className="text-[11px] font-medium text-neutral-500">
              {isAr ? 'معدل الفوز الفعلي' : 'Observed Win Rate'}
            </div>
            <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">
              {actualWinRate}%
            </div>
          </div>

          <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60">
            <div className="text-[11px] font-medium text-neutral-500">
              {isAr ? 'إجمالي الرهانات' : 'Total Wagered'}
            </div>
            <div className="text-lg font-extrabold text-neutral-900 dark:text-white tabular-nums mt-0.5">
              {(telemetry?.totalWageredCoins || 0).toLocaleString()}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60">
            <div className="flex items-center justify-between text-[11px] font-medium text-neutral-500">
              <span>{isAr ? 'صافي ربح المنصة' : 'House Net Profit'}</span>
              <span className="tabular-nums font-bold text-neutral-600 dark:text-neutral-300">
                {realizedHouseEdge}%
              </span>
            </div>
            <div
              className={`text-lg font-extrabold tabular-nums mt-0.5 ${
                (telemetry?.houseNetProfitCoins || 0) >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500'
              }`}
            >
              {(telemetry?.houseNetProfitCoins || 0) >= 0 ? '+' : ''}
              {(telemetry?.houseNetProfitCoins || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Hairline Sub-Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto pt-1">
          {[
            { id: 'control', ar: 'التحكم المبسط والربح', en: 'Smart Control', icon: Sliders },
            { id: 'ai', ar: 'المراقب الذكي AI', en: 'AI Monitor', icon: Brain },
            { id: 'ad_mode', ar: 'وضع الإعلان والترويج', en: 'Promo / Ad Mode', icon: Megaphone },
            { id: 'maintenance', ar: 'الصيانة والسجل', en: 'Maintenance & Log', icon: Wrench },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
                className={`px-3.5 py-2.5 text-xs font-bold flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-amber-500 text-neutral-900 dark:text-white'
                    : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-amber-500' : ''}`} />
                <span>{isAr ? tab.ar : tab.en}</span>
                {tab.id === 'maintenance' && activeMaintenanceCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] tabular-nums">
                    {activeMaintenanceCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Kill-Switch Warning */}
      {absoluteStopProfit && (
        <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs font-bold text-red-700 dark:text-red-300">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              {isAr
                ? 'وضع الإيقاف القطعي مفعّل: جميع الألعاب تعطي 0% ربح حالياً باستثناء حسابات وضع الإعلان.'
                : 'Kill Switch Active: All games currently pay 0% except Ad Mode accounts.'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleAbsoluteStopProfit}
            className="px-3 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold cursor-pointer shrink-0"
          >
            {isAr ? 'إيقاف الآن' : 'Turn Off'}
          </button>
        </div>
      )}

      {/* =======================================================
          TAB 1: SIMPLIFIED SMART ALGORITHM STUDIO
      ======================================================== */}
      {activeSubTab === 'control' && (
        <div className="space-y-4">
          {/* 1. Smart 1-Click Presets */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-extrabold text-neutral-900 dark:text-white">
                  {isAr ? 'أوضاع احترافية جاهزة (بنقرة واحدة)' : 'Quick Smart Presets'}
                </h3>
              </div>
              <span className="text-[11px] text-neutral-500">
                {isAr
                  ? 'اختر نمط التشغيل وسيتم ضبط المعادلات تلقائياً'
                  : 'Select a strategy preset to configure parameters automatically'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {SMART_PRESETS.map((preset) => {
                const isSelected = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`p-3.5 rounded-xl border text-start transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/20'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/50 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-xs font-extrabold text-neutral-900 dark:text-white">
                          {isAr ? preset.nameAr : preset.nameEn}
                        </span>
                        {preset.recommended && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-neutral-950">
                            {isAr ? 'موصى به' : 'Best'}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                        {isAr ? preset.descAr : preset.descEn}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-2 border-t border-neutral-200/70 dark:border-neutral-800 text-[10px] font-mono tabular-nums">
                      <div>
                        <span className="text-neutral-400 block">{isAr ? 'الفوز' : 'Win'}</span>
                        <span className="font-bold text-neutral-800 dark:text-neutral-200">
                          {preset.targetWinRatePercent}%
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block">{isAr ? 'السقف' : 'Cap'}</span>
                        <span className="font-bold text-neutral-800 dark:text-neutral-200">
                          {preset.maxAllowedMultiplier}x
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-400 block">{isAr ? 'ربح المنصة' : 'Edge'}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          +{preset.longTermHouseEdgePercent}%
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Three Essential Sliders */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Control A: Player Win Cadence */}
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-neutral-900 dark:text-white">
                  {isAr ? 'وتيرة فوز اللاعب' : 'Player Win Rate'}
                </span>
                <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                  {algorithm.targetWinRatePercent}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={75}
                step={1}
                value={algorithm.targetWinRatePercent}
                onChange={(e) => {
                  const rate = Number(e.target.value);
                  const wins = rate <= 0 ? 0 : rate >= 52 ? 3 : rate >= 32 ? 2 : 1;
                  const losses =
                    rate <= 0 ? 8 : Math.max(1, Math.min(10, Math.round((wins * (100 - rate)) / Math.max(10, rate))));
                  updateAlgo({
                    targetWinRatePercent: rate,
                    cycleWinsCount: wins,
                    cycleLossesCount: losses,
                    maxConsecutiveWins: rate >= 48 ? 3 : rate >= 28 ? 2 : 1,
                  });
                }}
                className="w-full accent-amber-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 font-mono tabular-nums">
                <span>0%</span>
                <span>{isAr ? 'موصى به 36%–50%' : 'Optimal 36%–50%'}</span>
                <span>75%</span>
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                {isAr
                  ? 'رفع وتيرة الفوز يمنح اللاعبين ضربات صغيرة ممتعة تمنع الملل، بينما يتكفل ضامن المنصة بحساب الربح الصافي.'
                  : 'Higher win cadence delivers engaging frequent hits while the house governor safeguards net margin.'}
              </p>
            </div>

            {/* Control B: Guaranteed Long-Term House Edge */}
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-neutral-900 dark:text-white">
                  {isAr ? 'ربح المنصة المضمون (طويل الأمد)' : 'Guaranteed House Edge'}
                </span>
                <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                  {houseEdgePercent}%
                </span>
              </div>
              <input
                type="range"
                min={8}
                max={40}
                step={1}
                value={houseEdgePercent}
                onChange={(e) => updateAlgo({ longTermHouseEdgePercent: Number(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-neutral-400 font-mono tabular-nums">
                <span>8% (RTP 92%)</span>
                <span>16% (RTP 84%)</span>
                <span>40% (RTP 60%)</span>
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed">
                {isAr
                  ? `يعمل في جميع الأوضاع: الحد الأقصى لعودة الأموال للاعب (RTP) هو ${maxRtpPercent}% لضمان خسارة تراكمية مضمونة.`
                  : `Active in ALL modes: caps long-term player RTP at ${maxRtpPercent}% so the house always profits over time.`}
              </p>
            </div>

            {/* Control C: Max Allowed Multiplier */}
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-neutral-900 dark:text-white">
                  {isAr ? 'سقف المضاعف الأقصى' : 'Max Multiplier Cap'}
                </span>
                <span className="text-lg font-extrabold text-neutral-900 dark:text-white font-mono tabular-nums">
                  {algorithm.maxAllowedMultiplier}x
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {MULTIPLIER_QUICK_CHIPS.map((chip) => {
                  const selected = algorithm.maxAllowedMultiplier === chip;
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => updateAlgo({ maxAllowedMultiplier: chip })}
                      className={`py-1.5 rounded-lg text-xs font-bold font-mono tabular-nums border cursor-pointer transition-colors ${
                        selected
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 border-neutral-900 dark:border-white'
                          : 'bg-neutral-50 dark:bg-neutral-950 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400'
                      }`}
                    >
                      {chip}x
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[11px] text-neutral-500 shrink-0">
                  {isAr ? 'قيمة مخصصة:' : 'Custom:'}
                </span>
                <input
                  type="number"
                  min={1.2}
                  max={100}
                  step={0.5}
                  value={algorithm.maxAllowedMultiplier}
                  onChange={(e) =>
                    updateAlgo({
                      maxAllowedMultiplier: Math.max(1.2, Math.min(100, Number(e.target.value) || 10)),
                    })
                  }
                  className="w-24 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-xs font-bold font-mono tabular-nums text-neutral-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* 3. Engine Mode Selector + 1000-Round Monte Carlo Simulator */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Algorithm Mode Selector */}
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-neutral-900 dark:text-white">
                  {isAr ? 'نمط توزيع الجولات' : 'Outcome Engine Mode'}
                </span>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  {isAr ? 'محمي بضامن المنصة في جميع الأوضاع' : 'Protected across all modes'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {modeOptions.map((m) => {
                  const selected = algorithm.algorithmMode === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => updateAlgo({ algorithmMode: m.id })}
                      className={`p-3 rounded-xl border text-start cursor-pointer transition-colors ${
                        selected
                          ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20'
                          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 hover:border-neutral-300'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-neutral-900 dark:text-white">
                        {isAr ? m.titleAr : m.titleEn}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
                        {isAr ? m.hintAr : m.hintEn}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live 1000-Round Simulator */}
            <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-extrabold text-neutral-900 dark:text-white">
                    {isAr ? 'محاكاة 1,000 جولة حية (معاينة النتيجة)' : 'Live 1,000-Round Simulator'}
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    {isAr
                      ? 'اختبر الإعدادات الحالية قبل الحفظ للتأكد من الأرباح والهامش.'
                      : 'Test your current settings before saving to verify hit rate & profit.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  className="px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>
                    {isSimulating
                      ? isAr
                        ? 'جاري الاختبار...'
                        : 'Running...'
                      : isAr
                      ? 'اختبر الآن'
                      : 'Run Test'}
                  </span>
                </button>
              </div>

              {simResult ? (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                      <div className="text-[10px] text-neutral-500">
                        {isAr ? 'معدل فوز اللاعب' : 'Player Win Rate'}
                      </div>
                      <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400 font-mono tabular-nums">
                        {simResult.summary1000.winRatePercent}%
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                      <div className="text-[10px] text-neutral-500">
                        {isAr ? 'متوسط الفوز' : 'Avg Win Mult'}
                      </div>
                      <div className="text-sm font-extrabold text-neutral-900 dark:text-white font-mono tabular-nums">
                        {simResult.summary1000.avgWinMultiplier}x
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                      <div className="text-[10px] text-neutral-500">
                        {isAr ? 'ربح المنصة الصافي' : 'House Edge'}
                      </div>
                      <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                        +{simResult.summary1000.houseEdgePercent}%
                      </div>
                    </div>
                  </div>

                  {/* 15-round sample ribbon */}
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-neutral-500">
                      {isAr ? 'عينة لأول 15 جولة متتالية:' : 'Sample 15-round sequence:'}
                    </div>
                    <div className="flex flex-wrap gap-1 font-mono tabular-nums">
                      {simResult.sequence.slice(0, 15).map((r) => (
                        <span
                          key={r.round}
                          title={`#${r.round} — ${r.reason}`}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            r.won
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                              : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500'
                          }`}
                        >
                          {r.won ? `${r.multiplier}x` : 'L'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 py-6 text-center text-xs text-neutral-400">
                  {isAr
                    ? 'اضغط "اختبر الآن" لعرض توزيع الفوز والربح الصافي على 1,000 جولة.'
                    : 'Click "Run Test" to simulate 1,000 rounds with these settings.'}
                </div>
              )}
            </div>
          </div>

          {/* 4. Collapsible Expert Tuning Accordion */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowExpertControls((v) => !v)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-extrabold text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>
                  {isAr
                    ? 'إعدادات متقدمة للخبراء (الدورة، سقف الرهان، مكافحة الملل)'
                    : 'Advanced Expert Tuning (Cycle, Bet Thresholds, Anti-Boredom)'}
                </span>
              </span>
              {showExpertControls ? (
                <ChevronUp className="w-4 h-4 text-neutral-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-neutral-400" />
              )}
            </button>

            {showExpertControls && (
              <div className="p-4 pt-3 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="space-y-1 text-xs">
                  <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                    {isAr ? 'مستوى الحظ الموحد (0–10)' : 'Unified Profit Level (0–10)'}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={profitLevel}
                    onChange={(e) => {
                      setProfitLevel(Math.max(0, Math.min(10, Number(e.target.value) || 0)));
                      setHasUnsavedChanges(true);
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 font-bold font-mono tabular-nums"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                    {isAr ? 'نسبة الانحياز للأرباح الصغيرة (%)' : 'Small Win Bias (%)'}
                  </span>
                  <input
                    type="number"
                    min={20}
                    max={95}
                    value={algorithm.smallWinBiasPercent}
                    onChange={(e) =>
                      updateAlgo({ smallWinBiasPercent: Math.max(20, Math.min(95, Number(e.target.value) || 68)) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 font-bold font-mono tabular-nums"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                    {isAr ? 'أقصى ربح متتالي' : 'Max Consecutive Wins'}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={algorithm.maxConsecutiveWins}
                    onChange={(e) =>
                      updateAlgo({ maxConsecutiveWins: Math.max(1, Math.min(6, Number(e.target.value) || 2)) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 font-bold font-mono tabular-nums"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                    {isAr ? 'حد الرهان العالي (Coins)' : 'High Bet Threshold'}
                  </span>
                  <input
                    type="number"
                    min={500}
                    step={500}
                    value={algorithm.highBetThreshold}
                    onChange={(e) =>
                      updateAlgo({ highBetThreshold: Math.max(500, Number(e.target.value) || 10000) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 font-bold font-mono tabular-nums"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                    {isAr ? 'مرات الفوز بالدورة' : 'Cycle Wins Count'}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={algorithm.cycleWinsCount}
                    onChange={(e) =>
                      updateAlgo({ cycleWinsCount: Math.max(0, Math.min(15, Number(e.target.value) || 0)) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 font-bold font-mono tabular-nums"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                    {isAr ? 'مرات الخسارة بالدورة' : 'Cycle Losses Count'}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={algorithm.cycleLossesCount}
                    onChange={(e) =>
                      updateAlgo({ cycleLossesCount: Math.max(1, Math.min(25, Number(e.target.value) || 3)) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 font-bold font-mono tabular-nums"
                  />
                </label>

                <label className="space-y-1 text-xs">
                  <span className="font-semibold text-neutral-600 dark:text-neutral-300">
                    {isAr ? 'تعويض الخسارة المتتالية (%)' : 'Loss Recovery (%)'}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={algorithm.lossRecoveryIntensity}
                    onChange={(e) =>
                      updateAlgo({ lossRecoveryIntensity: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 font-bold font-mono tabular-nums"
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() =>
                      updateAlgo({ smartAntiBoredomEnabled: !algorithm.smartAntiBoredomEnabled })
                    }
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer ${
                      algorithm.smartAntiBoredomEnabled !== false
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-500'
                    }`}
                  >
                    <span>{isAr ? 'شرارات منع الملل' : 'Anti-Boredom Sparks'}</span>
                    <span>{algorithm.smartAntiBoredomEnabled !== false ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================
          TAB 2: AI GAME MONITOR
      ======================================================== */}
      {activeSubTab === 'ai' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Brain className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-neutral-900 dark:text-white">
                      {isAr ? 'المراقب الذكي للاعبين' : 'AI Player Monitor'}
                    </h3>
                    <span className="text-[11px] font-mono tabular-nums font-bold text-neutral-500">
                      v{aiMonitor.aiVersion}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500">{aiMonitor.evolutionNotes}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateAiField('enabled', !aiMonitor.enabled, false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                    aiMonitor.enabled
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                      : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500'
                  }`}
                >
                  {aiMonitor.enabled ? (isAr ? 'مفعّل' : 'Enabled') : isAr ? 'معطّل' : 'Disabled'}
                </button>

                <button
                  type="button"
                  onClick={() => handleAutoEvolveAi()}
                  disabled={isEvolvingAi}
                  className="px-3.5 py-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-extrabold cursor-pointer disabled:opacity-60"
                >
                  {isEvolvingAi
                    ? isAr
                      ? 'جاري التطوير...'
                      : 'Evolving...'
                    : isAr
                    ? 'تطوير تلقائي من البيانات'
                    : 'Auto-Evolve AI'}
                </button>
              </div>
            </div>

            {/* 4 Clean AI Strategy Profiles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {(
                [
                  {
                    id: 'smart_retention',
                    ar: 'استبقاء ذكي (موصى به)',
                    en: 'Smart Retention',
                    descAr: 'تعويض ذكي وتنشيط دوري مع استنزاف لطيف بعد الربح',
                    descEn: 'Balanced comebacks with gentle post-win drain',
                  },
                  {
                    id: 'high_engagement',
                    ar: 'تفاعل ومكافآت عالية',
                    en: 'High Engagement',
                    descAr: 'تدخل سريع ضد الملل ونبضات ربح أكثر',
                    descEn: 'Fast anti-boredom triggers & frequent sparks',
                  },
                  {
                    id: 'aggressive_drain',
                    ar: 'تحصيل متشدد',
                    en: 'Strict Collection',
                    descAr: 'استرجاع أسرع للمنصة بعد أي ضربة قوية للاعب',
                    descEn: 'Faster collection after big player hits',
                  },
                  {
                    id: 'fortress_protection',
                    ar: 'حماية قصوى للمنصة',
                    en: 'Fortress Shield',
                    descAr: 'أولوية قصوى لحماية خزينة المنصة على كل الحسابات',
                    descEn: 'Maximum vault protection priority',
                  },
                ] as const
              ).map((prof) => {
                const selected = aiMonitor.strategyProfile === prof.id;
                return (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => selectAiProfile(prof.id)}
                    className={`p-3 rounded-xl border text-start cursor-pointer transition-colors ${
                      selected
                        ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/50 hover:border-neutral-300'
                    }`}
                  >
                    <div className="text-xs font-extrabold text-neutral-900 dark:text-white">
                      {isAr ? prof.ar : prof.en}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-1">{isAr ? prof.descAr : prof.descEn}</div>
                  </button>
                );
              })}
            </div>

            {/* Collapsible AI Detailed Tuning */}
            <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvancedAiTuning((v) => !v)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-neutral-700 dark:text-neutral-300 bg-neutral-50/70 dark:bg-neutral-950/50 cursor-pointer"
              >
                <span>{isAr ? 'تعديل أرقام المراقب الذكي يدوياً' : 'Fine-Tune AI Parameters'}</span>
                {showAdvancedAiTuning ? (
                  <ChevronUp className="w-4 h-4 text-neutral-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-neutral-400" />
                )}
              </button>

              {showAdvancedAiTuning && (
                <div className="p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-neutral-200 dark:border-neutral-800">
                  <label className="text-xs space-y-1">
                    <span className="text-neutral-500">{isAr ? 'جولات التهدئة بعد ربح' : 'Drain Rounds'}</span>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={aiMonitor.postBigWinDrainRounds}
                      onChange={(e) =>
                        updateAiField('postBigWinDrainRounds', Number(e.target.value) || 0)
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 font-mono tabular-nums font-bold"
                    />
                  </label>
                  <label className="text-xs space-y-1">
                    <span className="text-neutral-500">{isAr ? 'خسائر متتالية للتعويض' : 'Loss Streak Trigger'}</span>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={aiMonitor.heavyLossStreakTrigger}
                      onChange={(e) =>
                        updateAiField('heavyLossStreakTrigger', Number(e.target.value) || 4)
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 font-mono tabular-nums font-bold"
                    />
                  </label>
                  <label className="text-xs space-y-1">
                    <span className="text-neutral-500">{isAr ? 'حساسية منع الملل (%)' : 'Anti-Boredom (%)'}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={aiMonitor.antiBoredomSensitivity}
                      onChange={(e) =>
                        updateAiField('antiBoredomSensitivity', Number(e.target.value) || 0)
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 font-mono tabular-nums font-bold"
                    />
                  </label>
                  <label className="text-xs space-y-1">
                    <span className="text-neutral-500">{isAr ? 'حماية المنصة (%)' : 'Platform Shield (%)'}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={aiMonitor.platformProtectionStrength}
                      onChange={(e) =>
                        updateAiField('platformProtectionStrength', Number(e.target.value) || 0)
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 font-mono tabular-nums font-bold"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Monitored Players Table */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-extrabold text-neutral-900 dark:text-white">
                  {isAr ? `اللاعبون تحت المراقبة (${monitoredPlayers.length})` : `Monitored Players (${monitoredPlayers.length})`}
                </h4>
              </div>
              {monitoredPlayers.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleResetAiPlayer()}
                  disabled={resettingPlayerId === '__ALL__'}
                  className="px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 text-[11px] font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                >
                  {isAr ? 'إعادة ضبط الكل' : 'Reset All'}
                </button>
              )}
            </div>

            {monitoredPlayers.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-400">
                {isAr ? 'لا يوجد لاعبون نشطون في الجلسة الحالية بعد.' : 'No active monitored players yet.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500">
                      <th className="py-2 pe-3 font-semibold">{isAr ? 'اللاعب' : 'Player'}</th>
                      <th className="py-2 px-2 font-semibold">{isAr ? 'الجولات' : 'Rounds'}</th>
                      <th className="py-2 px-2 font-semibold">{isAr ? 'صافي اللاعب' : 'Player Net'}</th>
                      <th className="py-2 px-2 font-semibold">{isAr ? 'الحالة' : 'Phase'}</th>
                      <th className="py-2 ps-2 text-end font-semibold">{isAr ? 'إجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                    {monitoredPlayers.map((p) => (
                      <tr key={p.playerId}>
                        <td className="py-2.5 pe-3">
                          <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
                            <span>{p.userName || p.displayId}</span>
                            {p.isAdModeTarget && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                                AD
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-neutral-400 font-mono">{p.displayId}</div>
                        </td>
                        <td className="py-2.5 px-2 font-mono tabular-nums">{p.totalRounds}</td>
                        <td
                          className={`py-2.5 px-2 font-mono tabular-nums font-bold ${
                            p.sessionNetProfit > 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {p.sessionNetProfit > 0 ? '+' : ''}
                          {p.sessionNetProfit.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2 text-[11px] text-neutral-600 dark:text-neutral-300">
                          {phaseLabel(p.aiPhase)}
                        </td>
                        <td className="py-2.5 ps-2 text-end">
                          <button
                            type="button"
                            onClick={() => handleResetAiPlayer(p.playerId)}
                            disabled={resettingPlayerId === p.playerId}
                            className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:text-neutral-900 dark:hover:text-white cursor-pointer"
                            title={isAr ? 'إعادة ضبط' : 'Reset'}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================
          TAB 3: AD / PROMO MODE
      ======================================================== */}
      {activeSubTab === 'ad_mode' && (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Video className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-neutral-900 dark:text-white">
                  {isAr ? 'وضع الإعلان والترويج (حسابات التصوير)' : 'Ad / Promo Filming Mode'}
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {isAr
                    ? 'حسابات مستثناة مخصصة لتصوير الفيديوهات الترويجية بنبضات ربح درامية دون التأثير على باقي اللاعبين.'
                    : 'Dedicated filming accounts exempt from house drain for promo capture.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleUpdateAdMode({ enabled: !adMode.enabled })}
              disabled={isUpdatingAdMode}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border cursor-pointer ${
                adMode.enabled
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500'
              }`}
            >
              {adMode.enabled
                ? isAr
                  ? 'وضع الإعلان مفعّل'
                  : 'Ad Mode Active'
                : isAr
                ? 'وضع الإعلان معطّل'
                : 'Ad Mode Off'}
            </button>
          </div>

          {/* Add Target Email */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Mail className="w-4 h-4 text-neutral-400 absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                type="email"
                value={newAdEmailInput}
                onChange={(e) => setNewAdEmailInput(e.target.value)}
                placeholder={isAr ? 'أضف بريد حساب التصوير...' : 'Add filming account email...'}
                className="w-full ps-9 pe-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-xs font-medium"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                newAdEmailInput.trim() &&
                handleUpdateAdMode({ addEmail: newAdEmailInput.trim() }, true)
              }
              disabled={isUpdatingAdMode || !newAdEmailInput.trim()}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? 'إضافة الحساب' : 'Add Account'}</span>
            </button>
          </div>

          {/* Target Emails List */}
          <div className="space-y-2">
            {(adModeResolvedUsers.length > 0
              ? adModeResolvedUsers
              : adMode.targetEmails.map((email): AdModeResolvedUser => ({ email, found: false }))
            ).map((u) => (
              <div
                key={u.email}
                className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/60 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-neutral-900 dark:text-white">{u.email}</span>
                  {u.found && u.name && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      ({u.name} — {(u.coinsBalance || 0).toLocaleString()} coins)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdateAdMode({ removeEmail: u.email })}
                  disabled={isUpdatingAdMode}
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Intensity Presets */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            {(
              [
                {
                  id: 'balanced_drama',
                  ar: 'دراما متوازنة',
                  en: 'Balanced Drama',
                  descAr: 'هبوط خفيف يعقبه ضربات حتى 26x',
                  descEn: 'Small dips followed by up to 26x hits',
                },
                {
                  id: 'high_climax',
                  ar: 'ذروة عالية',
                  en: 'High Climax',
                  descAr: 'انفجارات فوز قوية حتى 40x للتصوير',
                  descEn: 'Big climax hits up to 40x for promos',
                },
                {
                  id: 'steady_climb',
                  ar: 'صعود تدريجي',
                  en: 'Steady Climb',
                  descAr: 'أرباح متواصلة ومقنعة بدون قفزات مبالغ فيها',
                  descEn: 'Smooth realistic upward momentum',
                },
              ] as const
            ).map((item) => {
              const selected = adMode.intensity === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    handleSelectAdIntensity(item.id);
                    setHasUnsavedChanges(true);
                  }}
                  className={`p-3 rounded-xl border text-start cursor-pointer ${
                    selected
                      ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/20'
                      : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50'
                  }`}
                >
                  <div className="text-xs font-extrabold text-neutral-900 dark:text-white">
                    {isAr ? item.ar : item.en}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">{isAr ? item.descAr : item.descEn}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* =======================================================
          TAB 4: MAINTENANCE & LOGS
      ======================================================== */}
      {activeSubTab === 'maintenance' && (
        <div className="space-y-4">
          {/* Per-Game Maintenance */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-extrabold text-neutral-900 dark:text-white">
                {isAr ? 'حالة وصيانة الألعاب' : 'Game Availability & Maintenance'}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {connectedGames.map((g) => {
                const entry = maintenanceGames[g.id];
                const isMaint = Boolean(entry?.enabled);
                const draft = maintenanceDraftReasons[g.id] || {
                  reasonAr: entry?.reasonAr || 'اللعبة تحت الصيانة والتطوير حالياً، يرجى المحاولة لاحقاً',
                  reasonEn:
                    entry?.reasonEn ||
                    'This game is currently under maintenance for development. Please check back soon.',
                };
                return (
                  <div
                    key={g.id}
                    className={`p-3.5 rounded-xl border space-y-2.5 ${
                      isMaint
                        ? 'border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/20'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-extrabold text-neutral-900 dark:text-white">
                          {isAr ? g.nameAr : g.nameEn}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {isMaint ? (isAr ? 'تحت الصيانة' : 'In Maintenance') : isAr ? 'متاحة للاعبين' : 'Live'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleMaintenance(g.id, !isMaint)}
                        disabled={togglingMaintenanceGame === g.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer disabled:opacity-50 ${
                          isMaint
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 border-transparent'
                        }`}
                      >
                        {togglingMaintenanceGame === g.id
                          ? '...'
                          : isMaint
                          ? isAr
                            ? 'تفعيل اللعبة'
                            : 'Bring Live'
                          : isAr
                          ? 'إيقاف للصيانة'
                          : 'Set Maint'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={isAr ? draft.reasonAr : draft.reasonEn}
                      onChange={(e) =>
                        setMaintenanceDraftReasons((prev) => ({
                          ...prev,
                          [g.id]: {
                            ...draft,
                            [isAr ? 'reasonAr' : 'reasonEn']: e.target.value,
                          },
                        }))
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[11px]"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Outcomes & Reset Telemetry */}
          <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-extrabold text-neutral-900 dark:text-white">
                  {isAr ? 'آخر نتائج الجولات المسجلة' : 'Recent Outcomes Telemetry'}
                </h4>
              </div>

              {!confirmResetOpen ? (
                <button
                  type="button"
                  onClick={() => setConfirmResetOpen(true)}
                  className="px-3 py-1.5 rounded-xl border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-bold cursor-pointer"
                >
                  {isAr ? 'تصفير الإحصائيات' : 'Reset Telemetry'}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetTelemetry}
                    disabled={isResettingTelemetry}
                    className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer"
                  >
                    {isResettingTelemetry ? '...' : isAr ? 'تأكيد التصفير' : 'Confirm Reset'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetOpen(false)}
                    className="px-2.5 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs font-bold cursor-pointer"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              )}
            </div>

            {telemetry && telemetry.recentOutcomes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] text-neutral-500">
                      <th className="py-2 pe-3 font-semibold">{isAr ? 'اللعبة' : 'Game'}</th>
                      <th className="py-2 px-2 font-semibold">{isAr ? 'الرهان' : 'Bet'}</th>
                      <th className="py-2 px-2 font-semibold">{isAr ? 'الدفع' : 'Payout'}</th>
                      <th className="py-2 px-2 font-semibold">{isAr ? 'المضاعف' : 'Mult'}</th>
                      <th className="py-2 ps-2 font-semibold">{isAr ? 'السبب' : 'Reason'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                    {telemetry.recentOutcomes.slice(0, 20).map((item, idx) => (
                      <tr key={`${item.timestamp}_${idx}`}>
                        <td className="py-2 pe-3 font-bold text-neutral-900 dark:text-white">{item.game}</td>
                        <td className="py-2 px-2 font-mono tabular-nums">{item.betAmount.toLocaleString()}</td>
                        <td
                          className={`py-2 px-2 font-mono tabular-nums font-bold ${
                            item.won ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-400'
                          }`}
                        >
                          {item.payout.toLocaleString()}
                        </td>
                        <td className="py-2 px-2 font-mono tabular-nums">{item.multiplier}x</td>
                        <td className="py-2 ps-2 text-[11px] font-mono text-neutral-500">{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-neutral-400">
                {isAr ? 'لا توجد جولات مسجلة بعد.' : 'No rounds logged yet.'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subtle Footer Assurance */}
      <div className="flex items-center gap-2 text-[11px] text-neutral-500 px-1">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        <span>
          {isAr
            ? 'جميع التغييرات تُطبق فورياً على جميع الألعاب السبعة المرتبطة وتخضع لضامن الربح الطويل الأمد.'
            : 'All changes sync across all 7 connected games and enforce the long-term house edge governor.'}
        </span>
      </div>
    </div>
  );
};
