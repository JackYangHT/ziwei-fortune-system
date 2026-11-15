/**
 * 三层飞化原始计数矩阵 (matrix.ts)
 *
 * 硬约束：
 * 1. 本模块只输出 raw counts（原始飞化次数），不做任何加权计算。
 * 2. 不修改 lib/ziwei/，仅只读引用其类型与四化查表工具。
 */

import { BRANCHES, STEMS } from '../ziwei/constants';
import { getSiHuaByStem, getYearBranchIndex, getYearStemIndex } from '../ziwei/sihua';
import type { Palace, SiHua, ZiweiChart } from '../ziwei/types';
import type {
  FlyingEdge,
  FlyingLayer,
  RawFlyingMatrix,
  RawPalaceMatrixStats,
  RawSiHuaCounts,
} from './types';

const SIHUA_KEYS: readonly SiHua[] = ['禄', '权', '科', '忌'] as const;

export function createEmptyRawCounts(): RawSiHuaCounts {
  return { lu: 0, quan: 0, ke: 0, ji: 0 };
}

function incrementCount(counts: RawSiHuaCounts, siHua: SiHua): void {
  if (siHua === '禄') counts.lu += 1;
  else if (siHua === '权') counts.quan += 1;
  else if (siHua === '科') counts.ke += 1;
  else if (siHua === '忌') counts.ji += 1;
}

function findStarPalace(chart: ZiweiChart, starName: string): Palace | undefined {
  if (!starName) return undefined;
  return chart.palaces.find((p) => p.stars.some((s) => s.name === starName));
}

export interface BuildMatrixOptions {
  daXianIndex?: number;
  referenceYear?: number;
}

/**
 * 构建 12 宫三层（本命各宫宫干 + 当前大限宫干 + 流年命宫宫干）原始飞化计数矩阵
 * 仅输出未加权的 raw counts。
 */
export function buildRawFlyingMatrix(
  chart: ZiweiChart,
  options: BuildMatrixOptions = {},
): RawFlyingMatrix {
  const referenceYear = options.referenceYear ?? new Date().getFullYear();
  const dxIndex =
    options.daXianIndex !== undefined
      ? options.daXianIndex
      : chart.currentDaXianIndex;

  // 按地支 0..11 排序的宫位表
  const palacesByBranch: Palace[] = new Array(12);
  for (let b = 0; b < 12; b++) {
    const found = chart.palaces.find((p) => p.branch === b);
    if (found) {
      palacesByBranch[b] = found;
    } else {
      palacesByBranch[b] = {
        branch: b,
        stem: 0,
        name: BRANCHES[b],
        stars: [],
      };
    }
  }

  // 初始化 12×12 宫对宫原始计数网格
  const grid: RawSiHuaCounts[][] = Array.from({ length: 12 }, () =>
    Array.from({ length: 12 }, () => createEmptyRawCounts()),
  );

  // 初始化 12 宫原始统计
  const byPalace: RawPalaceMatrixStats[] = palacesByBranch.map((p) => ({
    branch: p.branch,
    branchName: BRANCHES[p.branch] ?? '',
    palaceName: p.name,
    stemIndex: p.stem,
    stemName: STEMS[p.stem] ?? '',
    incoming: {
      natal: createEmptyRawCounts(),
      decadal: createEmptyRawCounts(),
      yearly: createEmptyRawCounts(),
      total: createEmptyRawCounts(),
    },
    outgoing: createEmptyRawCounts(),
    selfSihua: createEmptyRawCounts(),
    centripetalSihua: createEmptyRawCounts(),
  }));

  const edges: FlyingEdge[] = [];

  const recordEdge = (layer: FlyingLayer, fromPalace: Palace, stemIndex: number) => {
    const transforms = getSiHuaByStem(stemIndex);
    const stemName = STEMS[stemIndex] ?? '';
    const fromBranch = fromPalace.branch;
    const fromBranchName = BRANCHES[fromBranch] ?? '';

    for (const sh of SIHUA_KEYS) {
      const starName = transforms[sh];
      const targetPalace = findStarPalace(chart, starName);
      if (!targetPalace) continue;

      const toBranch = targetPalace.branch;
      const toBranchName = BRANCHES[toBranch] ?? '';
      const isSelf = toBranch === fromBranch;
      const isCentripetal = toBranch === (fromBranch + 6) % 12;

      edges.push({
        layer,
        fromBranch,
        fromBranchName,
        fromPalace: fromPalace.name,
        stemIndex,
        stemName,
        siHua: sh,
        starName,
        toBranch,
        toBranchName,
        toPalace: targetPalace.name,
        isSelf,
        isCentripetal,
      });

      // 累加 12×12 网格与各宫进出统计（纯 raw count +1）
      incrementCount(grid[fromBranch][toBranch], sh);
      incrementCount(byPalace[fromBranch].outgoing, sh);
      incrementCount(byPalace[toBranch].incoming[layer], sh);
      incrementCount(byPalace[toBranch].incoming.total, sh);

      if (layer === 'natal') {
        if (isSelf) {
          incrementCount(byPalace[fromBranch].selfSihua, sh);
        }
        if (isCentripetal) {
          incrementCount(byPalace[toBranch].centripetalSihua, sh);
        }
      }
    }
  };

  // 第一层 (natal)：本命盘 12 宫各自的宫干飞化
  for (let b = 0; b < 12; b++) {
    const p = palacesByBranch[b];
    recordEdge('natal', p, p.stem);
  }

  // 第二层 (decadal)：当前大限宫干飞化
  let activeDecadalPalace: RawFlyingMatrix['activeDecadalPalace'] = null;
  const dx = dxIndex >= 0 && dxIndex < chart.daXians.length ? chart.daXians[dxIndex] : chart.daXians[0];
  if (dx) {
    const dxPalace = palacesByBranch[dx.palaceBranch];
    if (dxPalace) {
      const dxStem = dx.stemIndex !== undefined ? dx.stemIndex : dxPalace.stem;
      activeDecadalPalace = {
        daXianIndex: dxIndex >= 0 ? dxIndex : 0,
        branch: dxPalace.branch,
        branchName: BRANCHES[dxPalace.branch] ?? '',
        palaceName: dxPalace.name,
        stemIndex: dxStem,
        stemName: STEMS[dxStem] ?? '',
        ageRange: [dx.startAge, dx.endAge],
      };
      recordEdge('decadal', dxPalace, dxStem);
    }
  }

  // 第三层 (yearly)：流年太岁宫位（流年地支所在宫）以流年天干起四化飞星
  const yearlyBranch = getYearBranchIndex(referenceYear);
  const yearlyStem = getYearStemIndex(referenceYear);
  const yearlyPalace = palacesByBranch[yearlyBranch];
  const activeYearlyPalace: RawFlyingMatrix['activeYearlyPalace'] = {
    year: referenceYear,
    branch: yearlyBranch,
    branchName: BRANCHES[yearlyBranch] ?? '',
    palaceName: yearlyPalace.name,
    stemIndex: yearlyStem,
    stemName: STEMS[yearlyStem] ?? '',
  };
  recordEdge('yearly', yearlyPalace, yearlyStem);

  return {
    edges,
    grid,
    byPalace,
    activeDecadalPalace,
    activeYearlyPalace,
  };
}
