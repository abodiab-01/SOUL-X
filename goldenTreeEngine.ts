import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const GOLDEN_TREE_DATA_FILE = path.resolve(DATA_DIR, 'golden_tree_data.json');

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch {}

// ==========================================
// Types & Constants
// ==========================================

export type GoldenTreeRegularSymbolId =
  | 'seven'
  | 'watermelon'
  | 'grapes'
  | 'bell'
  | 'cherry'
  | 'orange'
  | 'lemon'
  | 'plum';

export type GoldenTreeSpecialSymbolId = 'wild' | 'scatter_dollar' | 'scatter_star';

export type GoldenTreeSymbolId = GoldenTreeRegularSymbolId | GoldenTreeSpecialSymbolId;

export type GoldenTreeVolatility = 'low' | 'medium' | 'high';
export type GoldenTreeWildCombineMode = 'multiply' | 'sum' | 'max';
export type GoldenTreeBuyBonusOptionId = 'wild_1' | 'wild_2' | 'wild_3' | 'random_wild';

export interface GoldenTreePaylineWin {
  lineIndex: number; // 0..9
  lineNumber: number; // 1..10
  symbol: GoldenTreeRegularSymbolId;
  matchCount: number;
  positions: Array<{ row: number; col: number; cellIndex: number }>;
  baseMultiplier: number;
  wildMultipliers: number[];
  appliedWildMultiplier: number;
  totalLineMultiplier: number;
  payout: number;
}

export interface GoldenTreeScatterWin {
  type: 'scatter_dollar' | 'scatter_star';
  count: number;
  positions: Array<{ row: number; col: number; cellIndex: number }>;
  multiplier: number;
  payout: number;
}

export interface GoldenTreeWildReelInfo {
  col: number; // 1 | 2 | 3 (reels 2, 3, 4)
  multiplier: number; // 1 | 2 | 3 | 5
}

export interface GoldenTreeSpinEvaluation {
  grid: GoldenTreeSymbolId[]; // 15 row-major (3 rows x 5 cols)
  columns: GoldenTreeSymbolId[][]; // 5 cols x 3 rows
  expandedWildReels: GoldenTreeWildReelInfo[];
  paylineWins: GoldenTreePaylineWin[];
  scatterWins: GoldenTreeScatterWin[];
  totalMultiplier: number;
  rawPayout: number;
  payout: number;
  cappedByMaxWin: boolean;
}

export interface GoldenTreePaytableEntry {
  2?: number;
  3: number;
  4: number;
  5: number;
}

export interface GoldenTreeBuyBonusOptionConfig {
  id: GoldenTreeBuyBonusOptionId;
  costMultiplier: number; // x50, x150, x350, x100
  freeSpinsCount: number; // 5
  guaranteedWilds: number | 'random'; // 1, 2, 3, 'random'
  enabled: boolean;
}

export interface GoldenTreeSettings {
  enabled: boolean;
  targetRtpPercent: number; // e.g. 96.5
  volatility: GoldenTreeVolatility;
  maxWinMultiplier: number; // default 10000
  paylines: number[][]; // 10 arrays of 5 row indices (0..2)
  paytable: Record<GoldenTreeRegularSymbolId, GoldenTreePaytableEntry>;
  symbolWeights: Record<GoldenTreeRegularSymbolId, number>;
  wildSettings: {
    allowedReels: number[]; // [1, 2, 3]
    reelTriggerChancePercent: number; // base chance per allowed reel in normal spin
    multipliers: number[]; // [2, 3, 5]
    multiplierWeights: number[]; // [60, 28, 12]
    combineMode: GoldenTreeWildCombineMode; // 'multiply' | 'sum' | 'max'
  };
  scatterDollarSettings: {
    pays3: number;
    pays4: number;
    pays5: number;
    cellChancePercent: number;
  };
  scatterStarSettings: {
    allowedReels: number[]; // [0, 2, 4] strictly enforced
    triggerCount: number; // 5
    payoutMultiplier: number; // 20
    cellChancePercent: number;
  };
  buyBonusOptions: Record<GoldenTreeBuyBonusOptionId, GoldenTreeBuyBonusOptionConfig>;
  updatedAt: string;
}

export type GoldenTreeBonusPlanProfile =
  | 'profit_disabled_low'
  | 'drain_low'
  | 'balanced'
  | 'comeback'
  | 'ad_hype';

export interface GoldenTreeActiveBonusSession {
  sessionId: string;
  userId: string;
  optionId: GoldenTreeBuyBonusOptionId;
  resolvedWildCount: 1 | 2 | 3;
  betAmount: number;
  bonusCost: number;
  totalSpins: number;
  remainingSpins: number;
  spinsPlayed: number;
  totalBonusWin: number;
  smartPlanProfile?: GoldenTreeBonusPlanProfile;
  targetBonusTotalCoins?: number;
  perSpinTargetPayouts?: number[];
  spinResults: Array<{
    spinNumber: number;
    payout: number;
    totalMultiplier: number;
    expandedWildReels: GoldenTreeWildReelInfo[];
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface GoldenTreeRoundLog {
  id: string;
  userId: string;
  displayId?: string;
  userName?: string;
  mode: 'base' | 'bonus_buy' | 'free_spin';
  bonusOptionId?: GoldenTreeBuyBonusOptionId;
  betAmount: number;
  wageredCoins: number;
  payout: number;
  totalMultiplier: number;
  wildCount: number;
  paylineHits: number;
  scatterHits: number;
  timestamp: string;
}

interface GoldenTreePersistedStore {
  settings: GoldenTreeSettings;
  activeBonusByUser: Record<string, GoldenTreeActiveBonusSession>;
  history: GoldenTreeRoundLog[];
}

export const GOLDEN_TREE_REGULAR_SYMBOLS: readonly GoldenTreeRegularSymbolId[] = [
  'seven',
  'watermelon',
  'grapes',
  'bell',
  'cherry',
  'orange',
  'lemon',
  'plum',
] as const;

export const GOLDEN_TREE_ALL_SYMBOLS: readonly GoldenTreeSymbolId[] = [
  ...GOLDEN_TREE_REGULAR_SYMBOLS,
  'wild',
  'scatter_dollar',
  'scatter_star',
] as const;

export const DEFAULT_GOLDEN_TREE_PAYLINES: number[][] = [
  [1, 1, 1, 1, 1], // 1. Middle row
  [0, 0, 0, 0, 0], // 2. Top row
  [2, 2, 2, 2, 2], // 3. Bottom row
  [0, 1, 2, 1, 0], // 4. V
  [2, 1, 0, 1, 2], // 5. Inverted V
  [0, 0, 1, 2, 2], // 6. Zigzag top -> bottom
  [2, 2, 1, 0, 0], // 7. Zigzag bottom -> top
  [1, 0, 1, 0, 1], // 8. Mid -> Top -> Mid
  [1, 2, 1, 2, 1], // 9. Mid -> Bottom -> Mid
  [0, 1, 1, 1, 0], // 10. Top -> Mid -> Top
];

export const DEFAULT_GOLDEN_TREE_SETTINGS: GoldenTreeSettings = {
  enabled: true,
  targetRtpPercent: 96.5,
  volatility: 'high',
  maxWinMultiplier: 10000,
  paylines: DEFAULT_GOLDEN_TREE_PAYLINES.map((line) => [...line]),
  paytable: {
    seven: { 2: 1, 3: 5, 4: 25, 5: 500 },
    watermelon: { 3: 4, 4: 12, 5: 70 },
    grapes: { 3: 4, 4: 12, 5: 70 },
    bell: { 3: 2, 4: 4, 5: 20 },
    cherry: { 3: 1, 4: 3, 5: 15 },
    orange: { 3: 1, 4: 3, 5: 15 },
    lemon: { 3: 1, 4: 3, 5: 15 },
    plum: { 3: 1, 4: 3, 5: 15 },
  },
  symbolWeights: {
    seven: 5,
    watermelon: 10,
    grapes: 10,
    bell: 15,
    cherry: 22,
    orange: 22,
    lemon: 22,
    plum: 22,
  },
  wildSettings: {
    allowedReels: [1, 2, 3],
    reelTriggerChancePercent: 7.5,
    multipliers: [1, 2, 3, 5],
    multiplierWeights: [38, 36, 18, 8],
    combineMode: 'multiply',
  },
  scatterDollarSettings: {
    pays3: 5,
    pays4: 20,
    pays5: 100,
    cellChancePercent: 4.5,
  },
  scatterStarSettings: {
    allowedReels: [0, 2, 4],
    triggerCount: 5,
    payoutMultiplier: 20,
    cellChancePercent: 6.5,
  },
  buyBonusOptions: {
    wild_1: { id: 'wild_1', costMultiplier: 50, freeSpinsCount: 5, guaranteedWilds: 1, enabled: true },
    wild_2: { id: 'wild_2', costMultiplier: 150, freeSpinsCount: 5, guaranteedWilds: 2, enabled: true },
    wild_3: { id: 'wild_3', costMultiplier: 350, freeSpinsCount: 5, guaranteedWilds: 3, enabled: true },
    random_wild: {
      id: 'random_wild',
      costMultiplier: 100,
      freeSpinsCount: 5,
      guaranteedWilds: 'random',
      enabled: true,
    },
  },
  updatedAt: new Date().toISOString(),
};

// ==========================================
// CSPRNG Helpers (Zero Math.random)
// ==========================================

function csprngFloat(): number {
  const buf = crypto.randomBytes(4);
  const int = buf.readUInt32BE(0);
  return int / 0x100000000;
}

function csprngPickWeighted<T>(items: readonly T[], weights: readonly number[]): T {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    const w = Math.max(0, Number(weights[i]) || 0);
    total += w;
  }
  if (total <= 0) {
    return items[crypto.randomInt(0, items.length)];
  }
  const roll = csprngFloat() * total;
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    acc += Math.max(0, Number(weights[i]) || 0);
    if (roll < acc) return items[i];
  }
  return items[items.length - 1];
}

function csprngShuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ==========================================
// Settings Sanitization & Persistence
// ==========================================

function cloneDefaultSettings(): GoldenTreeSettings {
  return JSON.parse(JSON.stringify(DEFAULT_GOLDEN_TREE_SETTINGS)) as GoldenTreeSettings;
}

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function normalizeGoldenTreeSettings(raw: unknown): GoldenTreeSettings {
  const def = cloneDefaultSettings();
  if (!raw || typeof raw !== 'object') return def;
  const r = raw as Record<string, any>;

  const volatility: GoldenTreeVolatility =
    r.volatility === 'low' || r.volatility === 'medium' || r.volatility === 'high'
      ? r.volatility
      : def.volatility;

  const paylines: number[][] = Array.isArray(r.paylines) && r.paylines.length === 10
    ? r.paylines.map((line: unknown, idx: number) => {
        if (Array.isArray(line) && line.length === 5) {
          return line.map((rowVal, colIdx) => {
            const parsed = Math.floor(Number(rowVal));
            return Number.isFinite(parsed) && parsed >= 0 && parsed <= 2
              ? parsed
              : def.paylines[idx][colIdx];
          });
        }
        return [...def.paylines[idx]];
      })
    : def.paylines;

  const paytable = { ...def.paytable };
  if (r.paytable && typeof r.paytable === 'object') {
    for (const sym of GOLDEN_TREE_REGULAR_SYMBOLS) {
      const entry = r.paytable[sym];
      if (entry && typeof entry === 'object') {
        const base = def.paytable[sym];
        paytable[sym] = {
          ...(sym === 'seven'
            ? { 2: clampNum(entry[2] ?? entry['2'], 0.1, 1000, base[2] ?? 1) }
            : {}),
          3: clampNum(entry[3] ?? entry['3'], 0.1, 5000, base[3]),
          4: clampNum(entry[4] ?? entry['4'], 0.1, 10000, base[4]),
          5: clampNum(entry[5] ?? entry['5'], 0.1, 100000, base[5]),
        };
      }
    }
  }

  const symbolWeights = { ...def.symbolWeights };
  if (r.symbolWeights && typeof r.symbolWeights === 'object') {
    for (const sym of GOLDEN_TREE_REGULAR_SYMBOLS) {
      symbolWeights[sym] = clampNum(r.symbolWeights[sym], 0.5, 200, def.symbolWeights[sym]);
    }
  }

  const rawWild = r.wildSettings && typeof r.wildSettings === 'object' ? r.wildSettings : {};
  const combineMode: GoldenTreeWildCombineMode =
    rawWild.combineMode === 'multiply' || rawWild.combineMode === 'sum' || rawWild.combineMode === 'max'
      ? rawWild.combineMode
      : def.wildSettings.combineMode;

  let multipliers = Array.isArray(rawWild.multipliers) && rawWild.multipliers.length > 0
    ? rawWild.multipliers.map((m: unknown) => clampNum(m, 1, 50, 1))
    : [...def.wildSettings.multipliers];

  let multiplierWeights =
    Array.isArray(rawWild.multiplierWeights) && rawWild.multiplierWeights.length === multipliers.length
      ? rawWild.multiplierWeights.map((w: unknown) => clampNum(w, 1, 1000, 10))
      : multipliers.map((_: unknown, idx: number) => def.wildSettings.multiplierWeights[idx] ?? 10);

  // Upgrade legacy [2, 3, 5] default so x1 Wild is naturally included
  if (!multipliers.includes(1)) {
    multipliers = [1, ...multipliers];
    const totalPrevW = multiplierWeights.reduce((a: number, b: number) => a + b, 0);
    const x1Weight = Math.max(15, Math.round(totalPrevW * 0.55));
    multiplierWeights = [x1Weight, ...multiplierWeights];
  }

  const rawDollar = r.scatterDollarSettings && typeof r.scatterDollarSettings === 'object' ? r.scatterDollarSettings : {};
  const rawStar = r.scatterStarSettings && typeof r.scatterStarSettings === 'object' ? r.scatterStarSettings : {};

  const buyBonusOptions = { ...def.buyBonusOptions };
  if (r.buyBonusOptions && typeof r.buyBonusOptions === 'object') {
    (['wild_1', 'wild_2', 'wild_3', 'random_wild'] as const).forEach((optId) => {
      const src = r.buyBonusOptions[optId];
      if (src && typeof src === 'object') {
        buyBonusOptions[optId] = {
          id: optId,
          costMultiplier: Math.round(clampNum(src.costMultiplier, 5, 5000, def.buyBonusOptions[optId].costMultiplier)),
          freeSpinsCount: Math.round(clampNum(src.freeSpinsCount, 1, 50, def.buyBonusOptions[optId].freeSpinsCount)),
          guaranteedWilds: def.buyBonusOptions[optId].guaranteedWilds,
          enabled: src.enabled !== false,
        };
      }
    });
  }

  return {
    enabled: r.enabled !== false,
    targetRtpPercent: Math.round(clampNum(r.targetRtpPercent, 50, 99.5, def.targetRtpPercent) * 10) / 10,
    volatility,
    maxWinMultiplier: Math.round(clampNum(r.maxWinMultiplier, 100, 100000, def.maxWinMultiplier)),
    paylines,
    paytable,
    symbolWeights,
    wildSettings: {
      allowedReels: [1, 2, 3], // Strict invariant: reels 2, 3, 4 only
      reelTriggerChancePercent: Math.round(clampNum(rawWild.reelTriggerChancePercent, 0, 50, def.wildSettings.reelTriggerChancePercent) * 10) / 10,
      multipliers,
      multiplierWeights,
      combineMode,
    },
    scatterDollarSettings: {
      pays3: clampNum(rawDollar.pays3, 1, 1000, def.scatterDollarSettings.pays3),
      pays4: clampNum(rawDollar.pays4, 1, 5000, def.scatterDollarSettings.pays4),
      pays5: clampNum(rawDollar.pays5, 1, 20000, def.scatterDollarSettings.pays5),
      cellChancePercent: Math.round(clampNum(rawDollar.cellChancePercent, 0, 25, def.scatterDollarSettings.cellChancePercent) * 10) / 10,
    },
    scatterStarSettings: {
      allowedReels: [0, 2, 4], // Strict invariant: reels 1, 3, 5 only
      triggerCount: Math.round(clampNum(rawStar.triggerCount, 3, 9, def.scatterStarSettings.triggerCount)),
      payoutMultiplier: clampNum(rawStar.payoutMultiplier, 1, 1000, def.scatterStarSettings.payoutMultiplier),
      cellChancePercent: Math.round(clampNum(rawStar.cellChancePercent, 0, 35, def.scatterStarSettings.cellChancePercent) * 10) / 10,
    },
    buyBonusOptions,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(),
  };
}

function readStore(): GoldenTreePersistedStore {
  try {
    if (fs.existsSync(GOLDEN_TREE_DATA_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(GOLDEN_TREE_DATA_FILE, 'utf-8'));
      return {
        settings: normalizeGoldenTreeSettings(parsed?.settings),
        activeBonusByUser:
          parsed?.activeBonusByUser && typeof parsed.activeBonusByUser === 'object'
            ? parsed.activeBonusByUser
            : {},
        history: Array.isArray(parsed?.history) ? parsed.history.slice(0, 1000) : [],
      };
    }
  } catch (err) {
    console.warn('[GoldenTree] Failed reading store, using defaults:', err);
  }
  return {
    settings: cloneDefaultSettings(),
    activeBonusByUser: {},
    history: [],
  };
}

let cachedStore: GoldenTreePersistedStore | null = null;

function getStore(): GoldenTreePersistedStore {
  if (!cachedStore) {
    cachedStore = readStore();
  }
  return cachedStore;
}

function writeStore(store: GoldenTreePersistedStore): void {
  cachedStore = store;
  try {
    fs.writeFileSync(GOLDEN_TREE_DATA_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[GoldenTree] Failed saving store:', err);
  }
}

export function getGoldenTreeSettings(): GoldenTreeSettings {
  return getStore().settings;
}

export function saveGoldenTreeSettings(next: GoldenTreeSettings): GoldenTreeSettings {
  const store = getStore();
  const normalized = normalizeGoldenTreeSettings({
    ...next,
    updatedAt: new Date().toISOString(),
  });
  store.settings = normalized;
  writeStore(store);
  return normalized;
}

// ==========================================
// Evaluation & Spin Generation Engine
// ==========================================

export function evaluateGoldenTreeGrid(
  columns: GoldenTreeSymbolId[][], // [5][3]
  expandedWildReels: GoldenTreeWildReelInfo[],
  betAmount: number,
  settings: GoldenTreeSettings
): GoldenTreeSpinEvaluation {
  // Build flat 3x5 row-major grid (15 items)
  const grid: GoldenTreeSymbolId[] = new Array(15);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      grid[row * 5 + col] = columns[col][row];
    }
  }

  const wildMap = new Map<number, number>();
  for (const w of expandedWildReels) {
    wildMap.set(w.col, w.multiplier);
  }

  const paylineWins: GoldenTreePaylineWin[] = [];

  for (let lineIdx = 0; lineIdx < settings.paylines.length; lineIdx++) {
    const lineRows = settings.paylines[lineIdx];
    const firstRow = lineRows[0];
    const firstSymbol = columns[0][firstRow];

    // Reel 1 never has wilds, and scatters never form payline matches
    if (
      firstSymbol === 'wild' ||
      firstSymbol === 'scatter_dollar' ||
      firstSymbol === 'scatter_star'
    ) {
      continue;
    }

    const targetSymbol: GoldenTreeRegularSymbolId = firstSymbol;
    const positions: Array<{ row: number; col: number; cellIndex: number }> = [
      { row: firstRow, col: 0, cellIndex: firstRow * 5 + 0 },
    ];
    const wildMultipliers: number[] = [];

    for (let col = 1; col < 5; col++) {
      const row = lineRows[col];
      const cellSym = columns[col][row];
      if (cellSym === targetSymbol) {
        positions.push({ row, col, cellIndex: row * 5 + col });
      } else if (cellSym === 'wild') {
        positions.push({ row, col, cellIndex: row * 5 + col });
        const wMult = wildMap.get(col) ?? 1;
        wildMultipliers.push(wMult);
      } else {
        break;
      }
    }

    const matchCount = positions.length;
    const minNeeded = targetSymbol === 'seven' ? 2 : 3;
    if (matchCount < minNeeded) {
      continue;
    }

    const entry = settings.paytable[targetSymbol];
    const baseMultiplier =
      matchCount === 2
        ? entry[2] ?? 0
        : matchCount === 3
        ? entry[3]
        : matchCount === 4
        ? entry[4]
        : entry[5];

    if (!baseMultiplier || baseMultiplier <= 0) continue;

    let appliedWildMultiplier = 1;
    if (wildMultipliers.length > 0) {
      if (settings.wildSettings.combineMode === 'sum') {
        appliedWildMultiplier = wildMultipliers.reduce((a, b) => a + b, 0);
      } else if (settings.wildSettings.combineMode === 'max') {
        appliedWildMultiplier = Math.max(...wildMultipliers);
      } else {
        appliedWildMultiplier = wildMultipliers.reduce((a, b) => a * b, 1);
      }
    }

    const totalLineMultiplier = baseMultiplier * appliedWildMultiplier;
    const linePayout = Math.round(betAmount * totalLineMultiplier);

    paylineWins.push({
      lineIndex: lineIdx,
      lineNumber: lineIdx + 1,
      symbol: targetSymbol,
      matchCount,
      positions,
      baseMultiplier,
      wildMultipliers,
      appliedWildMultiplier,
      totalLineMultiplier,
      payout: linePayout,
    });
  }

  // Scatter Evaluations
  const scatterWins: GoldenTreeScatterWin[] = [];
  const dollarPositions: Array<{ row: number; col: number; cellIndex: number }> = [];
  const starPositions: Array<{ row: number; col: number; cellIndex: number }> = [];

  for (let col = 0; col < 5; col++) {
    for (let row = 0; row < 3; row++) {
      const sym = columns[col][row];
      if (sym === 'scatter_dollar') {
        dollarPositions.push({ row, col, cellIndex: row * 5 + col });
      } else if (sym === 'scatter_star') {
        starPositions.push({ row, col, cellIndex: row * 5 + col });
      }
    }
  }

  if (dollarPositions.length >= 3) {
    const count = Math.min(5, dollarPositions.length);
    const mult =
      count >= 5
        ? settings.scatterDollarSettings.pays5
        : count === 4
        ? settings.scatterDollarSettings.pays4
        : settings.scatterDollarSettings.pays3;
    scatterWins.push({
      type: 'scatter_dollar',
      count: dollarPositions.length,
      positions: dollarPositions,
      multiplier: mult,
      payout: Math.round(betAmount * mult),
    });
  }

  if (starPositions.length >= settings.scatterStarSettings.triggerCount) {
    const mult = settings.scatterStarSettings.payoutMultiplier;
    scatterWins.push({
      type: 'scatter_star',
      count: starPositions.length,
      positions: starPositions,
      multiplier: mult,
      payout: Math.round(betAmount * mult),
    });
  }

  const sumLineMult = paylineWins.reduce((acc, w) => acc + w.totalLineMultiplier, 0);
  const sumScatterMult = scatterWins.reduce((acc, w) => acc + w.multiplier, 0);
  const rawTotalMultiplier = Math.round((sumLineMult + sumScatterMult) * 100) / 100;
  const rawPayout = Math.round(betAmount * rawTotalMultiplier);
  const maxAllowedPayout = Math.round(betAmount * settings.maxWinMultiplier);

  const cappedByMaxWin = rawPayout > maxAllowedPayout;
  const payout = cappedByMaxWin ? maxAllowedPayout : rawPayout;
  const totalMultiplier = cappedByMaxWin ? settings.maxWinMultiplier : rawTotalMultiplier;

  return {
    grid,
    columns,
    expandedWildReels,
    paylineWins,
    scatterWins,
    totalMultiplier,
    rawPayout,
    payout,
    cappedByMaxWin,
  };
}

function getEffectiveWeights(settings: GoldenTreeSettings): {
  regularWeights: number[];
  wildReelChance: number;
  dollarCellChance: number;
  starCellChance: number;
} {
  // Fair RTP & Volatility calibration factor (strictly stateless per-spin, never depends on player)
  const rtpRatio = clampNum(settings.targetRtpPercent, 50, 99.5, 96.5) / 96.5;
  const volFactor =
    settings.volatility === 'low'
      ? { topSymbolScale: 0.78, lowSymbolScale: 1.25, wildScale: 0.9 }
      : settings.volatility === 'medium'
      ? { topSymbolScale: 0.92, lowSymbolScale: 1.08, wildScale: 0.95 }
      : { topSymbolScale: 1.05, lowSymbolScale: 0.95, wildScale: 1.05 };

  const regularWeights = GOLDEN_TREE_REGULAR_SYMBOLS.map((sym) => {
    const baseW = settings.symbolWeights[sym] ?? 10;
    const isHigh = sym === 'seven' || sym === 'watermelon' || sym === 'grapes';
    const scale = isHigh ? volFactor.topSymbolScale * rtpRatio : volFactor.lowSymbolScale;
    return Math.max(0.5, baseW * scale);
  });

  const wildReelChance = clampNum(
    (settings.wildSettings.reelTriggerChancePercent / 100) * volFactor.wildScale * Math.pow(rtpRatio, 1.3),
    0,
    0.55,
    0.075
  );

  const dollarCellChance = clampNum(
    (settings.scatterDollarSettings.cellChancePercent / 100) * Math.pow(rtpRatio, 1.2),
    0,
    0.25,
    0.045
  );

  const starCellChance = clampNum(
    (settings.scatterStarSettings.cellChancePercent / 100) * Math.pow(rtpRatio, 1.2),
    0,
    0.35,
    0.065
  );

  return { regularWeights, wildReelChance, dollarCellChance, starCellChance };
}

export interface GoldenTreeUnifiedDecision {
  useClassicLevel: boolean;
  allowWin: boolean;
  tier: 'loss' | 'small_win' | 'medium_win';
  maxMultiplierCap: number;
  reason: string;
  profitLevel: number;
  targetWinRatePercent: number;
  forceZeroPayout?: boolean;
  targetMultiplierHint?: number;
  minMultiplierHint?: number;
  nearMissVisual?: boolean;
  aiPhase?: string;
  bonusNaturalLowMode?: boolean;
  bonusTargetMultiplier?: number;
  bonusMaxSpinPayoutCoins?: number;
}

function drawSingleGoldenTreeGrid(
  betAmount: number,
  settings: GoldenTreeSettings,
  forcedWildCount: 0 | 1 | 2 | 3 = 0,
  suppressSpecials: boolean = false
): GoldenTreeSpinEvaluation {
  const { regularWeights, wildReelChance, dollarCellChance, starCellChance } =
    getEffectiveWeights(settings);

  // 1. Determine which Wild reels (reels 2, 3, 4 => indices 1, 2, 3) trigger and expand
  const allowedWildCols = [1, 2, 3];
  const wildColsSet = new Set<number>();

  if (forcedWildCount > 0) {
    const shuffled = csprngShuffle(allowedWildCols);
    for (let i = 0; i < Math.min(forcedWildCount, shuffled.length); i++) {
      wildColsSet.add(shuffled[i]);
    }
    for (const col of allowedWildCols) {
      if (!wildColsSet.has(col) && csprngFloat() < wildReelChance * 0.45) {
        wildColsSet.add(col);
      }
    }
  } else if (!suppressSpecials) {
    for (const col of allowedWildCols) {
      if (csprngFloat() < wildReelChance) {
        wildColsSet.add(col);
      }
    }
  }

  const expandedWildReels: GoldenTreeWildReelInfo[] = [];
  for (const col of [1, 2, 3]) {
    if (wildColsSet.has(col)) {
      const mult = csprngPickWeighted(
        settings.wildSettings.multipliers,
        settings.wildSettings.multiplierWeights
      );
      expandedWildReels.push({ col, multiplier: mult });
    }
  }

  // 2. Populate the 5 columns x 3 rows using CSPRNG
  const columns: GoldenTreeSymbolId[][] = [];

  for (let col = 0; col < 5; col++) {
    if (wildColsSet.has(col)) {
      columns.push(['wild', 'wild', 'wild']);
      continue;
    }

    const colCells: GoldenTreeSymbolId[] = [];
    let dollarPlacedInReel = false;
    const starAllowedOnReel = col === 0 || col === 2 || col === 4; // Strict: ONLY reels 1, 3, 5 (never 2 or 4)
    const effDollarChance = suppressSpecials ? 0 : dollarCellChance;
    const effStarChance = suppressSpecials ? 0 : starCellChance;

    for (let row = 0; row < 3; row++) {
      const rollSpecial = csprngFloat();

      if (!dollarPlacedInReel && rollSpecial < effDollarChance) {
        colCells.push('scatter_dollar');
        dollarPlacedInReel = true;
        continue;
      }

      if (starAllowedOnReel && rollSpecial >= effDollarChance && rollSpecial < effDollarChance + effStarChance) {
        colCells.push('scatter_star');
        continue;
      }

      let sym = csprngPickWeighted(GOLDEN_TREE_REGULAR_SYMBOLS, regularWeights);
      if (row > 0 && colCells[row - 1] === sym && csprngFloat() < 0.3) {
        sym = csprngPickWeighted(GOLDEN_TREE_REGULAR_SYMBOLS, regularWeights);
      }
      colCells.push(sym);
    }

    columns.push(colCells);
  }

  // Safety invariant assertion: Blue Star Scatter NEVER appears on reels 2 & 4 (indices 1 & 3)
  for (const forbiddenCol of [1, 3]) {
    for (let row = 0; row < 3; row++) {
      if (columns[forbiddenCol][row] === 'scatter_star') {
        columns[forbiddenCol][row] = csprngPickWeighted(GOLDEN_TREE_REGULAR_SYMBOLS, regularWeights);
      }
    }
  }

  return evaluateGoldenTreeGrid(columns, expandedWildReels, betAmount, settings);
}

function buildGuaranteedLossGrid(
  betAmount: number,
  settings: GoldenTreeSettings
): GoldenTreeSpinEvaluation {
  // Choose disjoint symbol subsets for reel 1 (col 0) and reel 2 (col 1) so no payline can match >=3 from left
  const shuffledSyms = csprngShuffle([...GOLDEN_TREE_REGULAR_SYMBOLS]);
  const col0Pool = shuffledSyms.slice(0, 4);
  const col1Pool = shuffledSyms.slice(4);
  const columns: GoldenTreeSymbolId[][] = [
    [col0Pool[0], col0Pool[1], col0Pool[2]],
    [col1Pool[0], col1Pool[1], col1Pool[2]],
    [
      GOLDEN_TREE_REGULAR_SYMBOLS[crypto.randomInt(0, GOLDEN_TREE_REGULAR_SYMBOLS.length)],
      GOLDEN_TREE_REGULAR_SYMBOLS[crypto.randomInt(0, GOLDEN_TREE_REGULAR_SYMBOLS.length)],
      GOLDEN_TREE_REGULAR_SYMBOLS[crypto.randomInt(0, GOLDEN_TREE_REGULAR_SYMBOLS.length)],
    ],
    [
      GOLDEN_TREE_REGULAR_SYMBOLS[crypto.randomInt(0, GOLDEN_TREE_REGULAR_SYMBOLS.length)],
      GOLDEN_TREE_REGULAR_SYMBOLS[crypto.randomInt(0, GOLDEN_TREE_REGULAR_SYMBOLS.length)],
      GOLDEN_TREE_REGULAR_SYMBOLS[crypto.randomInt(0, GOLDEN_TREE_REGULAR_SYMBOLS.length)],
    ],
    [
      GOLDEN_TREE_REGULAR_SYMBOLS[crypto.randomInt(0, GOLDEN_TREE_REGULAR_SYMBOLS.length)],
      GOLDEN_TREE_REGULAR_SYMBOLS[crypto.randomInt(0, GOLDEN_TREE_REGULAR_SYMBOLS.length)],
      GOLDEN_TREE_REGULAR_SYMBOLS[crypto.randomInt(0, GOLDEN_TREE_REGULAR_SYMBOLS.length)],
    ],
  ];
  return evaluateGoldenTreeGrid(columns, [], betAmount, settings);
}

function buildControlledWinGrid(
  betAmount: number,
  settings: GoldenTreeSettings,
  maxCap: number
): GoldenTreeSpinEvaluation {
  // Pick a regular symbol whose 3-of-a-kind payout <= maxCap (fallback to lowest paying symbol)
  const candidates = [...GOLDEN_TREE_REGULAR_SYMBOLS]
    .filter((sym) => (settings.paytable[sym]?.[3] ?? 1) <= maxCap)
    .sort((a, b) => (settings.paytable[b]?.[3] ?? 0) - (settings.paytable[a]?.[3] ?? 0));
  const chosenSym: GoldenTreeSymbolId =
    candidates.length > 0
      ? candidates[crypto.randomInt(0, Math.min(candidates.length, 4))]
      : 'plum';

  const payline =
    settings.paylines[crypto.randomInt(0, settings.paylines.length)] || [1, 1, 1, 1, 1];
  const otherSyms = GOLDEN_TREE_REGULAR_SYMBOLS.filter((s) => s !== chosenSym);
  const blockPool = csprngShuffle([...otherSyms]);

  const columns: GoldenTreeSymbolId[][] = Array.from({ length: 5 }, (_, col) => {
    const targetRow = payline[col] ?? 1;
    const colArr: GoldenTreeSymbolId[] = [];
    for (let row = 0; row < 3; row++) {
      if (col < 3 && row === targetRow) {
        colArr.push(chosenSym);
      } else if (col === 3 && row === targetRow) {
        colArr.push(blockPool[0] || 'plum');
      } else {
        // Keep off-payline cells distinct from col 0 symbols where possible
        const alt = otherSyms[(col * 3 + row) % otherSyms.length];
        colArr.push(alt);
      }
    }
    return colArr;
  });

  // Ensure col 0 off-payline rows don't accidentally match col 1 & col 2
  const r0 = payline[0] ?? 1;
  for (let row = 0; row < 3; row++) {
    if (row !== r0) {
      columns[0][row] = blockPool[(row + 1) % blockPool.length];
    }
  }
  const r1 = payline[1] ?? 1;
  for (let row = 0; row < 3; row++) {
    if (row !== r1) {
      columns[1][row] = blockPool[(row + 3) % blockPool.length];
    }
  }

  return evaluateGoldenTreeGrid(columns, [], betAmount, settings);
}

function buildNearMissLossGrid(
  betAmount: number,
  settings: GoldenTreeSettings
): GoldenTreeSpinEvaluation {
  // Place two matching high-value symbols on reels 1 & 2 on the center row, blocked on reel 3
  const shuffled = csprngShuffle([...GOLDEN_TREE_REGULAR_SYMBOLS]);
  const col0Pool = shuffled.slice(0, 4);
  const col1Pool = shuffled.slice(4);
  const teaseSym: GoldenTreeSymbolId = crypto.randomInt(0, 2) === 0 ? 'seven' : 'watermelon';
  const blockSym = col1Pool.find((s) => s !== teaseSym) || col1Pool[0];
  const columns: GoldenTreeSymbolId[][] = [
    [col0Pool[0] === teaseSym ? col0Pool[1] : col0Pool[0], teaseSym, col0Pool[2] === teaseSym ? col0Pool[3] : col0Pool[2]],
    [col1Pool[0] === teaseSym ? col1Pool[1] : col1Pool[0], teaseSym, col1Pool[2] === teaseSym ? col1Pool[3] : col1Pool[2]],
    [
      blockSym,
      col1Pool[1] === teaseSym ? blockSym : col1Pool[1],
      blockSym,
    ],
    [shuffled[0], shuffled[1], shuffled[2]],
    [shuffled[3], shuffled[4], shuffled[5]],
  ];
  const evalRes = evaluateGoldenTreeGrid(columns, [], betAmount, settings);
  if (evalRes.payout === 0) return evalRes;
  return buildGuaranteedLossGrid(betAmount, settings);
}

function buildNaturalForcedWildGrid(
  betAmount: number,
  settings: GoldenTreeSettings,
  forcedWildCount: 1 | 2 | 3,
  targetPayoutCoins: number,
  maxAllowedPayoutCoins: number,
  preferX1Wilds: boolean
): GoldenTreeSpinEvaluation {
  const wildSettingsTuned: GoldenTreeSettings = preferX1Wilds
    ? {
        ...settings,
        wildSettings: {
          ...settings.wildSettings,
          multipliers: [1, 2],
          multiplierWeights: [85, 15],
        },
        scatterDollarSettings: {
          ...settings.scatterDollarSettings,
          cellChancePercent: Math.min(settings.scatterDollarSettings.cellChancePercent, 3),
        },
        scatterStarSettings: {
          ...settings.scatterStarSettings,
          cellChancePercent: Math.min(settings.scatterStarSettings.cellChancePercent, 4),
        },
      }
    : settings;

  let bestCandidate: GoldenTreeSpinEvaluation | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  // Sample realistic grids first so visuals feel genuine and organic
  for (let attempt = 0; attempt < 150; attempt++) {
    const candidate = drawSingleGoldenTreeGrid(betAmount, wildSettingsTuned, forcedWildCount, false);
    if (candidate.expandedWildReels.length < forcedWildCount) continue;
    if (candidate.payout > maxAllowedPayoutCoins) continue;
    if (forcedWildCount === 3 && candidate.payout <= 0) continue;

    const dist = Math.abs(candidate.payout - targetPayoutCoins);
    if (dist < bestDist) {
      bestDist = dist;
      bestCandidate = candidate;
    }
    if (dist <= Math.max(betAmount * 1.5, targetPayoutCoins * 0.16)) {
      return candidate;
    }
  }

  if (bestCandidate && (!preferX1Wilds || bestCandidate.payout <= maxAllowedPayoutCoins)) {
    return bestCandidate;
  }

  // Deterministic natural fallback preserving ALL forced Wild reels (e.g., 3 Wild Trees on reels 2-3-4)
  const lowPool: GoldenTreeRegularSymbolId[] = ['plum', 'lemon', 'orange', 'cherry'];
  const shuffledLow = csprngShuffle(lowPool);
  const chosenLow = shuffledLow[0] || 'cherry';
  const fillerPool = csprngShuffle(['watermelon', 'grapes', 'bell', 'seven', ...shuffledLow.slice(1)] as GoldenTreeRegularSymbolId[]);

  const wildCols =
    forcedWildCount === 3
      ? [1, 2, 3]
      : csprngShuffle([1, 2, 3]).slice(0, forcedWildCount).sort((a, b) => a - b);
  const wildColSet = new Set(wildCols);
  const expandedWildReels: GoldenTreeWildReelInfo[] = wildCols.map((col) => ({
    col,
    multiplier: 1,
  }));

  const buildColumnsWithCol0 = (col0: [GoldenTreeSymbolId, GoldenTreeSymbolId, GoldenTreeSymbolId]): GoldenTreeSymbolId[][] => {
    const cols: GoldenTreeSymbolId[][] = [];
    for (let col = 0; col < 5; col++) {
      if (col === 0) {
        cols.push([...col0]);
      } else if (wildColSet.has(col)) {
        cols.push(['wild', 'wild', 'wild']);
      } else if (col === 4) {
        // Keep reel 5 symbols distinct from col 0 winning symbol(s) so 5-of-a-kind never inflates payout
        const r5Pool = fillerPool.filter((s) => s !== col0[0] && s !== col0[1] && s !== col0[2]);
        cols.push([
          r5Pool[0] || 'watermelon',
          r5Pool[1] || 'grapes',
          r5Pool[2] || 'bell',
        ]);
      } else {
        // Non-wild reel in cols 1..3: pick disjoint symbols when trying to keep payout small
        const safePool = fillerPool.filter((s) => s !== col0[0] && s !== col0[1] && s !== col0[2]);
        cols.push([
          safePool[col % safePool.length] || 'watermelon',
          safePool[(col + 1) % safePool.length] || 'grapes',
          safePool[(col + 2) % safePool.length] || 'bell',
        ]);
      }
    }
    return cols;
  };

  // Candidate layouts for reel 1 (keeping scatters < 2 total so scatterWins is always empty)
  const col0Variants: Array<[GoldenTreeSymbolId, GoldenTreeSymbolId, GoldenTreeSymbolId]> = [
    ['scatter_dollar', chosenLow, 'scatter_star'], // Row 1 only => ~3 paylines of 3x = 9x (for wild_3)
    [chosenLow, 'scatter_dollar', 'scatter_star'], // Row 0 only => ~4 paylines of 3x = 12x
    ['scatter_star', fillerPool[0], fillerPool[1]],
    [chosenLow, 'scatter_dollar', shuffledLow[1] || 'lemon'], // 2 rows => ~18x-21x
    [chosenLow, shuffledLow[1] || 'lemon', shuffledLow[2] || 'orange'], // all 3 rows => ~30x
  ];

  let fallbackBest: GoldenTreeSpinEvaluation | null = null;
  let fallbackDist = Number.POSITIVE_INFINITY;

  for (const variant of col0Variants) {
    const evalRes = evaluateGoldenTreeGrid(
      buildColumnsWithCol0(variant),
      expandedWildReels,
      betAmount,
      settings
    );
    if (evalRes.scatterWins.length > 0) continue;
    if (evalRes.payout <= maxAllowedPayoutCoins || !fallbackBest) {
      const dist = Math.abs(evalRes.payout - targetPayoutCoins);
      if (!fallbackBest || (evalRes.payout <= maxAllowedPayoutCoins && (fallbackBest.payout > maxAllowedPayoutCoins || dist < fallbackDist))) {
        fallbackBest = evalRes;
        fallbackDist = dist;
      }
    }
  }

  return (
    fallbackBest ||
    evaluateGoldenTreeGrid(
      buildColumnsWithCol0(['scatter_dollar', chosenLow, 'scatter_star']),
      expandedWildReels,
      betAmount,
      settings
    )
  );
}

export function generateGoldenTreeSpinOutcome(
  betAmount: number,
  settings: GoldenTreeSettings,
  forcedWildCount: 0 | 1 | 2 | 3 = 0,
  unifiedDecision?: GoldenTreeUnifiedDecision
): GoldenTreeSpinEvaluation {
  // Base spin governed by the unified Admin profit algorithm + AI Monitor when supplied
  if (forcedWildCount === 0 && unifiedDecision) {
    // Absolute zero-profit kill switch overrides regular spins
    if (unifiedDecision.forceZeroPayout) {
      return buildGuaranteedLossGrid(betAmount, settings);
    }

    if (unifiedDecision.profitLevel <= 0 || !unifiedDecision.allowWin) {
      if (unifiedDecision.nearMissVisual && crypto.randomInt(0, 100) < 65) {
        return buildNearMissLossGrid(betAmount, settings);
      }
      for (let attempt = 0; attempt < 45; attempt++) {
        const candidate = drawSingleGoldenTreeGrid(
          betAmount,
          settings,
          0,
          unifiedDecision.profitLevel <= 0
        );
        if (candidate.payout === 0) {
          return candidate;
        }
      }
      return buildGuaranteedLossGrid(betAmount, settings);
    }

    const effectiveCap = Math.max(
      1,
      Math.min(settings.maxWinMultiplier, unifiedDecision.maxMultiplierCap)
    );
    const targetMult = unifiedDecision.targetMultiplierHint;
    const minHint = Math.max(1, unifiedDecision.minMultiplierHint ?? 1);
    let bestInCap: GoldenTreeSpinEvaluation | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    const attempts = targetMult ? 90 : 60;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const candidate = drawSingleGoldenTreeGrid(betAmount, settings, 0, false);
      if (candidate.payout > 0 && candidate.totalMultiplier <= effectiveCap) {
        if (targetMult) {
          if (candidate.totalMultiplier >= minHint) {
            const dist = Math.abs(candidate.totalMultiplier - targetMult);
            if (dist < bestDistance) {
              bestDistance = dist;
              bestInCap = candidate;
            }
            if (dist <= Math.max(0.6, targetMult * 0.2)) {
              return candidate;
            }
          } else if (!bestInCap) {
            bestInCap = candidate;
          }
        } else {
          if (unifiedDecision.tier === 'small_win' && candidate.totalMultiplier <= Math.min(effectiveCap, 3)) {
            return candidate;
          }
          bestInCap = candidate;
          if (unifiedDecision.tier !== 'small_win') {
            return candidate;
          }
        }
      }
    }
    if (bestInCap && (!targetMult || bestInCap.totalMultiplier >= minHint * 0.8)) {
      return bestInCap;
    }
    if (targetMult && targetMult >= 2) {
      // Build a targeted controlled win closest to targetMult
      const sortedByDist = [...GOLDEN_TREE_REGULAR_SYMBOLS]
        .map((sym) => {
          const m3 = settings.paytable[sym]?.[3] ?? 1;
          const m4 = settings.paytable[sym]?.[4] ?? 3;
          return { sym, m3, m4, dist3: Math.abs(m3 - targetMult), dist4: Math.abs(m4 - targetMult) };
        })
        .filter((x) => x.m3 <= effectiveCap)
        .sort((a, b) => Math.min(a.dist3, a.dist4) - Math.min(b.dist3, b.dist4));
      if (sortedByDist.length > 0 && bestInCap) {
        const fallback = buildControlledWinGrid(betAmount, settings, effectiveCap);
        if (
          fallback.payout > 0 &&
          fallback.totalMultiplier <= effectiveCap &&
          Math.abs(fallback.totalMultiplier - targetMult) < bestDistance
        ) {
          return fallback;
        }
        return bestInCap;
      }
    }
    if (bestInCap) return bestInCap;
    const fallbackWin = buildControlledWinGrid(betAmount, settings, effectiveCap);
    if (fallbackWin.payout > 0 && fallbackWin.totalMultiplier <= effectiveCap) {
      return fallbackWin;
    }
    return fallbackWin;
  }

  // Free Spins (Buy Bonus) Smart Algorithm coordinated with Main Algorithm & Profit Protection
  if (forcedWildCount > 0 && unifiedDecision) {
    const guaranteedWildCount: 1 | 2 | 3 = forcedWildCount === 3 ? 3 : forcedWildCount === 2 ? 2 : 1;

    // 1. Profit Disabled (absoluteStopProfit or level <= 0):
    // Give a small, natural-looking win WITH all forced Wild trees (never blatantly 0 wilds / 0 coins!)
    if (unifiedDecision.forceZeroPayout || unifiedDecision.bonusNaturalLowMode || unifiedDecision.profitLevel <= 0) {
      const targetMult = Math.max(0, unifiedDecision.bonusTargetMultiplier ?? (guaranteedWildCount === 3 ? 12 : guaranteedWildCount === 2 ? 6 : 2));
      const targetCoins = Math.round(betAmount * targetMult);
      const maxSpinCoins = Math.max(
        betAmount * (guaranteedWildCount === 3 ? 21 : guaranteedWildCount === 2 ? 12 : 6),
        unifiedDecision.bonusMaxSpinPayoutCoins ?? targetCoins * 1.45
      );
      return buildNaturalForcedWildGrid(
        betAmount,
        settings,
        guaranteedWildCount,
        targetCoins,
        Math.round(maxSpinCoins),
        true
      );
    }

    // 2. Smart Bonus Targeting driven by Main Algorithm (Ad Mode / AI Monitor / Profit Level)
    if (typeof unifiedDecision.bonusTargetMultiplier === 'number') {
      const targetCoins = Math.max(0, Math.round(betAmount * unifiedDecision.bonusTargetMultiplier));
      const maxSpinCoins = Math.max(
        targetCoins * 1.35,
        unifiedDecision.bonusMaxSpinPayoutCoins ?? Math.round(betAmount * Math.max(10, unifiedDecision.maxMultiplierCap))
      );
      const preferX1 = unifiedDecision.bonusTargetMultiplier <= (guaranteedWildCount === 3 ? 36 : guaranteedWildCount === 2 ? 16 : 6);
      return buildNaturalForcedWildGrid(
        betAmount,
        settings,
        guaranteedWildCount,
        targetCoins,
        Math.round(maxSpinCoins),
        preferX1
      );
    }

    const levelFactor = 0.65 + (Math.max(0, Math.min(10, unifiedDecision.profitLevel)) / 10) * 0.5;
    const tunedSettings: GoldenTreeSettings = {
      ...settings,
      targetRtpPercent: clampNum(settings.targetRtpPercent * levelFactor, 50, 99.5, settings.targetRtpPercent),
    };
    return drawSingleGoldenTreeGrid(betAmount, tunedSettings, guaranteedWildCount, false);
  }

  return drawSingleGoldenTreeGrid(betAmount, settings, forcedWildCount, false);
}

function buildSmartBonusSessionPlan(params: {
  bonusCost: number;
  betAmount: number;
  totalSpins: number;
  resolvedWildCount: 1 | 2 | 3;
  isAbsoluteStopped: boolean;
  unifiedDecision: GoldenTreeUnifiedDecision | null;
}): {
  profile: GoldenTreeBonusPlanProfile;
  targetBonusTotalCoins: number;
  perSpinTargetPayouts: number[];
} {
  const { bonusCost, betAmount, totalSpins, resolvedWildCount, isAbsoluteStopped, unifiedDecision } = params;
  const spins = Math.max(1, totalSpins);

  let profile: GoldenTreeBonusPlanProfile = 'balanced';
  let minRatio = 0.65;
  let maxRatio = 1.05;

  const reason = unifiedDecision?.reason || '';
  const aiPhase = unifiedDecision?.aiPhase || '';
  const profitLevel = unifiedDecision?.profitLevel ?? 5;

  if (isAbsoluteStopped || profitLevel <= 0) {
    profile = 'profit_disabled_low';
    // Natural small win strictly far below bonus cost (~14% - 26% of bonusCost)
    if (resolvedWildCount === 3) {
      minRatio = 0.16;
      maxRatio = 0.27;
    } else if (resolvedWildCount === 2) {
      minRatio = 0.14;
      maxRatio = 0.26;
    } else {
      minRatio = 0.14;
      maxRatio = 0.28;
    }
  } else if (reason.startsWith('ad_')) {
    profile = 'ad_hype';
    minRatio = reason === 'ad_balance_drop_big_hit' ? 1.55 : 1.25;
    maxRatio = reason === 'ad_balance_drop_big_hit' ? 2.45 : 1.95;
  } else if (aiPhase === 'comeback_recovery' || reason.startsWith('ai_comeback')) {
    profile = 'comeback';
    minRatio = 1.1;
    maxRatio = 1.75;
  } else if (aiPhase === 'post_big_win_drain' || aiPhase === 'platform_shield' || !unifiedDecision?.allowWin) {
    profile = 'drain_low';
    minRatio = 0.36;
    maxRatio = 0.72;
  } else if (aiPhase === 'logical_hit') {
    profile = 'balanced';
    minRatio = 0.92;
    maxRatio = 1.42;
  } else {
    profile = 'balanced';
    // Calibrated cleanly by main Admin profitLevel (1..10)
    const lvScale = Math.max(0.2, Math.min(1.25, 0.48 + (profitLevel / 10) * 0.72));
    minRatio = 0.52 * lvScale + 0.15;
    maxRatio = 0.88 * lvScale + 0.32;
  }

  const chosenRatio = minRatio + csprngFloat() * Math.max(0.03, maxRatio - minRatio);
  const rawTargetCoins = Math.round(bonusCost * chosenRatio);
  // Minimum realistic floor for 3 wilds so it never drops below ~9x per spin on average
  const minFloorCoins =
    resolvedWildCount === 3
      ? Math.round(betAmount * 9 * spins)
      : resolvedWildCount === 2
      ? Math.round(betAmount * 3 * spins)
      : Math.round(betAmount * 1.2 * spins);
  const hardLowModeCap = Math.round(bonusCost * 0.32);

  const targetBonusTotalCoins =
    profile === 'profit_disabled_low'
      ? Math.min(hardLowModeCap, Math.max(minFloorCoins, rawTargetCoins))
      : Math.max(minFloorCoins, rawTargetCoins);

  // Distribute into an organic multi-spin arc (with climax spin, never flat identical spins)
  const baseWeights =
    spins === 5
      ? csprngShuffle([0.14, 0.11, 0.21, 0.36, 0.18])
      : Array.from({ length: spins }, (_, i) => (i === Math.floor(spins * 0.7) ? 0.34 : 0.66 / Math.max(1, spins - 1)));
  const wSum = baseWeights.reduce((a, b) => a + b, 0) || 1;
  const perSpinTargetPayouts = baseWeights.map((w) =>
    Math.max(
      resolvedWildCount === 3 ? betAmount * 9 : 0,
      Math.round((targetBonusTotalCoins * w) / wSum)
    )
  );

  return {
    profile,
    targetBonusTotalCoins,
    perSpinTargetPayouts,
  };
}

// ==========================================
// Neon Persistence Helper (Optional Best-Effort)
// ==========================================

async function syncGoldenTreeToNeon(neonPool: pg.Pool | null): Promise<void> {
  if (!neonPool) return;
  try {
    await neonPool.query(`
      CREATE TABLE IF NOT EXISTS golden_tree_store (
        id TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const resDb = await neonPool.query(
      `SELECT payload, updated_at FROM golden_tree_store WHERE id = 'default' LIMIT 1`
    );
    const localStore = getStore();
    const localExists = fs.existsSync(GOLDEN_TREE_DATA_FILE);
    const localUpdatedMs = localStore.settings.updatedAt
      ? new Date(localStore.settings.updatedAt).getTime()
      : 0;

    if (resDb?.rows?.[0]?.payload) {
      const dbPayload = resDb.rows[0].payload as GoldenTreePersistedStore;
      const dbUpdatedMs = dbPayload?.settings?.updatedAt
        ? new Date(dbPayload.settings.updatedAt).getTime()
        : 0;
      if (!localExists || dbUpdatedMs > localUpdatedMs) {
        writeStore({
          settings: normalizeGoldenTreeSettings(dbPayload.settings),
          activeBonusByUser: dbPayload.activeBonusByUser || {},
          history: Array.isArray(dbPayload.history) ? dbPayload.history.slice(0, 1000) : [],
        });
        return;
      }
    }
    await pushGoldenTreeStoreToNeon(neonPool);
  } catch (err: any) {
    console.warn('[GoldenTree] Neon sync warning:', err?.message || err);
  }
}

async function pushGoldenTreeStoreToNeon(neonPool: pg.Pool | null): Promise<void> {
  if (!neonPool) return;
  try {
    const store = getStore();
    await neonPool.query(
      `INSERT INTO golden_tree_store (id, payload, updated_at)
       VALUES ('default', $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET
         payload = EXCLUDED.payload,
         updated_at = EXCLUDED.updated_at`,
      [JSON.stringify(store)]
    );
  } catch {}
}

// ==========================================
// Route Registration Dependencies & Handler
// ==========================================

export interface GoldenTreeRouteDeps {
  verifyAdminAuth: (req: Request, res: Response, next: () => void) => void;
  resolvePlayerAccountForGames: (req: Request) => Promise<
    | { ok: true; users: any[]; userIndex: number; user: any; currentCoins: number }
    | { ok: false; status: number; code?: string; message: string }
  >;
  saveStoredUsers: (users: any[]) => void;
  updateNeonProfileByIdentifier: (identifier: string, updates: Record<string, any>) => Promise<boolean>;
  getAppSettings: () => { gamesEnabled: boolean };
  recordPlayerGameOutcome: (
    playerId: string,
    game: string,
    betAmount: number,
    payout: number,
    multiplier: number,
    reason: string
  ) => void;
  evaluateUnifiedGameDecision?: (
    playerId: string,
    gameKey: string,
    betAmount: number,
    playerBalanceCoins?: number
  ) => GoldenTreeUnifiedDecision;
  getUnifiedGamesSettings?: () => {
    plinkoProfitLevel: number;
    absoluteStopProfit?: boolean;
    algorithm: { targetWinRatePercent: number; maxAllowedMultiplier: number };
  };
  getGameMaintenance?: (gameId: string) => {
    enabled: boolean;
    reasonAr: string;
    reasonEn: string;
  };
  getNeonPool: () => pg.Pool | null;
  betAmounts: readonly number[];
}

export function registerGoldenTreeRoutes(app: Express, deps: GoldenTreeRouteDeps): void {
  const {
    verifyAdminAuth,
    resolvePlayerAccountForGames,
    saveStoredUsers,
    updateNeonProfileByIdentifier,
    getAppSettings,
    recordPlayerGameOutcome,
    evaluateUnifiedGameDecision,
    getUnifiedGamesSettings,
    getGameMaintenance,
    getNeonPool,
    betAmounts,
  } = deps;

  // Per-player atomic lock preventing overlapping spins or double-spending race conditions
  const activePlayerLocks = new Set<string>();

  // Sync from Neon shortly after startup if connected
  setTimeout(() => {
    syncGoldenTreeToNeon(getNeonPool()).catch(() => {});
  }, 2500);

  // 1. Public Config & Active Bonus Recovery
  app.get('/api/games/golden-tree/config', async (req: Request, res: Response) => {
    const appSettings = getAppSettings();
    const settings = getGoldenTreeSettings();
    let activeBonusSession: GoldenTreeActiveBonusSession | null = null;

    try {
      const authHeader = (req.headers['authorization'] as string) || '';
      const hasIdentityHint =
        authHeader.startsWith('Bearer ') ||
        typeof req.query?.userId === 'string' ||
        typeof req.query?.displayId === 'string' ||
        typeof req.query?.email === 'string';
      if (hasIdentityHint) {
        const resolved = await resolvePlayerAccountForGames(req);
        if (resolved.ok) {
          const store = getStore();
          const candidate = store.activeBonusByUser[resolved.user.id];
          if (candidate && candidate.remainingSpins > 0) {
            activeBonusSession = candidate;
          }
        }
      }
    } catch {}

    const maintenance = getGameMaintenance ? getGameMaintenance('golden-tree') : { enabled: false, reasonAr: '', reasonEn: '' };

    return res.json({
      success: true,
      gamesEnabled: appSettings.gamesEnabled,
      gameEnabled: settings.enabled && !maintenance.enabled,
      maintenance,
      reelsCount: 5,
      rowsCount: 3,
      paylinesCount: settings.paylines.length,
      paylines: settings.paylines,
      paytable: settings.paytable,
      wildSettings: {
        allowedReels: settings.wildSettings.allowedReels,
        multipliers: settings.wildSettings.multipliers,
        combineMode: settings.wildSettings.combineMode,
      },
      scatterDollarSettings: {
        pays3: settings.scatterDollarSettings.pays3,
        pays4: settings.scatterDollarSettings.pays4,
        pays5: settings.scatterDollarSettings.pays5,
      },
      scatterStarSettings: {
        allowedReels: settings.scatterStarSettings.allowedReels,
        triggerCount: settings.scatterStarSettings.triggerCount,
        payoutMultiplier: settings.scatterStarSettings.payoutMultiplier,
      },
      buyBonusOptions: settings.buyBonusOptions,
      maxWinMultiplier: settings.maxWinMultiplier,
      volatility: settings.volatility,
      targetRtpPercent: settings.targetRtpPercent,
      betAmounts: [...betAmounts],
      minBet: betAmounts[0],
      maxBet: betAmounts[betAmounts.length - 1],
      activeBonusSession,
    });
  });

  // 2. Base Spin (Real Coins OR Demo Mode)
  app.post('/api/games/golden-tree/spin', async (req: Request, res: Response) => {
    let lockKey: string | null = null;
    try {
      const isDemo = Boolean(req.body?.isDemo);
      const settings = getGoldenTreeSettings();
      const maintenance = getGameMaintenance ? getGameMaintenance('golden-tree') : { enabled: false, reasonAr: '', reasonEn: '' };

      if (maintenance.enabled) {
        return res.status(503).json({
          success: false,
          code: 'GAME_MAINTENANCE',
          maintenance,
          message: maintenance.reasonAr || 'لعبة Golden Tree قيد الصيانة والتطوير حالياً',
        });
      }

      if (!isDemo) {
        if (!getAppSettings().gamesEnabled) {
          return res.status(403).json({
            success: false,
            code: 'SECTION_DISABLED',
            message: 'قسم الألعاب معطّل حالياً من قبل الإدارة',
          });
        }
        if (!settings.enabled) {
          return res.status(403).json({
            success: false,
            code: 'GAME_DISABLED',
            message: 'لعبة Golden Tree معطّلة حالياً من قبل الإدارة',
          });
        }
      }

      const rawBet = Number(req.body?.betAmount);
      const betAmount = Math.floor(rawBet);
      if (!Number.isFinite(rawBet) || !betAmounts.includes(betAmount)) {
        return res.status(400).json({
          success: false,
          message: 'قيمة الرهان غير صالحة',
        });
      }

      if (isDemo) {
        const outcome = generateGoldenTreeSpinOutcome(betAmount, settings, 0);
        return res.json({
          success: true,
          isDemo: true,
          betAmount,
          ...outcome,
          netProfit: outcome.payout - betAmount,
        });
      }

      const resolved = await resolvePlayerAccountForGames(req);
      if (!resolved.ok) {
        return res.status(resolved.status).json({
          success: false,
          message: resolved.message,
        });
      }

      const { users, userIndex, user, currentCoins } = resolved;
      const userLockKey = String(user.id);
      if (activePlayerLocks.has(userLockKey)) {
        return res.status(429).json({
          success: false,
          message: 'جولة سابقة قيد التنفيذ، يرجى الانتظار لحظة',
        });
      }
      activePlayerLocks.add(userLockKey);
      lockKey = userLockKey;

      const store = getStore();
      const pendingBonus = store.activeBonusByUser[user.id];
      if (pendingBonus && pendingBonus.remainingSpins > 0) {
        return res.status(409).json({
          success: false,
          code: 'ACTIVE_BONUS_EXISTS',
          activeBonusSession: pendingBonus,
          message: 'لديك جولة Free Spins نشطة لم تكتمل بعد',
        });
      }

      if (currentCoins < betAmount) {
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_COINS',
          currentCoins,
          message: 'رصيد الكوينز غير كافٍ لإجراء هذه اللفة',
        });
      }

      const unifiedDecision = evaluateUnifiedGameDecision
        ? evaluateUnifiedGameDecision(user.id, 'golden-tree', betAmount, currentCoins)
        : undefined;
      const outcome = generateGoldenTreeSpinOutcome(betAmount, settings, 0, unifiedDecision);
      const netProfit = outcome.payout - betAmount;
      const newCoinsBalance = Math.max(0, currentCoins - betAmount + outcome.payout);

      user.coinsBalance = newCoinsBalance;
      user.updatedAt = new Date().toISOString();
      users[userIndex] = user;
      saveStoredUsers(users);

      recordPlayerGameOutcome(
        user.id,
        'Golden Tree',
        betAmount,
        outcome.payout,
        outcome.totalMultiplier,
        unifiedDecision?.reason || 'csprng_fair'
      );

      const roundLog: GoldenTreeRoundLog = {
        id: `gt-${crypto.randomUUID().slice(0, 12)}`,
        userId: user.id,
        displayId: user.displayId,
        userName: user.name,
        mode: 'base',
        betAmount,
        wageredCoins: betAmount,
        payout: outcome.payout,
        totalMultiplier: outcome.totalMultiplier,
        wildCount: outcome.expandedWildReels.length,
        paylineHits: outcome.paylineWins.length,
        scatterHits: outcome.scatterWins.length,
        timestamp: user.updatedAt,
      };
      store.history.unshift(roundLog);
      if (store.history.length > 1000) store.history.length = 1000;
      writeStore(store);

      await updateNeonProfileByIdentifier(user.id || user.displayId || user.email, {
        coins_balance: newCoinsBalance,
        updated_at: user.updatedAt,
      }).catch(() => {});

      pushGoldenTreeStoreToNeon(getNeonPool()).catch(() => {});

      return res.json({
        success: true,
        isDemo: false,
        betAmount,
        ...outcome,
        netProfit,
        newCoinsBalance,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'حدث خطأ أثناء تشغيل اللفة',
      });
    } finally {
      if (lockKey) activePlayerLocks.delete(lockKey);
    }
  });

  // 3. Buy Bonus Activation (Deduct cost & initialize 5 Free Spins)
  app.post('/api/games/golden-tree/buy-bonus', async (req: Request, res: Response) => {
    let lockKey: string | null = null;
    try {
      const isDemo = Boolean(req.body?.isDemo);
      const settings = getGoldenTreeSettings();
      const maintenance = getGameMaintenance ? getGameMaintenance('golden-tree') : { enabled: false, reasonAr: '', reasonEn: '' };

      if (maintenance.enabled) {
        return res.status(503).json({
          success: false,
          code: 'GAME_MAINTENANCE',
          maintenance,
          message: maintenance.reasonAr || 'لعبة Golden Tree قيد الصيانة والتطوير حالياً',
        });
      }

      if (!isDemo) {
        if (!getAppSettings().gamesEnabled || !settings.enabled) {
          return res.status(403).json({
            success: false,
            code: 'GAME_DISABLED',
            message: 'لعبة Golden Tree معطّلة حالياً من قبل الإدارة',
          });
        }
      }

      const optionId = String(req.body?.optionId || '') as GoldenTreeBuyBonusOptionId;
      const option = settings.buyBonusOptions[optionId];
      if (!option || !option.enabled) {
        return res.status(400).json({
          success: false,
          message: 'خيار البونص المحدد غير متاح حالياً',
        });
      }

      const rawBet = Number(req.body?.betAmount);
      const betAmount = Math.floor(rawBet);
      if (!Number.isFinite(rawBet) || !betAmounts.includes(betAmount)) {
        return res.status(400).json({
          success: false,
          message: 'قيمة الرهان الأساسية غير صالحة',
        });
      }

      const bonusCost = Math.round(betAmount * option.costMultiplier);
      const resolvedWildCount: 1 | 2 | 3 =
        option.guaranteedWilds === 'random'
          ? ([1, 2, 3][crypto.randomInt(0, 3)] as 1 | 2 | 3)
          : (option.guaranteedWilds as 1 | 2 | 3);

      const nowIso = new Date().toISOString();

      if (isDemo) {
        const demoSession: GoldenTreeActiveBonusSession = {
          sessionId: `gt-demo-${crypto.randomUUID().slice(0, 10)}`,
          userId: 'demo',
          optionId,
          resolvedWildCount,
          betAmount,
          bonusCost,
          totalSpins: option.freeSpinsCount,
          remainingSpins: option.freeSpinsCount,
          spinsPlayed: 0,
          totalBonusWin: 0,
          spinResults: [],
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        return res.json({
          success: true,
          isDemo: true,
          activeBonusSession: demoSession,
        });
      }

      const resolved = await resolvePlayerAccountForGames(req);
      if (!resolved.ok) {
        return res.status(resolved.status).json({
          success: false,
          message: resolved.message,
        });
      }

      const { users, userIndex, user, currentCoins } = resolved;
      const userLockKey = String(user.id);
      if (activePlayerLocks.has(userLockKey)) {
        return res.status(429).json({
          success: false,
          message: 'عملية سابقة قيد التنفيذ، يرجى الانتظار',
        });
      }
      activePlayerLocks.add(userLockKey);
      lockKey = userLockKey;

      const store = getStore();
      const existing = store.activeBonusByUser[user.id];
      if (existing && existing.remainingSpins > 0) {
        return res.status(409).json({
          success: false,
          code: 'ACTIVE_BONUS_EXISTS',
          activeBonusSession: existing,
          message: 'لديك جولة Free Spins نشطة بالفعل',
        });
      }

      if (currentCoins < bonusCost) {
        return res.status(400).json({
          success: false,
          code: 'INSUFFICIENT_COINS',
          currentCoins,
          requiredCoins: bonusCost,
          message: `رصيد الكوينز غير كافٍ لشراء البونص (${bonusCost.toLocaleString()} Coin)`,
        });
      }

      const newCoinsBalance = Math.max(0, currentCoins - bonusCost);
      user.coinsBalance = newCoinsBalance;
      user.updatedAt = nowIso;
      users[userIndex] = user;
      saveStoredUsers(users);

      const unifiedBuySettings = getUnifiedGamesSettings ? getUnifiedGamesSettings() : null;
      const isBuyAbsoluteStopped = Boolean(unifiedBuySettings?.absoluteStopProfit) ||
        (unifiedBuySettings ? unifiedBuySettings.plinkoProfitLevel <= 0 : false);
      const buyUnifiedDecision = evaluateUnifiedGameDecision
        ? evaluateUnifiedGameDecision(user.id, 'golden-tree', bonusCost, currentCoins)
        : null;

      const bonusPlan = buildSmartBonusSessionPlan({
        bonusCost,
        betAmount,
        totalSpins: option.freeSpinsCount,
        resolvedWildCount,
        isAbsoluteStopped: isBuyAbsoluteStopped,
        unifiedDecision: buyUnifiedDecision,
      });

      const session: GoldenTreeActiveBonusSession = {
        sessionId: `gt-bonus-${crypto.randomUUID().slice(0, 12)}`,
        userId: user.id,
        optionId,
        resolvedWildCount,
        betAmount,
        bonusCost,
        totalSpins: option.freeSpinsCount,
        remainingSpins: option.freeSpinsCount,
        spinsPlayed: 0,
        totalBonusWin: 0,
        smartPlanProfile: bonusPlan.profile,
        targetBonusTotalCoins: bonusPlan.targetBonusTotalCoins,
        perSpinTargetPayouts: bonusPlan.perSpinTargetPayouts,
        spinResults: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      store.activeBonusByUser[user.id] = session;
      store.history.unshift({
        id: `gt-${crypto.randomUUID().slice(0, 12)}`,
        userId: user.id,
        displayId: user.displayId,
        userName: user.name,
        mode: 'bonus_buy',
        bonusOptionId: optionId,
        betAmount,
        wageredCoins: bonusCost,
        payout: 0,
        totalMultiplier: 0,
        wildCount: resolvedWildCount,
        paylineHits: 0,
        scatterHits: 0,
        timestamp: nowIso,
      });
      if (store.history.length > 1000) store.history.length = 1000;
      writeStore(store);

      await updateNeonProfileByIdentifier(user.id || user.displayId || user.email, {
        coins_balance: newCoinsBalance,
        updated_at: nowIso,
      }).catch(() => {});

      pushGoldenTreeStoreToNeon(getNeonPool()).catch(() => {});

      return res.json({
        success: true,
        isDemo: false,
        bonusCost,
        newCoinsBalance,
        activeBonusSession: session,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'حدث خطأ أثناء شراء البونص',
      });
    } finally {
      if (lockKey) activePlayerLocks.delete(lockKey);
    }
  });

  // 4. Execute One Free Spin inside Active Bonus Session
  app.post('/api/games/golden-tree/bonus-spin', async (req: Request, res: Response) => {
    let lockKey: string | null = null;
    try {
      const isDemo = Boolean(req.body?.isDemo);
      const settings = getGoldenTreeSettings();
      const maintenance = getGameMaintenance ? getGameMaintenance('golden-tree') : { enabled: false, reasonAr: '', reasonEn: '' };

      if (maintenance.enabled) {
        return res.status(503).json({
          success: false,
          code: 'GAME_MAINTENANCE',
          maintenance,
          message: maintenance.reasonAr || 'لعبة Golden Tree قيد الصيانة والتطوير حالياً',
        });
      }

      if (isDemo) {
        const rawBet = Math.floor(Number(req.body?.betAmount) || betAmounts[0]);
        const betAmount = betAmounts.includes(rawBet) ? rawBet : betAmounts[0];
        const rawWildCount = Number(req.body?.resolvedWildCount);
        const wildCount: 1 | 2 | 3 =
          rawWildCount === 1 || rawWildCount === 2 || rawWildCount === 3 ? rawWildCount : 1;
        const outcome = generateGoldenTreeSpinOutcome(betAmount, settings, wildCount);
        return res.json({
          success: true,
          isDemo: true,
          betAmount,
          ...outcome,
        });
      }

      if (!getAppSettings().gamesEnabled || !settings.enabled) {
        return res.status(403).json({
          success: false,
          code: 'GAME_DISABLED',
          message: 'لعبة Golden Tree معطّلة حالياً من قبل الإدارة',
        });
      }

      const resolved = await resolvePlayerAccountForGames(req);
      if (!resolved.ok) {
        return res.status(resolved.status).json({
          success: false,
          message: resolved.message,
        });
      }

      const { users, userIndex, user, currentCoins } = resolved;
      const userLockKey = String(user.id);
      if (activePlayerLocks.has(userLockKey)) {
        return res.status(429).json({
          success: false,
          message: 'لفة بونص قيد التنفيذ، يرجى الانتظار',
        });
      }
      activePlayerLocks.add(userLockKey);
      lockKey = userLockKey;

      const store = getStore();
      const session = store.activeBonusByUser[user.id];
      if (!session || session.remainingSpins <= 0) {
        return res.status(400).json({
          success: false,
          code: 'NO_ACTIVE_BONUS',
          message: 'لا توجد جولة Free Spins نشطة حالياً',
        });
      }

      const unifiedBonusSettings = getUnifiedGamesSettings ? getUnifiedGamesSettings() : null;
      const isAbsoluteStopped = Boolean(unifiedBonusSettings?.absoluteStopProfit) ||
        (unifiedBonusSettings ? unifiedBonusSettings.plinkoProfitLevel <= 0 : false);
      const perSpinSliceWager =
        session.remainingSpins === 1
          ? Math.max(0, session.bonusCost - Math.round(session.bonusCost / Math.max(1, session.totalSpins)) * Math.max(0, session.totalSpins - 1))
          : Math.round(session.bonusCost / Math.max(1, session.totalSpins));

      const unifiedBonusDecision = evaluateUnifiedGameDecision
        ? evaluateUnifiedGameDecision(user.id, 'golden-tree', Math.max(session.betAmount, perSpinSliceWager))
        : null;

      // Live Smart Bonus Orchestration:
      // 1) Respects real-time Absolute Stop Profit toggle (giving natural small wins even mid-bonus)
      // 2) Respects session's AI/Main Algorithm target curve while clamping overshoot
      let activeProfile: GoldenTreeBonusPlanProfile = session.smartPlanProfile || 'balanced';
      if (isAbsoluteStopped) {
        activeProfile = 'profit_disabled_low';
      } else if (unifiedBonusDecision?.reason?.startsWith('ad_')) {
        activeProfile = 'ad_hype';
      }

      let spinTargetCoins: number;
      let maxAllowedSpinCoins: number;

      if (activeProfile === 'profit_disabled_low') {
        const defaultLowTarget = Math.round(
          session.betAmount * (session.resolvedWildCount === 3 ? 12 : session.resolvedWildCount === 2 ? 6 : 2)
        );
        const lowTotalCap = Math.round(session.bonusCost * 0.28);
        const remainingRoom = Math.max(session.betAmount * (session.resolvedWildCount === 3 ? 9 : 1), lowTotalCap - session.totalBonusWin);
        const scheduled = session.perSpinTargetPayouts?.[session.spinsPlayed] ?? defaultLowTarget;
        spinTargetCoins = Math.min(remainingRoom, Math.max(session.resolvedWildCount === 3 ? session.betAmount * 9 : 0, Math.min(scheduled, defaultLowTarget * 1.45)));
        maxAllowedSpinCoins = Math.max(
          session.resolvedWildCount === 3 ? session.betAmount * 21 : session.betAmount * 10,
          Math.min(remainingRoom, Math.round(spinTargetCoins * 1.45))
        );
      } else {
        const fallbackTotal = Math.round(session.bonusCost * (activeProfile === 'ad_hype' ? 1.55 : activeProfile === 'drain_low' ? 0.52 : 0.88));
        const sessionBudget = session.targetBonusTotalCoins ?? fallbackTotal;
        const remainingBudget = Math.max(0, sessionBudget - session.totalBonusWin);
        const planned = session.perSpinTargetPayouts?.[session.spinsPlayed] ?? Math.round(sessionBudget / Math.max(1, session.totalSpins));
        if (session.remainingSpins <= 1) {
          spinTargetCoins = remainingBudget;
        } else {
          spinTargetCoins = Math.min(
            Math.round(remainingBudget * 0.65 + session.betAmount * 3),
            planned
          );
        }
        if (activeProfile === 'drain_low') {
          const hardDrainTotalCap = Math.round(session.bonusCost * 0.78);
          maxAllowedSpinCoins = Math.max(
            session.betAmount * (session.resolvedWildCount === 3 ? 9 : 2),
            hardDrainTotalCap - session.totalBonusWin
          );
        } else {
          maxAllowedSpinCoins = Math.max(
            spinTargetCoins * 1.45,
            Math.round(session.betAmount * Math.max(25, (unifiedBonusSettings?.algorithm.maxAllowedMultiplier ?? 25) * session.resolvedWildCount * 4))
          );
        }
      }

      const bonusUnifiedContext: GoldenTreeUnifiedDecision | undefined = unifiedBonusSettings
        ? {
            useClassicLevel: false,
            allowWin: true,
            forceZeroPayout: isAbsoluteStopped,
            bonusNaturalLowMode: activeProfile === 'profit_disabled_low',
            bonusTargetMultiplier: Math.round((spinTargetCoins / Math.max(1, session.betAmount)) * 100) / 100,
            bonusMaxSpinPayoutCoins: maxAllowedSpinCoins,
            tier: activeProfile === 'profit_disabled_low' || activeProfile === 'drain_low' ? 'small_win' : 'medium_win',
            maxMultiplierCap: isAbsoluteStopped
              ? 25
              : Math.max(12, Math.round(maxAllowedSpinCoins / Math.max(1, session.betAmount))),
            reason: isAbsoluteStopped
              ? 'bonus_profit_disabled_natural_low'
              : unifiedBonusDecision?.reason
              ? `${unifiedBonusDecision.reason}_bonus_${session.optionId}`
              : `bonus_${activeProfile}_${session.optionId}`,
            profitLevel: unifiedBonusSettings.plinkoProfitLevel,
            targetWinRatePercent: unifiedBonusSettings.algorithm.targetWinRatePercent,
          }
        : undefined;

      const outcome = generateGoldenTreeSpinOutcome(
        session.betAmount,
        settings,
        session.resolvedWildCount,
        bonusUnifiedContext
      );

      const nowIso = new Date().toISOString();
      session.remainingSpins -= 1;
      session.spinsPlayed += 1;
      session.totalBonusWin = Math.round(session.totalBonusWin + outcome.payout);
      session.updatedAt = nowIso;
      session.spinResults.push({
        spinNumber: session.spinsPlayed,
        payout: outcome.payout,
        totalMultiplier: outcome.totalMultiplier,
        expandedWildReels: outcome.expandedWildReels,
        timestamp: nowIso,
      });

      const newCoinsBalance = Math.max(0, currentCoins + outcome.payout);
      user.coinsBalance = newCoinsBalance;
      user.updatedAt = nowIso;
      users[userIndex] = user;
      saveStoredUsers(users);

      const relSpinMult = perSpinSliceWager > 0
        ? Math.round((outcome.payout / perSpinSliceWager) * 100) / 100
        : outcome.totalMultiplier;
      recordPlayerGameOutcome(
        user.id,
        'Golden Tree',
        perSpinSliceWager,
        outcome.payout,
        relSpinMult,
        bonusUnifiedContext?.reason || `bonus_${session.optionId}`
      );

      store.history.unshift({
        id: `gt-${crypto.randomUUID().slice(0, 12)}`,
        userId: user.id,
        displayId: user.displayId,
        userName: user.name,
        mode: 'free_spin',
        bonusOptionId: session.optionId,
        betAmount: session.betAmount,
        wageredCoins: 0,
        payout: outcome.payout,
        totalMultiplier: outcome.totalMultiplier,
        wildCount: outcome.expandedWildReels.length,
        paylineHits: outcome.paylineWins.length,
        scatterHits: outcome.scatterWins.length,
        timestamp: nowIso,
      });
      if (store.history.length > 1000) store.history.length = 1000;

      const completedSession = { ...session };
      if (session.remainingSpins <= 0) {
        delete store.activeBonusByUser[user.id];
      } else {
        store.activeBonusByUser[user.id] = session;
      }
      writeStore(store);

      await updateNeonProfileByIdentifier(user.id || user.displayId || user.email, {
        coins_balance: newCoinsBalance,
        updated_at: nowIso,
      }).catch(() => {});

      pushGoldenTreeStoreToNeon(getNeonPool()).catch(() => {});

      return res.json({
        success: true,
        isDemo: false,
        betAmount: session.betAmount,
        ...outcome,
        newCoinsBalance,
        bonusCompleted: completedSession.remainingSpins <= 0,
        activeBonusSession: completedSession.remainingSpins > 0 ? completedSession : null,
        bonusSummary: completedSession,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'حدث خطأ أثناء تنفيذ لفة البونص',
      });
    } finally {
      if (lockKey) activePlayerLocks.delete(lockKey);
    }
  });

  // 5. Admin: Get Golden Tree Settings & History
  app.get('/api/admin/games/golden-tree/settings', verifyAdminAuth, (_req: Request, res: Response) => {
    const store = getStore();
    const totalWagered = store.history.reduce((s, r) => s + (r.wageredCoins || 0), 0);
    const totalPayout = store.history.reduce((s, r) => s + (r.payout || 0), 0);
    return res.json({
      success: true,
      settings: store.settings,
      defaults: DEFAULT_GOLDEN_TREE_SETTINGS,
      stats: {
        totalRounds: store.history.length,
        totalWagered,
        totalPayout,
        netHouseProfit: totalWagered - totalPayout,
        actualRtpPercent:
          totalWagered > 0 ? Math.round((totalPayout / totalWagered) * 1000) / 10 : 0,
      },
      history: store.history.slice(0, 120),
    });
  });

  // 6. Admin: Update Golden Tree Settings
  app.post('/api/admin/games/golden-tree/settings', verifyAdminAuth, async (req: Request, res: Response) => {
    try {
      const current = getGoldenTreeSettings();
      const incoming = req.body?.settings && typeof req.body.settings === 'object'
        ? req.body.settings
        : req.body;
      const merged = normalizeGoldenTreeSettings({
        ...current,
        ...incoming,
        paytable: incoming?.paytable ? { ...current.paytable, ...incoming.paytable } : current.paytable,
        symbolWeights: incoming?.symbolWeights
          ? { ...current.symbolWeights, ...incoming.symbolWeights }
          : current.symbolWeights,
        wildSettings: incoming?.wildSettings
          ? { ...current.wildSettings, ...incoming.wildSettings }
          : current.wildSettings,
        scatterDollarSettings: incoming?.scatterDollarSettings
          ? { ...current.scatterDollarSettings, ...incoming.scatterDollarSettings }
          : current.scatterDollarSettings,
        scatterStarSettings: incoming?.scatterStarSettings
          ? { ...current.scatterStarSettings, ...incoming.scatterStarSettings }
          : current.scatterStarSettings,
        buyBonusOptions: incoming?.buyBonusOptions
          ? { ...current.buyBonusOptions, ...incoming.buyBonusOptions }
          : current.buyBonusOptions,
        updatedAt: new Date().toISOString(),
      });
      const saved = saveGoldenTreeSettings(merged);
      await pushGoldenTreeStoreToNeon(getNeonPool());
      return res.json({
        success: true,
        settings: saved,
        message: 'تم حفظ إعدادات لعبة Golden Tree بنجاح',
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'فشل حفظ إعدادات Golden Tree',
      });
    }
  });

  // 7. Admin: Reset Defaults
  app.post('/api/admin/games/golden-tree/reset', verifyAdminAuth, async (_req: Request, res: Response) => {
    const saved = saveGoldenTreeSettings(cloneDefaultSettings());
    await pushGoldenTreeStoreToNeon(getNeonPool());
    return res.json({
      success: true,
      settings: saved,
      message: 'تمت استعادة الإعدادات الافتراضية للعبة Golden Tree',
    });
  });
}
