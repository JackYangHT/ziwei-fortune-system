/**
 * 阶段 A：本命盘随机采样验证与性能瓶颈拆解脚本 (scripts/enumerate-natal.ts)
 *
 * 1. 开头先对 200 盘单独计时：拆解 generateChart vs computeMagneticField（及内部子阶段）耗时。
 * 2. 使用固定 seed 的 mulberry32 伪随机数生成器采样 5,000 盘（1950–2050 年，1–12 月，1–28 日，0–11 时辰，male/female，longitude=121.5）。
 * 3. 每 500 盘打印一次进度。
 * 4. 输出 scripts/enumerate-report.json 与控制台完整汇总。
 */

import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { generateChart } from '../lib/ziwei/algorithm';
import { BRANCHES, STEMS } from '../lib/ziwei/constants';
import { DING_FU_GE } from '../lib/ziwei/patterns-dingfu';
import { DING_GUI_GE } from '../lib/ziwei/patterns-dinggui';
import { DING_PIN_GE } from '../lib/ziwei/patterns-dingpin';
import type { BirthInfo, SiHua, ZiweiChart } from '../lib/ziwei/types';
import {
  buildDualTrackWeighting,
  buildLuFollowsJiVectors,
  buildMagneticBody,
  buildWeightedField,
  computeMagneticField,
} from '../lib/ziwei-flying/magnetic-field';
import { buildRawFlyingMatrix } from '../lib/ziwei-flying/matrix';
import { FLYING_RULES } from '../lib/ziwei-flying/patterns';
import type { LuFollowsJiVector } from '../lib/ziwei-flying/types';

type Gender = BirthInfo['gender'];

/**
 * Mulberry32 固定种子伪随机数生成器（返回 [0, 1) 浮点数）
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
}

interface SampleBirthParams {
  year: number;
  month: number;
  day: number;
  hour: number;
  gender: Gender;
  longitude: number;
  referenceYear: number;
}

function generateSampleParams(count: number, seed = 20261115): SampleBirthParams[] {
  const rng = mulberry32(seed);
  const list: SampleBirthParams[] = new Array(count);
  for (let i = 0; i < count; i++) {
    list[i] = {
      year: randInt(rng, 1950, 2050),
      month: randInt(rng, 1, 12),
      day: randInt(rng, 1, 28),
      hour: randInt(rng, 0, 11),
      gender: rng() < 0.5 ? 'male' : 'female',
      longitude: 121.5,
      referenceYear: randInt(rng, 1980, 2060),
    };
  }
  return list;
}

// 已知在 lib/ziwei/patterns.ts 与全书三表中定义的全部格局名称集合（用于检测 0 触发格局）
const KNOWN_BASE_PATTERNS: readonly string[] = [
  '君臣庆会',
  '紫府同宫',
  '府相朝垣',
  '阳梁昌禄',
  '火贪格',
  '铃贪格',
  '武贪格',
  '杀破狼',
  '机月同梁',
  '廉贞天相格',
  '武曲七杀',
  '天同天梁格',
  '日月同宫',
  '日月夹命',
  '巨日同宫',
  '石中隐玉',
  '明珠出海',
  '紫微入命',
  '辅弼夹命',
  '昌曲夹命',
  '魁钺夹命',
  '双禄朝垣',
  '三奇加会',
  '羊陀夹忌',
  '火铃夹命',
  '空劫夹命',
  '廉杀羊',
  '巨火羊',
  '铃昌陀武',
  '马头带箭',
  '禄存守命',
  '禄存守身',
  '天马入命',
  '天马在迁',
  '化禄入财',
  '化权入官',
  '化科入命',
  '化科入身',
  '机月同梁三星会',
  '昌曲坐命',
  '昌曲同会',
  '辅弼同会',
  '魁钺同会',
  '科权双会',
  // 十干化禄入命 / 化忌入命迁动态格局名
  '廉贞化禄入命',
  '天机化禄入命',
  '天同化禄入命',
  '太阴化禄入命',
  '贪狼化禄入命',
  '武曲化禄入命',
  '太阳化禄入命',
  '巨门化禄入命',
  '天梁化禄入命',
  '破军化禄入命',
  '太阳化忌入命',
  '太阳化忌入迁',
  '太阴化忌入命',
  '太阴化忌入迁',
  '廉贞化忌入命',
  '廉贞化忌入迁',
  '巨门化忌入命',
  '巨门化忌入迁',
  '天机化忌入命',
  '天机化忌入迁',
  '文曲化忌入命',
  '文曲化忌入迁',
  '天同化忌入命',
  '天同化忌入迁',
  '文昌化忌入命',
  '文昌化忌入迁',
  '武曲化忌入命',
  '武曲化忌入迁',
  '贪狼化忌入命',
  '贪狼化忌入迁',
  ...DING_GUI_GE.map((g) => g.name),
  ...DING_FU_GE.map((g) => g.name),
  ...DING_PIN_GE.map((g) => g.name),
];

interface CrashSample extends SampleBirthParams {
  error: string;
}

function runBenchmark200(samples200: SampleBirthParams[]) {
  console.log('=== [Step 1] 200 盘性能瓶颈拆解基准测试 ===');
  const charts: ZiweiChart[] = new Array(samples200.length);

  // 1. 单独测 generateChart
  const tGen0 = performance.now();
  for (let i = 0; i < samples200.length; i++) {
    charts[i] = generateChart(samples200[i]);
  }
  const totalGenMs = performance.now() - tGen0;
  const avgGenMs = totalGenMs / samples200.length;

  // 2. 单独测 computeMagneticField（复用已生成的 charts）
  const tMf0 = performance.now();
  for (let i = 0; i < charts.length; i++) {
    computeMagneticField({ chart: charts[i], referenceYear: 2026 });
  }
  const totalMfMs = performance.now() - tMf0;
  const avgMfMs = totalMfMs / charts.length;

  // 3. 细分 buildMagneticBody / buildRawFlyingMatrix / buildWeightedField / buildLuFollowsJiVectors / buildDualTrackWeighting
  let bodyMs = 0;
  let matrixMs = 0;
  let weightedMs = 0;
  let vectorsMs = 0;
  let dualTrackMs = 0;

  for (let i = 0; i < charts.length; i++) {
    const c = charts[i];
    let t = performance.now();
    const body = buildMagneticBody(c);
    bodyMs += performance.now() - t;

    t = performance.now();
    const rawMatrix = buildRawFlyingMatrix(c, { referenceYear: 2026 });
    matrixMs += performance.now() - t;

    t = performance.now();
    const weightedField = buildWeightedField(body, rawMatrix);
    weightedMs += performance.now() - t;

    t = performance.now();
    const vectors = buildLuFollowsJiVectors(c, body, rawMatrix);
    vectorsMs += performance.now() - t;

    t = performance.now();
    buildDualTrackWeighting(c, body, rawMatrix, weightedField, vectors);
    dualTrackMs += performance.now() - t;
  }

  const subStageAvgMs = {
    buildMagneticBody: Number((bodyMs / charts.length).toFixed(4)),
    buildRawFlyingMatrix: Number((matrixMs / charts.length).toFixed(4)),
    buildWeightedField: Number((weightedMs / charts.length).toFixed(4)),
    buildLuFollowsJiVectors: Number((vectorsMs / charts.length).toFixed(4)),
    buildDualTrackWeighting: Number((dualTrackMs / charts.length).toFixed(4)),
  };

  console.log(
    `200 盘基准结果: generateChart 平均 ${avgGenMs.toFixed(4)} ms | computeMagneticField 平均 ${avgMfMs.toFixed(4)} ms`,
  );
  console.log(
    `  子阶段平均耗时 (ms): body=${subStageAvgMs.buildMagneticBody}, matrix=${subStageAvgMs.buildRawFlyingMatrix}, weightedField=${subStageAvgMs.buildWeightedField}, vectors=${subStageAvgMs.buildLuFollowsJiVectors}, dualTrack=${subStageAvgMs.buildDualTrackWeighting}`,
  );

  return {
    benchmarkSampleSize: samples200.length,
    generateChartTotalMs: Number(totalGenMs.toFixed(2)),
    generateChartAvgMs: Number(avgGenMs.toFixed(4)),
    computeMagneticFieldTotalMs: Number(totalMfMs.toFixed(2)),
    computeMagneticFieldAvgMs: Number(avgMfMs.toFixed(4)),
    subStageAvgMs,
  };
}

function main() {
  const TOTAL_SAMPLES = 5000;
  const SEED = 20261115;
  const samples = generateSampleParams(TOTAL_SAMPLES, SEED);

  // 先跑 200 盘瓶颈拆解
  const benchmark200 = runBenchmark200(samples.slice(0, 200));

  console.log(`\n=== [Step 2] 开始 ${TOTAL_SAMPLES} 盘随机采样统计 (seed=${SEED}) ===`);

  let totalSamples = 0;
  let successSamples = 0;
  let crashCount = 0;
  const crashSamples: CrashSample[] = [];

  const laiYinPalaceCounts: Record<string, number> = {};
  const laiYinStemCounts: Record<string, number> = {};
  for (const s of STEMS) laiYinStemCounts[s] = 0;

  const natalSihuaBranchCounts: Record<SiHua, Record<string, number>> = {
    '禄': {},
    '权': {},
    '科': {},
    '忌': {},
  };
  for (const sh of ['禄', '权', '科', '忌'] as const) {
    for (const b of BRANCHES) {
      natalSihuaBranchCounts[sh][b] = 0;
    }
  }

  const patternCounts = new Map<string, number>();
  for (const name of KNOWN_BASE_PATTERNS) {
    patternCounts.set(name, 0);
  }

  const flyingRuleCounts = new Map<string, number>();
  for (const rule of FLYING_RULES) {
    flyingRuleCounts.set(rule.id, 0);
  }

  const vectorRelationCounts: Record<LuFollowsJiVector['relation'], number> = {
    'same-palace': 0,
    'opposite-palace': 0,
    'sanhe-palace': 0,
    clamp: 0,
    'other-palace': 0,
  };
  let totalVectors = 0;

  let weightCount = 0;
  let weightMin = Infinity;
  let weightMax = -Infinity;
  let weightMean = 0;
  let weightM2 = 0;

  let totalGenerateChartMs = 0;
  let totalComputeMfMs = 0;
  const tAllStart = performance.now();

  for (let i = 0; i < samples.length; i++) {
    const params = samples[i];
    totalSamples++;
    try {
      const tGen = performance.now();
      const chart = generateChart(params);
      totalGenerateChartMs += performance.now() - tGen;

      const tMf = performance.now();
      const mf = computeMagneticField({
        chart,
        referenceYear: params.referenceYear,
      });
      totalComputeMfMs += performance.now() - tMf;

      successSamples++;

      // 1. laiYin.palaceName
      const lyPalace = mf.body.laiYin.palaceName;
      laiYinPalaceCounts[lyPalace] = (laiYinPalaceCounts[lyPalace] ?? 0) + 1;

      // 2. laiYin.stemName
      const lyStem = mf.body.laiYin.stemName;
      laiYinStemCounts[lyStem] = (laiYinStemCounts[lyStem] ?? 0) + 1;

      // 3. body.natalSihua 四颗星落宫地支分布
      for (const sh of ['禄', '权', '科', '忌'] as const) {
        const bName = mf.body.natalSihua[sh].branchName;
        natalSihuaBranchCounts[sh][bName] =
          (natalSihuaBranchCounts[sh][bName] ?? 0) + 1;
      }

      // 4. 三合格局触发次数（同盘同名格局去重计 1 次）
      const seenInChart = new Set<string>();
      for (const pat of mf.dualTrack.sanhePatterns) {
        if (!seenInChart.has(pat.name)) {
          seenInChart.add(pat.name);
          patternCounts.set(pat.name, (patternCounts.get(pat.name) ?? 0) + 1);
        }
      }

      // 4b. FLYING_RULES 触发次数统计
      for (const hit of mf.dualTrack.flyingRuleHits) {
        flyingRuleCounts.set(hit.id, (flyingRuleCounts.get(hit.id) ?? 0) + 1);
      }

      // 5. vectors relation 分布
      for (const v of mf.vectors) {
        vectorRelationCounts[v.relation] =
          (vectorRelationCounts[v.relation] ?? 0) + 1;
        totalVectors++;
      }

      // 6. weightedField totalNetWeight 分布
      for (const wf of mf.weightedField) {
        const x = wf.totalNetWeight;
        weightCount++;
        if (x < weightMin) weightMin = x;
        if (x > weightMax) weightMax = x;
        const delta = x - weightMean;
        weightMean += delta / weightCount;
        const delta2 = x - weightMean;
        weightM2 += delta * delta2;
      }
    } catch (err) {
      crashCount++;
      if (crashSamples.length < 10) {
        crashSamples.push({
          ...params,
          error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
        });
      }
    }

    if (totalSamples % 500 === 0 || totalSamples === samples.length) {
      const elapsedSec = ((performance.now() - tAllStart) / 1000).toFixed(2);
      console.log(
        `[进度] ${totalSamples}/${samples.length} 盘 | 累计耗时 ${elapsedSec}s | generateChart 平均 ${(totalGenerateChartMs / totalSamples).toFixed(2)}ms | computeMagneticField 平均 ${(totalComputeMfMs / totalSamples).toFixed(3)}ms`,
      );
    }
  }

  const totalElapsedMs = performance.now() - tAllStart;
  const avgGenerateChartMs = totalSamples > 0 ? totalGenerateChartMs / totalSamples : 0;
  const avgComputeMfMs = totalSamples > 0 ? totalComputeMfMs / totalSamples : 0;
  const avgTotalPerChartMs = totalSamples > 0 ? totalElapsedMs / totalSamples : 0;
  const weightStd = weightCount > 0 ? Math.sqrt(weightM2 / weightCount) : 0;

  const pct = (n: number, denom: number) =>
    denom > 0 ? Number(((n / denom) * 100).toFixed(4)) : 0;

  // 整理 laiYin 宫位分布
  const laiYinPalaceDistribution = Object.entries(laiYinPalaceCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([palaceName, count]) => ({
      palaceName,
      count,
      ratePct: pct(count, successSamples),
      deviationFromUniformPct: Number(
        (pct(count, successSamples) - 100 / 12).toFixed(4),
      ),
    }));

  // 整理 laiYin 天干分布
  const laiYinStemDistribution = STEMS.map((stemName) => {
    const count = laiYinStemCounts[stemName] ?? 0;
    const ratePct = pct(count, successSamples);
    return {
      stemName,
      count,
      ratePct,
      deviationFromUniformPct: Number((ratePct - 10).toFixed(4)),
    };
  });

  // 整理三合格局触发率（降序）
  const patternStats = [...patternCounts.entries()]
    .map(([name, count]) => {
      const ratePct = pct(count, successSamples);
      let category: 'over-50%' | 'normal-0.1%-50%' | 'low-sample-1-4' | 'zero';
      if (count === 0) category = 'zero';
      else if (ratePct > 50) category = 'over-50%';
      else if (count >= 1 && count <= 4) category = 'low-sample-1-4';
      else category = 'normal-0.1%-50%';
      return {
        name,
        count,
        ratePct,
        category,
      };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));

  const patternsOver50Pct = patternStats.filter((p) => p.category === 'over-50%');
  const patternsNormal = patternStats.filter((p) => p.category === 'normal-0.1%-50%');
  const patternsLowSample = patternStats.filter((p) => p.category === 'low-sample-1-4');
  const patternsZero = patternStats.filter((p) => p.category === 'zero');

  // 整理 FLYING_RULES 触发率（降序）
  const flyingRuleStats = FLYING_RULES.map((rule) => {
    const count = flyingRuleCounts.get(rule.id) ?? 0;
    const ratePct = pct(count, successSamples);
    let statusLabel: string;
    if (count === 0) statusLabel = '规则写错或永远不可达';
    else if (ratePct > 40) statusLabel = '条件太宽';
    else if (count >= 1 && count <= 4) statusLabel = '样本不足';
    else statusLabel = '正常';
    return {
      id: rule.id,
      name: rule.name,
      level: rule.level,
      weightDelta: rule.weightDelta,
      count,
      ratePct,
      statusLabel,
    };
  }).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));

  // 整理 vectors relation 分布
  const vectorRelationDistribution = (
    ['same-palace', 'opposite-palace', 'sanhe-palace', 'clamp', 'other-palace'] as const
  ).map((relation) => ({
    relation,
    count: vectorRelationCounts[relation],
    ratePct: pct(vectorRelationCounts[relation], totalVectors),
  }));

  const report = {
    meta: {
      samplingMethod: 'mulberry32-uniform-random',
      seed: SEED,
      yearRange: [1950, 2050],
      monthRange: [1, 12],
      dayRange: [1, 28],
      hourRange: [0, 11],
      longitude: 121.5,
      totalSamples,
      successSamples,
      crashCount,
      crashSamples,
    },
    benchmark200,
    timing5000: {
      totalGenerateChartMs: Number(totalGenerateChartMs.toFixed(2)),
      avgGenerateChartMs: Number(avgGenerateChartMs.toFixed(4)),
      totalComputeMagneticFieldMs: Number(totalComputeMfMs.toFixed(2)),
      avgComputeMagneticFieldMs: Number(avgComputeMfMs.toFixed(4)),
      totalElapsedMs: Number(totalElapsedMs.toFixed(2)),
      avgTotalPerChartMs: Number(avgTotalPerChartMs.toFixed(4)),
      exceeds50MsThreshold: avgComputeMfMs > 50,
    },
    laiYinPalaceDistribution,
    laiYinStemDistribution,
    natalSihuaBranchCounts,
    patternStats,
    patternBuckets: {
      over50Pct: patternsOver50Pct,
      normal01To50Pct: patternsNormal,
      lowSample1To4: patternsLowSample,
      zeroTrigger: patternsZero,
    },
    flyingRuleStats,
    vectorRelationDistribution: {
      totalVectors,
      byRelation: vectorRelationDistribution,
    },
    weightedFieldStats: {
      totalPalaceRecords: weightCount,
      min: Number(weightMin.toFixed(4)),
      max: Number(weightMax.toFixed(4)),
      mean: Number(weightMean.toFixed(4)),
      std: Number(weightStd.toFixed(4)),
    },
  };

  const outPath = path.join(__dirname, 'enumerate-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n=== 阶段 A：5,000 盘随机采样验证汇总 ===');
  console.log(`总样本数: ${totalSamples} | 成功: ${successSamples} | 崩溃: ${crashCount}`);
  console.log(
    `5000 盘平均耗时: generateChart=${report.timing5000.avgGenerateChartMs} ms | computeMagneticField=${report.timing5000.avgComputeMagneticFieldMs} ms | 全流程单盘=${report.timing5000.avgTotalPerChartMs} ms`,
  );
  console.log('\n--- 来因宫宫位分布 ---');
  for (const item of laiYinPalaceDistribution) {
    console.log(
      `  ${item.palaceName}: ${item.count} (${item.ratePct}%, 偏离均匀值 ${item.deviationFromUniformPct >= 0 ? '+' : ''}${item.deviationFromUniformPct}%)`,
    );
  }
  console.log('\n--- 来因宫天干分布 ---');
  for (const item of laiYinStemDistribution) {
    console.log(
      `  ${item.stemName}: ${item.count} (${item.ratePct}%, 偏离均匀值 ${item.deviationFromUniformPct >= 0 ? '+' : ''}${item.deviationFromUniformPct}%)`,
    );
  }
  console.log('\n--- FLYING_RULES (18 条) 触发率统计（降序）---');
  for (const r of flyingRuleStats) {
    console.log(
      `  ${r.id} | ${r.name} | ${r.count} 次 (${r.ratePct}%) | [${r.statusLabel}]`,
    );
  }
  console.log('\n--- vectors relation 分布 ---');
  for (const item of vectorRelationDistribution) {
    console.log(`  ${item.relation}: ${item.count} (${item.ratePct}%)`);
  }
  console.log('\n--- weightedField.totalNetWeight 统计 ---');
  console.log(
    `  min=${report.weightedFieldStats.min}, max=${report.weightedFieldStats.max}, mean=${report.weightedFieldStats.mean}, std=${report.weightedFieldStats.std}`,
  );
  console.log(`\n报告已写入: ${outPath}`);
}

main();
