/**
 * 磁场化主计算引擎 (magnetic-field.ts)
 *
 * 公式：
 * 磁场化 = 体（生年四化落点 + 来因宫使命群组）
 *        + 用（三层飞化矩阵的净权重场）
 *        + 方向（禄随忌走的轨迹）
 *        + 权重（双轨制：飞星矩阵优先，三合格局做背景）
 */

import { BRANCHES, STEMS } from '../ziwei/constants';
import type { Pattern } from '../ziwei/patterns';
import { detectDingFu } from '../ziwei/patterns-dingfu';
import { detectDingGui } from '../ziwei/patterns-dinggui';
import { detectDingPin } from '../ziwei/patterns-dingpin';
import { detectSelfSihua, getSiHuaByStem } from '../ziwei/sihua';
import type { Palace, SiHua, ZiweiChart } from '../ziwei/types';
import {
  DUAL_TRACK_CONFIG,
  FLYING_LAYER_WEIGHTS,
  getPalaceDomainType,
  NATAL_LANDING_WEIGHTS,
  SANHE_PATTERN_LEVEL_SCORES,
  SELF_SIHUA_WEIGHTS,
  SIHUA_BASE_WEIGHTS,
} from './config';
import { buildRawFlyingMatrix } from './matrix';
import { evaluateFlyingRules } from './patterns';
import type {
  DualTrackWeightSummary,
  LaiYinMissionGroup,
  LuFollowsJiVector,
  MagneticBody,
  MagneticField,
  MagneticFieldInput,
  NatalSiHuaLanding,
  PalaceRef,
  RawFlyingMatrix,
  WeightedPalaceField,
} from './types';

const SIHUA_KEYS: readonly SiHua[] = ['禄', '权', '科', '忌'] as const;

function getPalaceByBranch(chart: ZiweiChart, branch: number): Palace {
  const norm = ((branch % 12) + 12) % 12;
  return (
    chart.palaces.find((p) => p.branch === norm) ?? {
      branch: norm,
      stem: 0,
      name: BRANCHES[norm] ?? '',
      stars: [],
    }
  );
}

function toPalaceRef(p: Palace): PalaceRef {
  return {
    branch: p.branch,
    branchName: BRANCHES[p.branch] ?? '',
    palaceName: p.name,
  };
}

function classifyBranchRelation(
  luTargetBranch: number,
  jiTargetBranch: number,
): LuFollowsJiVector['relation'] {
  if (luTargetBranch === jiTargetBranch) return 'same-palace';
  if ((luTargetBranch + 6) % 12 === jiTargetBranch) return 'opposite-palace';
  if (
    (luTargetBranch + 4) % 12 === jiTargetBranch ||
    (luTargetBranch + 8) % 12 === jiTargetBranch
  ) {
    return 'sanhe-palace';
  }
  const diff = Math.abs(luTargetBranch - jiTargetBranch);
  if (diff === 1 || diff === 11) {
    return 'clamp';
  }
  return 'other-palace';
}

/**
 * 1. 构建「体」：生年四化落点 + 来因宫使命群组
 * - 来因宫定位：宫干 === 生年天干（chart.lunarInfo.yearStem）。
 *   因五虎遁十二宫中子、丑两宫与寅、卯两宫天干重复，钦天四化派来因宫以寅起十二宫常规位优先匹配（排除子、丑重复干，若仅子/丑匹配则取该宫）。
 */
export function buildMagneticBody(chart: ZiweiChart): MagneticBody {
  const birthYearStemIndex = chart.lunarInfo.yearStem;
  const birthYearStemName = STEMS[birthYearStemIndex] ?? '甲';

  // 来因宫匹配（优先非子/丑宫，即 branch >= 2）
  const laiYinPalace =
    chart.palaces.find(
      (p) => p.stem === birthYearStemIndex && p.branch !== 0 && p.branch !== 1,
    ) ??
    chart.palaces.find((p) => p.stem === birthYearStemIndex) ??
    getPalaceByBranch(chart, chart.mingGongBranch);

  const lyBranch = laiYinPalace.branch;
  const sanHeBranches = [lyBranch, (lyBranch + 4) % 12, (lyBranch + 8) % 12];
  const oppBranch = (lyBranch + 6) % 12;

  const laiYin: LaiYinMissionGroup = {
    branch: lyBranch,
    branchName: BRANCHES[lyBranch] ?? '',
    palaceName: laiYinPalace.name,
    stemIndex: laiYinPalace.stem,
    stemName: STEMS[laiYinPalace.stem] ?? birthYearStemName,
    domainType: getPalaceDomainType(laiYinPalace.name),
    sanHePalaces: sanHeBranches.map((b) => toPalaceRef(getPalaceByBranch(chart, b))),
    oppositePalace: toPalaceRef(getPalaceByBranch(chart, oppBranch)),
  };

  // 生年四化落宫
  const natalTransforms = getSiHuaByStem(birthYearStemIndex);
  const natalSihua = {} as Record<SiHua, NatalSiHuaLanding>;

  for (const sh of SIHUA_KEYS) {
    const starName = natalTransforms[sh];
    const targetPalace =
      chart.palaces.find((p) => p.stars.some((s) => s.name === starName)) ??
      laiYinPalace;
    const selfList = detectSelfSihua(targetPalace);
    const hasSelfSihua = selfList.some((item) => item.starName === starName);

    natalSihua[sh] = {
      siHua: sh,
      starName,
      branch: targetPalace.branch,
      branchName: BRANCHES[targetPalace.branch] ?? '',
      palaceName: targetPalace.name,
      domainType: getPalaceDomainType(targetPalace.name),
      hasSelfSihua,
    };
  }

  return {
    birthYearStemIndex,
    birthYearStemName,
    natalSihua,
    laiYin,
  };
}

/**
 * 2. 构建「用」：将 config.ts 的权重施加在 rawMatrix 上，计算 12 宫净权重场
 */
export function buildWeightedField(
  body: MagneticBody,
  rawMatrix: RawFlyingMatrix,
): WeightedPalaceField[] {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return rawMatrix.byPalace.map((stat) => {
    const wNatal = FLYING_LAYER_WEIGHTS.natal;
    const wDecadal = FLYING_LAYER_WEIGHTS.decadal;
    const wYearly = FLYING_LAYER_WEIGHTS.yearly;

    const effLuCount =
      stat.incoming.natal.lu * wNatal +
      stat.incoming.decadal.lu * wDecadal +
      stat.incoming.yearly.lu * wYearly;
    const effQuanCount =
      stat.incoming.natal.quan * wNatal +
      stat.incoming.decadal.quan * wDecadal +
      stat.incoming.yearly.quan * wYearly;
    const effKeCount =
      stat.incoming.natal.ke * wNatal +
      stat.incoming.decadal.ke * wDecadal +
      stat.incoming.yearly.ke * wYearly;
    const effJiCount =
      stat.incoming.natal.ji * wNatal +
      stat.incoming.decadal.ji * wDecadal +
      stat.incoming.yearly.ji * wYearly;

    const luScore = round2(effLuCount * SIHUA_BASE_WEIGHTS['禄']);
    const quanScore = round2(effQuanCount * SIHUA_BASE_WEIGHTS['权']);
    const keScore = round2(effKeCount * SIHUA_BASE_WEIGHTS['科']);
    const jiScore = round2(effJiCount * SIHUA_BASE_WEIGHTS['忌']);
    const incomingNet = round2(luScore + quanScore + keScore + jiScore);

    // 生年四化坐落本宫的先天「体」基底分
    let natalBaseScore = 0;
    for (const sh of SIHUA_KEYS) {
      if (body.natalSihua[sh].branch === stat.branch) {
        natalBaseScore += NATAL_LANDING_WEIGHTS[sh];
      }
    }
    natalBaseScore = round2(natalBaseScore);

    // 离心自化与向心自化修正
    const selfDelta =
      stat.selfSihua.lu * SELF_SIHUA_WEIGHTS.centrifugal['禄'] +
      stat.selfSihua.quan * SELF_SIHUA_WEIGHTS.centrifugal['权'] +
      stat.selfSihua.ke * SELF_SIHUA_WEIGHTS.centrifugal['科'] +
      stat.selfSihua.ji * SELF_SIHUA_WEIGHTS.centrifugal['忌'];

    const centripetalDelta =
      stat.centripetalSihua.lu * SELF_SIHUA_WEIGHTS.centripetal['禄'] +
      stat.centripetalSihua.quan * SELF_SIHUA_WEIGHTS.centripetal['权'] +
      stat.centripetalSihua.ke * SELF_SIHUA_WEIGHTS.centripetal['科'] +
      stat.centripetalSihua.ji * SELF_SIHUA_WEIGHTS.centripetal['忌'];

    const selfAndCentripetalDelta = round2(selfDelta + centripetalDelta);
    const totalNetWeight = round2(
      incomingNet + natalBaseScore + selfAndCentripetalDelta,
    );

    return {
      branch: stat.branch,
      branchName: stat.branchName,
      palaceName: stat.palaceName,
      domainType: getPalaceDomainType(stat.palaceName),
      rawIncoming: stat.incoming.total,
      weightedIncoming: {
        lu: luScore,
        quan: quanScore,
        ke: keScore,
        ji: jiScore,
        net: incomingNet,
      },
      natalBaseScore,
      selfAndCentripetalDelta,
      totalNetWeight,
    };
  });
}

/**
 * 3. 构建「方向」：禄随忌走的能量轨迹矢量
 * - 涵盖：来因宫（生年四化同干）、命宫、大限宫、流年宫及全盘 12 宫各自的「化禄落宫 → 化忌落宫」矢量
 */
export function buildLuFollowsJiVectors(
  chart: ZiweiChart,
  body: MagneticBody,
  rawMatrix: RawFlyingMatrix,
): LuFollowsJiVector[] {
  const vectors: LuFollowsJiVector[] = [];

  const createVectorFromStem = (
    id: string,
    level: LuFollowsJiVector['level'],
    sourcePalaceName: string,
    sourceBranch: number,
    stemIndex: number,
  ): LuFollowsJiVector | null => {
    const transforms = getSiHuaByStem(stemIndex);
    const stemName = STEMS[stemIndex] ?? '';
    const luStar = transforms['禄'];
    const jiStar = transforms['忌'];
    const luPalace = chart.palaces.find((p) => p.stars.some((s) => s.name === luStar));
    const jiPalace = chart.palaces.find((p) => p.stars.some((s) => s.name === jiStar));
    if (!luPalace || !jiPalace) return null;

    const sourceBranchName = BRANCHES[sourceBranch] ?? '';
    const luBranchName = BRANCHES[luPalace.branch] ?? '';
    const jiBranchName = BRANCHES[jiPalace.branch] ?? '';
    const relation = classifyBranchRelation(luPalace.branch, jiPalace.branch);

    return {
      id,
      level,
      sourcePalace: sourcePalaceName,
      sourceBranch,
      sourceBranchName,
      stemName,
      luStar,
      luTargetPalace: luPalace.name,
      luTargetBranch: luPalace.branch,
      luTargetBranchName: luBranchName,
      jiStar,
      jiTargetPalace: jiPalace.name,
      jiTargetBranch: jiPalace.branch,
      jiTargetBranchName: jiBranchName,
      relation,
      trajectory: `${sourcePalaceName}(${stemName}${sourceBranchName})：${luStar}化禄入${luPalace.name}(${luBranchName}) → 禄随忌走 → ${jiStar}化忌入${jiPalace.name}(${jiBranchName})`,
    };
  };

  // (1) 生年 / 来因宫使命主轨迹
  const natalVec = createVectorFromStem(
    'natal-laiyin',
    'laiYin',
    body.laiYin.palaceName,
    body.laiYin.branch,
    body.birthYearStemIndex,
  );
  if (natalVec) vectors.push(natalVec);

  // (2) 本命命宫轨迹
  const mingPalace = getPalaceByBranch(chart, chart.mingGongBranch);
  const mingVec = createVectorFromStem(
    'natal-minggong',
    'mingGong',
    mingPalace.name,
    mingPalace.branch,
    mingPalace.stem,
  );
  if (mingVec) vectors.push(mingVec);

  // (3) 当前大限轨迹
  if (rawMatrix.activeDecadalPalace) {
    const dx = rawMatrix.activeDecadalPalace;
    const dxVec = createVectorFromStem(
      `decadal-${dx.daXianIndex}`,
      'decadal',
      dx.palaceName,
      dx.branch,
      dx.stemIndex,
    );
    if (dxVec) vectors.push(dxVec);
  }

  // (4) 流年太岁宫轨迹
  const yr = rawMatrix.activeYearlyPalace;
  const yrVec = createVectorFromStem(
    `yearly-${yr.year}`,
    'yearly',
    yr.palaceName,
    yr.branch,
    yr.stemIndex,
  );
  if (yrVec) vectors.push(yrVec);

  // (5) 12 宫本命飞化各自「禄随忌走」矢量
  for (let b = 0; b < 12; b++) {
    const p = getPalaceByBranch(chart, b);
    const v = createVectorFromStem(
      `palace-${b}`,
      'palace',
      p.name,
      p.branch,
      p.stem,
    );
    if (v) vectors.push(v);
  }

  return vectors;
}

let cachedDetectPatterns: ((chart: ZiweiChart) => Pattern[]) | null = null;

function resolveSanhePatterns(chart: ZiweiChart): Pattern[] {
  if (!cachedDetectPatterns) {
    if (typeof window === 'undefined') {
      try {
        // lib/ziwei/patterns.ts 顶部含 `import 'server-only'`，在服务端/Node 环境下动态加载
        const dynamicReq = eval('require') as NodeRequire;
        const nodeModule = dynamicReq('node:module') as {
          _load?: (request: string, parent: unknown, isMain: boolean) => unknown;
        };
        if (nodeModule && typeof nodeModule._load === 'function') {
          const origLoad = nodeModule._load;
          nodeModule._load = function patchedLoad(
            request: string,
            parent: unknown,
            isMain: boolean,
          ) {
            if (request === 'server-only') return {};
            return origLoad.call(this, request, parent, isMain);
          };
        }
        const mod = dynamicReq('../ziwei/patterns') as typeof import('../ziwei/patterns');
        cachedDetectPatterns = mod.detectPatterns;
      } catch {
        // 打包器环境下回退
      }
    }
    if (!cachedDetectPatterns) {
      cachedDetectPatterns = (c: ZiweiChart): Pattern[] => [
        ...detectDingGui(c).map((h) => ({
          name: h.name,
          level: 'excellent' as const,
          description: h.note,
          palaces: ['命宫'],
        })),
        ...detectDingFu(c).map((h) => ({
          name: h.name,
          level: 'good' as const,
          description: h.note,
          palaces: ['命宫'],
        })),
        ...detectDingPin(c).map((h) => ({
          name: h.name,
          level: 'caution' as const,
          description: h.note,
          palaces: ['命宫'],
        })),
      ];
    }
  }
  return cachedDetectPatterns(chart);
}

/**
 * 4. 构建「权重」：双轨制（飞星矩阵优先 0.7 + 三合格局背景 0.3）
 */
export function buildDualTrackWeighting(
  chart: ZiweiChart,
  body: MagneticBody,
  rawMatrix: RawFlyingMatrix,
  weightedField: WeightedPalaceField[],
  vectors: LuFollowsJiVector[],
): DualTrackWeightSummary {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  // 三合格局底盘识别（只读调用 lib/ziwei/ 格局识别）
  const detectedPatterns = resolveSanhePatterns(chart);
  const sanhePatterns = detectedPatterns.map((p) => ({
    name: p.name,
    level: p.level,
    palaces: p.palaces,
    backgroundScore: SANHE_PATTERN_LEVEL_SCORES[p.level] ?? 0,
  }));

  const sanheBackgroundScore = round2(
    sanhePatterns.reduce((sum, item) => sum + item.backgroundScore, 0),
  );

  // 飞星规则匹配（patterns.ts FLYING_RULES 初始为空数组）
  const flyingRuleHits = evaluateFlyingRules({
    chart,
    body,
    rawMatrix,
    vectors,
  });
  const rulesDelta = flyingRuleHits.reduce((s, h) => s + h.weightDelta, 0);

  // 飞星主轨综合能量分（取六内宫净权重之和 + 来因宫净权重 + 规则修正）
  const innerNetSum = weightedField
    .filter((f) => f.domainType === 'inner')
    .reduce((sum, f) => sum + f.totalNetWeight, 0);
  const laiYinNet =
    weightedField.find((f) => f.branch === body.laiYin.branch)?.totalNetWeight ?? 0;
  const flyingMatrixScore = round2(innerNetSum + laiYinNet * 0.5 + rulesDelta);

  const combinedIndex = round2(
    flyingMatrixScore * DUAL_TRACK_CONFIG.flyingMatrixPriority +
      sanheBackgroundScore * DUAL_TRACK_CONFIG.sanheBackground,
  );

  // 净权重绝对值最高的前 3 宫位（磁场焦点）
  const topResonancePalaces = [...weightedField]
    .sort((a, b) => Math.abs(b.totalNetWeight) - Math.abs(a.totalNetWeight))
    .slice(0, 3)
    .map((f) => ({
      palaceName: f.palaceName,
      branchName: f.branchName,
      totalNetWeight: f.totalNetWeight,
    }));

  return {
    mode: 'dual-track',
    trackWeights: {
      flyingMatrixPriority: DUAL_TRACK_CONFIG.flyingMatrixPriority,
      sanheBackground: DUAL_TRACK_CONFIG.sanheBackground,
    },
    topResonancePalaces,
    sanhePatterns,
    sanheBackgroundScore,
    flyingMatrixScore,
    combinedIndex,
    flyingRuleHits,
  };
}

/**
 * 磁场化主入口函数
 */
export function computeMagneticField(input: MagneticFieldInput): MagneticField {
  const { chart, daXianIndex, referenceYear } = input;
  const body = buildMagneticBody(chart);
  const rawMatrix = buildRawFlyingMatrix(chart, { daXianIndex, referenceYear });
  const weightedField = buildWeightedField(body, rawMatrix);
  const vectors = buildLuFollowsJiVectors(chart, body, rawMatrix);
  const dualTrack = buildDualTrackWeighting(
    chart,
    body,
    rawMatrix,
    weightedField,
    vectors,
  );

  return {
    body,
    rawMatrix,
    weightedField,
    vectors,
    dualTrack,
  };
}
