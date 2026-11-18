import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Crown,
  History,
  RefreshCw,
  RotateCcw,
  Save,
  Sliders,
} from 'lucide-react';
import { Language } from '../types';
import {
  GOLDEN_TREE_REGULAR_SYMBOLS,
  GOLDEN_TREE_SYMBOL_LABELS,
  GoldenTreeRegularSymbolId,
} from './GoldenTreeArt';

interface AdminGoldenTreeSettings {
  enabled: boolean;
  targetRtpPercent: number;
  volatility: 'low' | 'medium' | 'high';
  maxWinMultiplier: number;
  paylines: number[][];
  paytable: Record<GoldenTreeRegularSymbolId, { 2?: number; 3: number; 4: number; 5: number }>;
  symbolWeights: Record<GoldenTreeRegularSymbolId, number>;
  wildSettings: {
    allowedReels: number[];
    reelTriggerChancePercent: number;
    multipliers: number[];
    multiplierWeights: number[];
    combineMode: 'multiply' | 'sum' | 'max';
  };
  scatterDollarSettings: {
    pays3: number;
    pays4: number;
    pays5: number;
    cellChancePercent: number;
  };
  scatterStarSettings: {
    allowedReels: number[];
    triggerCount: number;
    payoutMultiplier: number;
    cellChancePercent: number;
  };
  buyBonusOptions: Record<
    'wild_1' | 'wild_2' | 'wild_3' | 'random_wild',
    {
      id: 'wild_1' | 'wild_2' | 'wild_3' | 'random_wild';
      costMultiplier: number;
      freeSpinsCount: number;
      guaranteedWilds: number | 'random';
      enabled: boolean;
    }
  >;
}

interface GoldenTreeRoundLog {
  id: string;
  userId: string;
  displayId?: string;
  userName?: string;
  mode: 'base' | 'bonus_buy' | 'free_spin';
  bonusOptionId?: string;
  betAmount: number;
  wageredCoins: number;
  payout: number;
  totalMultiplier: number;
  wildCount: number;
  timestamp: string;
}

interface AdminGoldenTreeControlProps {
  lang: Language;
  getAdminHeaders: () => Record<string, string>;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export const AdminGoldenTreeControl: React.FC<AdminGoldenTreeControlProps> = ({
  lang,
  getAdminHeaders,
  showToast,
}) => {
  const isAr = lang === 'ar';
  const [settings, setSettings] = useState<AdminGoldenTreeSettings | null>(null);
  const [history, setHistory] = useState<GoldenTreeRoundLog[]>([]);
  const [stats, setStats] = useState<{
    totalRounds: number;
    totalWagered: number;
    totalPayout: number;
    netHouseProfit: number;
    actualRtpPercent: number;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [sectionOpen, setSectionOpen] = useState<
    'general' | 'paytable' | 'paylines' | 'bonus' | 'history'
  >('general');

  const fetchGoldenTreeAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/games/golden-tree/settings', {
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (data?.success && data.settings) {
        setSettings(data.settings);
        setHistory(Array.isArray(data.history) ? data.history : []);
        setStats(data.stats || null);
      }
    } catch {
      showToast('error', isAr ? 'تعذر تحميل إعدادات Golden Tree' : 'Failed loading Golden Tree config');
    } finally {
      setLoading(false);
    }
  }, [getAdminHeaders, isAr, showToast]);

  useEffect(() => {
    fetchGoldenTreeAdmin();
  }, [fetchGoldenTreeAdmin]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/games/golden-tree/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAdminHeaders(),
        },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (data?.success) {
        setSettings(data.settings);
        showToast('success', data.message || (isAr ? 'تم الحفظ بنجاح' : 'Saved successfully'));
      } else {
        showToast('error', data?.message || (isAr ? 'فشل الحفظ' : 'Save failed'));
      }
    } catch {
      showToast('error', isAr ? 'خطأ أثناء الحفظ' : 'Network error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/games/golden-tree/reset', {
        method: 'POST',
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      if (data?.success) {
        setSettings(data.settings);
        showToast('success', data.message || (isAr ? 'تمت الاستعادة' : 'Defaults restored'));
      }
    } catch {
      showToast('error', isAr ? 'تعذر استعادة الافتراضي' : 'Reset failed');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <span className="text-sm font-bold text-neutral-600 dark:text-neutral-300">
          {loading
            ? isAr
              ? 'جاري تحميل إعدادات Golden Tree...'
              : 'Loading Golden Tree Settings...'
            : isAr
            ? 'تعذر تحميل إعدادات Golden Tree'
            : 'Unable to load Golden Tree Settings'}
        </span>
        <button
          type="button"
          onClick={fetchGoldenTreeAdmin}
          className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-neutral-900 border border-amber-500/30 space-y-5 shadow-xs"
      dir={isAr ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-700 to-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-neutral-900 dark:text-white">
              {isAr ? 'إدارة لعبة Golden Tree (5×3 Slot)' : 'Golden Tree Slot Management'}
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {isAr
                ? 'تحكم كامل بالـ RTP، المضاعفات، خطوط الربح العشرة، الـ Wild والـ Scatter وأسعار البونص'
                : 'Configure RTP, volatility, paytable multipliers, 10 paylines, Wilds, Scatters & Buy Bonus'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSettings((s) => (s ? { ...s, enabled: !s.enabled } : s))}
            className={`px-3 py-2 rounded-xl text-xs font-black border cursor-pointer ${
              settings.enabled
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40'
            }`}
          >
            {settings.enabled
              ? isAr
                ? 'مفعّلة'
                : 'Enabled'
              : isAr
              ? 'معطّلة'
              : 'Disabled'}
          </button>

          <button
            type="button"
            onClick={fetchGoldenTreeAdmin}
            disabled={loading}
            className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="px-3 py-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-bold text-neutral-700 dark:text-neutral-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isAr ? 'افتراضي' : 'Reset'}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-neutral-950 text-xs font-black flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? (isAr ? 'جاري الحفظ...' : 'Saving...') : isAr ? 'حفظ الإعدادات' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Quick Telemetry Row */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
            <div className="text-[11px] font-semibold text-neutral-500">
              {isAr ? 'إجمالي الجولات' : 'Total Rounds'}
            </div>
            <div className="text-base font-black text-neutral-900 dark:text-white tabular-nums">
              {stats.totalRounds.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
            <div className="text-[11px] font-semibold text-neutral-500">
              {isAr ? 'إجمالي الرهانات' : 'Total Wagered'}
            </div>
            <div className="text-base font-black text-neutral-900 dark:text-white tabular-nums">
              {stats.totalWagered.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
            <div className="text-[11px] font-semibold text-neutral-500">
              {isAr ? 'إجمالي الأرباح المدفوعة' : 'Total Payouts'}
            </div>
            <div className="text-base font-black text-amber-600 dark:text-amber-400 tabular-nums">
              {stats.totalPayout.toLocaleString()}
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
            <div className="text-[11px] font-semibold text-neutral-500">
              {isAr ? 'نسبة RTP الفعلية' : 'Observed RTP'}
            </div>
            <div className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {stats.actualRtpPercent}%
            </div>
          </div>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'general', ar: 'RTP والتقلب و Wild/Scatter', en: 'RTP, Wild & Scatter' },
            { id: 'paytable', ar: 'مضاعفات وأوزان الرموز', en: 'Paytable & Weights' },
            { id: 'bonus', ar: 'خيارات شراء البونص', en: 'Buy Bonus Prices' },
            { id: 'paylines', ar: 'خريطة خطوط الربح (10)', en: '10 Paylines Map' },
            { id: 'history', ar: 'سجل الجولات', en: 'Round History' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSectionOpen(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
              sectionOpen === tab.id
                ? 'bg-amber-500 text-neutral-950 border-amber-400'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-transparent hover:border-neutral-300'
            }`}
          >
            {isAr ? tab.ar : tab.en}
          </button>
        ))}
      </div>

      {/* SECTION 1: General RTP, Volatility, Wild & Scatter */}
      {sectionOpen === 'general' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-neutral-800 dark:text-neutral-200">
              <Sliders className="w-4 h-4 text-amber-500" />
              <span>{isAr ? 'إعدادات العائد والحد الأقصى' : 'RTP, Volatility & Max Win'}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs font-semibold text-neutral-500 space-y-1">
                <span>RTP (%)</span>
                <input
                  type="number"
                  step="0.5"
                  min={50}
                  max={99.5}
                  value={settings.targetRtpPercent}
                  onChange={(e) =>
                    setSettings({ ...settings, targetRtpPercent: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-bold"
                />
              </label>

              <label className="text-xs font-semibold text-neutral-500 space-y-1">
                <span>{isAr ? 'التقلب' : 'Volatility'}</span>
                <select
                  value={settings.volatility}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      volatility: e.target.value as 'low' | 'medium' | 'high',
                    })
                  }
                  className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-bold"
                >
                  <option value="low">{isAr ? 'منخفض' : 'Low'}</option>
                  <option value="medium">{isAr ? 'متوسط' : 'Medium'}</option>
                  <option value="high">{isAr ? 'مرتفع' : 'High'}</option>
                </select>
              </label>

              <label className="text-xs font-semibold text-neutral-500 space-y-1">
                <span>{isAr ? 'سقف الفوز (x)' : 'Max Win (x)'}</span>
                <input
                  type="number"
                  min={100}
                  max={100000}
                  value={settings.maxWinMultiplier}
                  onChange={(e) =>
                    setSettings({ ...settings, maxWinMultiplier: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-bold"
                />
              </label>
            </div>

            {/* Wild Settings */}
            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="text-xs font-black text-amber-600 dark:text-amber-400">
                {isAr ? 'الشجرة الذهبية Wild (البكرات 2-3-4 فقط)' : 'Golden Tree Wild (Reels 2,3,4)'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold text-neutral-500 space-y-1">
                  <span>{isAr ? 'احتمال الظهور % للبكرة' : 'Reel Trigger %'}</span>
                  <input
                    type="number"
                    step="0.5"
                    min={0}
                    max={50}
                    value={settings.wildSettings.reelTriggerChancePercent}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        wildSettings: {
                          ...settings.wildSettings,
                          reelTriggerChancePercent: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-bold"
                  />
                </label>

                <label className="text-xs font-semibold text-neutral-500 space-y-1">
                  <span>{isAr ? 'دمج عدة Wild بالخط' : 'Multi-Wild Stack'}</span>
                  <select
                    value={settings.wildSettings.combineMode}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        wildSettings: {
                          ...settings.wildSettings,
                          combineMode: e.target.value as 'multiply' | 'sum' | 'max',
                        },
                      })
                    }
                    className="w-full px-2.5 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-bold"
                  >
                    <option value="multiply">{isAr ? 'ضرب (x2×x3 = x6)' : 'Multiply'}</option>
                    <option value="sum">{isAr ? 'جمع (x2+x3 = x5)' : 'Sum'}</option>
                    <option value="max">{isAr ? 'الأعلى فقط' : 'Highest Only'}</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* Scatter Dollar & Star */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3">
            <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
              {isAr ? 'إعدادات الدولار Scatter ($)' : 'Dollar Scatter Settings'}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { k: 'pays3', label: '3× (x)' },
                  { k: 'pays4', label: '4× (x)' },
                  { k: 'pays5', label: '5× (x)' },
                  { k: 'cellChancePercent', label: isAr ? 'الاحتمال %' : 'Chance %' },
                ] as const
              ).map((item) => (
                <label key={item.k} className="text-xs font-semibold text-neutral-500 space-y-1">
                  <span>{item.label}</span>
                  <input
                    type="number"
                    step="0.5"
                    value={settings.scatterDollarSettings[item.k]}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        scatterDollarSettings: {
                          ...settings.scatterDollarSettings,
                          [item.k]: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full px-2 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-bold"
                  />
                </label>
              ))}
            </div>

            <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 text-xs font-black text-sky-600 dark:text-sky-400">
              {isAr ? 'إعدادات النجمة الزرقاء Scatter (بكرات 1 و 3 و 5 فقط)' : 'Blue Star Scatter (Reels 1,3,5 Only)'}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-xs font-semibold text-neutral-500 space-y-1">
                <span>{isAr ? 'العدد المطلوب' : 'Trigger Count'}</span>
                <input
                  type="number"
                  min={3}
                  max={9}
                  value={settings.scatterStarSettings.triggerCount}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      scatterStarSettings: {
                        ...settings.scatterStarSettings,
                        triggerCount: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-2 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-bold"
                />
              </label>
              <label className="text-xs font-semibold text-neutral-500 space-y-1">
                <span>{isAr ? 'المضاعف (x)' : 'Multiplier (x)'}</span>
                <input
                  type="number"
                  min={1}
                  value={settings.scatterStarSettings.payoutMultiplier}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      scatterStarSettings: {
                        ...settings.scatterStarSettings,
                        payoutMultiplier: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-2 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-bold"
                />
              </label>
              <label className="text-xs font-semibold text-neutral-500 space-y-1">
                <span>{isAr ? 'الاحتمال %' : 'Chance %'}</span>
                <input
                  type="number"
                  step="0.5"
                  value={settings.scatterStarSettings.cellChancePercent}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      scatterStarSettings: {
                        ...settings.scatterStarSettings,
                        cellChancePercent: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-2 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-bold"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: Symbol Paytable & Weights */}
      {sectionOpen === 'paytable' && (
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-xs text-start">
            <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500">
              <tr>
                <th className="p-3">{isAr ? 'الرمز' : 'Symbol'}</th>
                <th className="p-3">2× (x)</th>
                <th className="p-3">3× (x)</th>
                <th className="p-3">4× (x)</th>
                <th className="p-3">5× (x)</th>
                <th className="p-3">{isAr ? 'الوزن / الاحتمال' : 'Weight'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {GOLDEN_TREE_REGULAR_SYMBOLS.map((sym) => {
                const entry = settings.paytable[sym];
                return (
                  <tr key={sym}>
                    <td className="p-2.5 font-bold text-neutral-900 dark:text-white">
                      {GOLDEN_TREE_SYMBOL_LABELS[sym][lang]}
                    </td>
                    <td className="p-2">
                      {sym === 'seven' ? (
                        <input
                          type="number"
                          value={entry[2] ?? 1}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              paytable: {
                                ...settings.paytable,
                                [sym]: { ...entry, 2: Number(e.target.value) },
                              },
                            })
                          }
                          className="w-16 px-2 py-1 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 font-bold"
                        />
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    {([3, 4, 5] as const).map((cnt) => (
                      <td key={cnt} className="p-2">
                        <input
                          type="number"
                          value={entry[cnt]}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              paytable: {
                                ...settings.paytable,
                                [sym]: { ...entry, [cnt]: Number(e.target.value) },
                              },
                            })
                          }
                          className="w-16 px-2 py-1 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 font-bold"
                        />
                      </td>
                    ))}
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.5"
                        value={settings.symbolWeights[sym]}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            symbolWeights: {
                              ...settings.symbolWeights,
                              [sym]: Number(e.target.value),
                            },
                          })
                        }
                        className="w-20 px-2 py-1 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-700 font-bold"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* SECTION 3: Buy Bonus Options */}
      {sectionOpen === 'bonus' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(['wild_1', 'wild_2', 'wild_3', 'random_wild'] as const).map((optId) => {
            const opt = settings.buyBonusOptions[optId];
            return (
              <div
                key={optId}
                className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-amber-600 dark:text-amber-400">
                    {optId}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        buyBonusOptions: {
                          ...settings.buyBonusOptions,
                          [optId]: { ...opt, enabled: !opt.enabled },
                        },
                      })
                    }
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                      opt.enabled
                        ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                        : 'bg-rose-500/20 text-rose-500'
                    }`}
                  >
                    {opt.enabled ? (isAr ? 'متاح' : 'Active') : isAr ? 'مغلق' : 'Off'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs font-semibold text-neutral-500 space-y-1">
                    <span>{isAr ? 'مضاعف السعر (x)' : 'Cost Mult (x)'}</span>
                    <input
                      type="number"
                      min={5}
                      value={opt.costMultiplier}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          buyBonusOptions: {
                            ...settings.buyBonusOptions,
                            [optId]: { ...opt, costMultiplier: Number(e.target.value) },
                          },
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 font-bold"
                    />
                  </label>
                  <label className="text-xs font-semibold text-neutral-500 space-y-1">
                    <span>{isAr ? 'عدد اللفات' : 'Free Spins'}</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={opt.freeSpinsCount}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          buyBonusOptions: {
                            ...settings.buyBonusOptions,
                            [optId]: { ...opt, freeSpinsCount: Number(e.target.value) },
                          },
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 font-bold"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SECTION 4: Editable 10 Payline Row Coordinates */}
      {sectionOpen === 'paylines' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" dir="ltr">
          {settings.paylines.map((lineRows, lineIdx) => (
            <div
              key={lineIdx}
              className="p-3 rounded-2xl bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2"
            >
              <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                Line #{lineIdx + 1}
              </span>
              <div className="flex items-center gap-1.5">
                {lineRows.map((rowVal, colIdx) => (
                  <select
                    key={colIdx}
                    value={rowVal}
                    onChange={(e) => {
                      const nextLines = settings.paylines.map((l, idx) =>
                        idx === lineIdx
                          ? l.map((rv, c) => (c === colIdx ? Number(e.target.value) : rv))
                          : l
                      );
                      setSettings({ ...settings, paylines: nextLines });
                    }}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-xs font-bold"
                  >
                    <option value={0}>Top (0)</option>
                    <option value={1}>Mid (1)</option>
                    <option value={2}>Bot (2)</option>
                  </select>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SECTION 5: Recent Golden Tree History */}
      {sectionOpen === 'history' && (
        <div className="max-h-72 overflow-y-auto rounded-2xl border border-neutral-200 dark:border-neutral-800">
          {history.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500 flex flex-col items-center gap-2">
              <History className="w-5 h-5 opacity-60" />
              <span>{isAr ? 'لا توجد جولات مسجلة بعد' : 'No recorded rounds yet'}</span>
            </div>
          ) : (
            <table className="w-full text-xs text-start">
              <thead className="bg-neutral-50 dark:bg-neutral-950 text-neutral-500 sticky top-0">
                <tr>
                  <th className="p-2.5">{isAr ? 'اللاعب' : 'Player'}</th>
                  <th className="p-2.5">{isAr ? 'النوع' : 'Mode'}</th>
                  <th className="p-2.5">{isAr ? 'المبلغ' : 'Wager'}</th>
                  <th className="p-2.5">{isAr ? 'الربح' : 'Payout'}</th>
                  <th className="p-2.5">{isAr ? 'المضاعف' : 'Mult'}</th>
                  <th className="p-2.5">{isAr ? 'التوقيت' : 'Time'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {history.slice(0, 60).map((item) => (
                  <tr key={item.id}>
                    <td className="p-2.5 font-bold text-neutral-900 dark:text-white">
                      {item.userName || item.displayId || item.userId}
                    </td>
                    <td className="p-2.5 font-semibold text-neutral-500">{item.mode}</td>
                    <td className="p-2.5 tabular-nums">{item.wageredCoins.toLocaleString()}</td>
                    <td className="p-2.5 font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {item.payout.toLocaleString()}
                    </td>
                    <td className="p-2.5 font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                      x{item.totalMultiplier}
                    </td>
                    <td className="p-2.5 text-neutral-400">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Save Confirmation Footer Hint */}
      <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          {isAr
            ? 'جميع التعديلات تُطبق فوراً على المحرك الخادمي (CSPRNG)'
            : 'All changes apply immediately to the server CSPRNG engine'}
        </span>
      </div>
    </div>
  );
};
